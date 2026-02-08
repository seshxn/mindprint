import "server-only";

import { createHash, randomUUID } from "crypto";
import { desc, eq } from "drizzle-orm";
import { db, hasDatabaseUrl } from "@/db";
import { certificateLog, certificates } from "@/db/schema";
import {
  CertificatePayload,
  CertificateProof,
  ReplayOperation,
} from "@/lib/certificate";
import { ValidationStatus } from "@/lib/telemetry";
import {
  signPayload,
  stableStringify,
  verifyPayloadSignature,
} from "@/lib/server-signing";

export interface CreateCertificateInput {
  title: string;
  subtitle: string;
  text: string;
  score: number;
  issuedAt: string;
  seed: string;
  sparkline: number[];
  replay: ReplayOperation[];
  validationStatus?: ValidationStatus;
  riskScore?: number;
  confidence?: number;
}

const safeId = () => `mp-${randomUUID().replace(/-/g, "").slice(0, 12)}`;

const normalizeSparkline = (values: number[]) => {
  const parsed = values
    .filter((value) => Number.isFinite(value) && value >= 0)
    .slice(0, 48)
    .map((value) => Number(value.toFixed(2)));
  return parsed.length > 0 ? parsed : [2, 4, 3, 5, 7, 6, 8, 5, 4, 6, 3, 2];
};

const normalizeReplay = (events: ReplayOperation[]) =>
  events
    .filter(
      (event) =>
        Number.isFinite(event.timestamp) &&
        Number.isInteger(event.from) &&
        Number.isInteger(event.to) &&
        event.from >= 0 &&
        event.to >= event.from,
    )
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(0, 4000)
    .map((event) => ({
      type: "operation" as const,
      timestamp: Number(event.timestamp),
      op: event.op,
      from: event.from,
      to: event.to,
      text: event.text.slice(0, 1000),
    }));

const sanitizeDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date();
  }
  return parsed;
};

const sha256Hex = (value: string) =>
  createHash("sha256").update(value).digest("hex");

const buildUnsignedProof = (
  payload: Omit<CertificatePayload, "proof">,
  input: Pick<
    CreateCertificateInput,
    "validationStatus" | "riskScore" | "confidence"
  >,
) => {
  const artifactSha256 = sha256Hex(payload.text);
  const telemetryDigestSha256 = sha256Hex(stableStringify(payload.replay));
  return {
    version: "v1" as const,
    certificateId: payload.id,
    artifactSha256,
    telemetryDigestSha256,
    issuedAt: payload.issuedAt,
    validationStatus: input.validationStatus ?? null,
    riskScore: Number.isFinite(input.riskScore)
      ? Math.round(input.riskScore as number)
      : null,
    confidence: Number.isFinite(input.confidence)
      ? Number((input.confidence as number).toFixed(3))
      : null,
  };
};

const buildLogEntryHash = (
  certificateId: string,
  prevHash: string | null,
  signature: string,
) =>
  sha256Hex(
    stableStringify({
      certificateId,
      prevHash,
      signature,
    }),
  );

const isValidationStatus = (value: unknown): value is ValidationStatus =>
  value === "VERIFIED_HUMAN" ||
  value === "SUSPICIOUS" ||
  value === "LOW_EFFORT" ||
  value === "INSUFFICIENT_DATA";

const parseProof = (raw: unknown): CertificateProof | null => {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Record<string, unknown>;
  const version = candidate.version;
  const artifactSha256 = candidate.artifactSha256;
  const telemetryDigestSha256 = candidate.telemetryDigestSha256;
  const issuedAt = candidate.issuedAt;
  const signature = candidate.signature;
  if (
    version !== "v1" ||
    typeof artifactSha256 !== "string" ||
    typeof telemetryDigestSha256 !== "string" ||
    typeof issuedAt !== "string" ||
    typeof signature !== "string"
  ) {
    return null;
  }
  const validationStatus = candidate.validationStatus;
  return {
    version: "v1",
    artifactSha256,
    telemetryDigestSha256,
    issuedAt,
    validationStatus: isValidationStatus(validationStatus)
      ? validationStatus
      : null,
    riskScore:
      typeof candidate.riskScore === "number" ? candidate.riskScore : null,
    confidence:
      typeof candidate.confidence === "number" ? candidate.confidence : null,
    signature,
    logEntryHash:
      typeof candidate.logEntryHash === "string"
        ? candidate.logEntryHash
        : null,
    prevLogEntryHash:
      typeof candidate.prevLogEntryHash === "string"
        ? candidate.prevLogEntryHash
        : null,
  };
};

const hydratePayload = (
  result: typeof certificates.$inferSelect,
): CertificatePayload => ({
  id: result.id,
  title: result.title,
  subtitle: result.subtitle,
  text: result.text,
  score: result.score,
  issuedAt: result.issuedAt.toISOString(),
  sparkline: normalizeSparkline(
    Array.isArray(result.sparkline) ? result.sparkline : [],
  ),
  seed: result.seed || result.id,
  replay: normalizeReplay(
    Array.isArray(result.replay) ? (result.replay as ReplayOperation[]) : [],
  ),
  proof: parseProof(result.proof),
});

