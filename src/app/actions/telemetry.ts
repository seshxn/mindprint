"use server";

import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db, hasDatabaseUrl } from "@/db";
import { telemetryEvents, telemetrySessions } from "@/db/schema";
import { TelemetryEvent } from "@/types/telemetry";
import {
  base64UrlDecode,
  base64UrlEncode,
  signPayload,
  stableStringify,
  verifyPayloadSignature,
} from "@/lib/server-signing";

const SESSION_TTL_MS = 1000 * 60 * 90;
const MAX_BATCH_EVENTS = 4000;

type SessionTokenPayload = {
  sid: string;
  nonce: string;
  exp: number;
};

const createSessionToken = (payload: SessionTokenPayload) => {
  const encodedPayload = base64UrlEncode(stableStringify(payload));
  const signature = signPayload(payload, "MINDPRINT_SESSION_SECRET");
  return `${encodedPayload}.${signature}`;
};

const parseSessionToken = (token: string): SessionTokenPayload | null => {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  try {
    const payload = JSON.parse(
      base64UrlDecode(encodedPayload),
    ) as SessionTokenPayload;
    const valid = verifyPayloadSignature(
      payload,
      signature,
      "MINDPRINT_SESSION_SECRET",
    );
    if (!valid) return null;
    if (!payload.sid || !payload.nonce || !Number.isFinite(payload.exp))
      return null;
    return payload;
  } catch {
    return null;
  }
};

const validateEventShape = (event: TelemetryEvent) => {
  if (!Number.isFinite(event.timestamp) || event.timestamp < 0) return false;
  if (event.type === "keystroke") {
    return (
      typeof event.key === "string" &&
      ["char", "delete", "nav", "other"].includes(event.action)
    );
  }
  if (event.type === "paste") {
    return (
      Number.isFinite(event.length) &&
      event.length >= 0 &&
      typeof event.source === "string"
    );
  }
  if (event.type === "operation") {
    return (
      ["insert", "delete", "replace"].includes(event.op) &&
      Number.isInteger(event.from) &&
      Number.isInteger(event.to) &&
      event.from >= 0 &&
      event.to >= event.from &&
      typeof event.text === "string"
    );
  }
  return false;
};

const validateEvents = (events: TelemetryEvent[]) => {
  if (events.length === 0 || events.length > MAX_BATCH_EVENTS) return false;
  let previousTimestamp = 0;
  for (const event of events) {
    if (!validateEventShape(event)) return false;
    if (event.timestamp + 0.5 < previousTimestamp) {
      return false;
    }
    previousTimestamp = event.timestamp;
  }
  return true;
};

export const initTelemetrySession = async () => {
  if (!hasDatabaseUrl) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const sessionId = `sess-${randomUUID().replace(/-/g, "")}`;
  const nonce = randomUUID().replace(/-/g, "").slice(0, 24);
  const exp = Date.now() + SESSION_TTL_MS;
  const payload: SessionTokenPayload = { sid: sessionId, nonce, exp };
  const token = createSessionToken(payload);

  await db.insert(telemetrySessions).values({
    sessionId,
    nonce,
    expiresAt: new Date(exp),
    lastSequence: 0,
  });

  return {
    sessionId,
    sessionToken: token,
    expiresAt: new Date(exp).toISOString(),
  };
};

interface IngestTelemetryOptions {
  sessionToken: string;
  batchSequence: number;
}

export const ingestTelemetry = async (
  events: TelemetryEvent[],
  sessionId: string,
  options: IngestTelemetryOptions,
) => {
  if (!hasDatabaseUrl) return;
  if (!sessionId || !options?.sessionToken) {
    throw new Error("Missing telemetry session credentials.");
  }
  if (!Number.isInteger(options.batchSequence) || options.batchSequence <= 0) {
    throw new Error("Invalid telemetry batch sequence.");
  }
  if (!validateEvents(events)) {
    throw new Error(
      "Telemetry payload rejected due to invalid shape or ordering.",
    );
  }

  const tokenPayload = parseSessionToken(options.sessionToken);
  if (!tokenPayload || tokenPayload.sid !== sessionId) {
    throw new Error("Telemetry session token is invalid.");
  }
  if (tokenPayload.exp <= Date.now()) {
    throw new Error("Telemetry session token has expired.");
  }

  await db.transaction(async (tx) => {
    const session = await tx.query.telemetrySessions.findFirst({
      where: eq(telemetrySessions.sessionId, sessionId),
    });

    if (!session) {
      throw new Error("Telemetry session does not exist.");
    }
    if (session.nonce !== tokenPayload.nonce) {
      throw new Error("Telemetry session nonce mismatch.");
    }
    if (session.expiresAt.getTime() <= Date.now()) {
      throw new Error("Telemetry session has expired.");
    }
    if (options.batchSequence <= session.lastSequence) {
      throw new Error("Out-of-order or replayed telemetry batch rejected.");
    }

    await tx.insert(telemetryEvents).values({
      sessionId,
      batchSequence: options.batchSequence,
      events,
    });

    await tx
      .update(telemetrySessions)
      .set({
        lastSequence: options.batchSequence,
      })
      .where(eq(telemetrySessions.sessionId, sessionId));
  });
};