export const createCertificateRecord = async (
  input: CreateCertificateInput,
): Promise<CertificatePayload> => {
  if (!hasDatabaseUrl) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const id = safeId();
  const issuedAtDate = sanitizeDate(input.issuedAt);
  const normalizedSparkline = normalizeSparkline(input.sparkline);
  const replay = normalizeReplay(input.replay);
  const title =
    input.title.slice(0, 120) || "Mindprint Human Origin Certificate";
  const subtitle = input.subtitle.slice(0, 120) || "Proof of Human Creation";
  const text =
    input.text.slice(0, 420) || "No transcript attached to this certificate.";
  const score = Math.round(Math.max(0, Math.min(100, input.score)));
  const seed = (input.seed || id).slice(0, 120);

  const basePayload: Omit<CertificatePayload, "proof"> = {
    id,
    title,
    subtitle,
    text,
    score,
    issuedAt: issuedAtDate.toISOString(),
    sparkline: normalizedSparkline,
    seed,
    replay,
  };

  const unsignedProof = buildUnsignedProof(basePayload, input);
  const signature = signPayload(unsignedProof, "MINDPRINT_CERTIFICATE_SECRET");

  const latestLogEntry = await db.query.certificateLog.findFirst({
    orderBy: desc(certificateLog.createdAt),
  });
  const prevLogEntryHash = latestLogEntry?.entryHash ?? null;
  const logEntryHash = buildLogEntryHash(id, prevLogEntryHash, signature);

  const proof: CertificateProof = {
    version: "v1",
    artifactSha256: unsignedProof.artifactSha256,
    telemetryDigestSha256: unsignedProof.telemetryDigestSha256,
    issuedAt: unsignedProof.issuedAt,
    validationStatus: unsignedProof.validationStatus,
    riskScore: unsignedProof.riskScore,
    confidence: unsignedProof.confidence,
    signature,
    logEntryHash,
    prevLogEntryHash,
  };

  const insertValue: typeof certificates.$inferInsert = {
    id,
    issuedAt: issuedAtDate,
    title,
    subtitle,
    text,
    score,
    seed,
    sparkline: normalizedSparkline,
    replay,
    proof: proof as unknown as Record<string, unknown>,
    validationStatus: input.validationStatus ?? null,
  };
  await db.insert(certificates).values(insertValue);

  await db.insert(certificateLog).values({
    certificateId: id,
    prevHash: prevLogEntryHash,
    entryHash: logEntryHash,
  });

  return {
    ...basePayload,
    proof,
  };
};

export interface CertificateVerificationResult {
  isValid: boolean;
  reason?: string;
}

export const verifyCertificatePayload = async (
  payload: CertificatePayload,
): Promise<CertificateVerificationResult> => {
  if (!payload.proof) {
    return { isValid: false, reason: "Missing proof bundle." };
  }

  const unsignedProof = buildUnsignedProof(payload, {
    validationStatus: isValidationStatus(payload.proof.validationStatus)
      ? payload.proof.validationStatus
      : undefined,
    riskScore: payload.proof.riskScore ?? undefined,
    confidence: payload.proof.confidence ?? undefined,
  });

  if (
    unsignedProof.artifactSha256 !== payload.proof.artifactSha256 ||
    unsignedProof.telemetryDigestSha256 !== payload.proof.telemetryDigestSha256
  ) {
    return { isValid: false, reason: "Artifact or telemetry digest mismatch." };
  }

  const signatureValid = verifyPayloadSignature(
    unsignedProof,
    payload.proof.signature,
    "MINDPRINT_CERTIFICATE_SECRET",
  );
  if (!signatureValid) {
    return { isValid: false, reason: "Invalid proof signature." };
  }

  const logRow = await db.query.certificateLog.findFirst({
    where: eq(certificateLog.certificateId, payload.id),
  });

  if (!logRow) {
    return { isValid: false, reason: "Certificate log entry not found." };
  }

  const expectedLogHash = buildLogEntryHash(
    payload.id,
    payload.proof.prevLogEntryHash,
    payload.proof.signature,
  );
  if (
    logRow.entryHash !== expectedLogHash ||
    payload.proof.logEntryHash !== expectedLogHash
  ) {
    return { isValid: false, reason: "Transparency log hash mismatch." };
  }

  if ((logRow.prevHash ?? null) !== (payload.proof.prevLogEntryHash ?? null)) {
    return {
      isValid: false,
      reason: "Transparency chain predecessor mismatch.",
    };
  }

  return { isValid: true };
};

export const getCertificateRecord = async (
  id: string,
): Promise<CertificatePayload | null> => {
  if (!hasDatabaseUrl) {
    return null;
  }

  const normalizedId = id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  if (!normalizedId) return null;

  const result = await db.query.certificates.findFirst({
    where: eq(certificates.id, normalizedId),
  });

  if (!result) {
    return null;
  }

  return hydratePayload(result);
};
