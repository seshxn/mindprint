import 'server-only';

import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { certificates } from '@/db/schema';
import { CertificatePayload } from '@/lib/certificate';
import { ValidationStatus } from '@/lib/telemetry';

export interface CreateCertificateInput {
  title: string;
  subtitle: string;
  text: string;
  score: number;
  issuedAt: string;
  seed: string;
  sparkline: number[];
  validationStatus?: ValidationStatus;
}

const safeId = () => `mp-${randomUUID().replace(/-/g, '').slice(0, 12)}`;

const normalizeSparkline = (values: number[]) => {
  const parsed = values
    .filter((value) => Number.isFinite(value) && value >= 0)
    .slice(0, 48)
    .map((value) => Number(value.toFixed(2)));
  return parsed.length > 0 ? parsed : [2, 4, 3, 5, 7, 6, 8, 5, 4, 6, 3, 2];
};

const sanitizeDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date();
  }
  return parsed;
};

export const createCertificateRecord = async (input: CreateCertificateInput): Promise<CertificatePayload> => {
  const id = safeId();
  const issuedAtDate = sanitizeDate(input.issuedAt);
  const normalizedSparkline = normalizeSparkline(input.sparkline);
  const title = input.title.slice(0, 120) || 'Mindprint Human Origin Certificate';
  const subtitle = input.subtitle.slice(0, 120) || 'Proof of Human Creation';
  const text = input.text.slice(0, 420) || 'No transcript attached to this certificate.';
  const score = Math.round(Math.max(0, Math.min(100, input.score)));
  const seed = (input.seed || id).slice(0, 120);

  await db.insert(certificates).values({
    id,
    issuedAt: issuedAtDate,
    title,
    subtitle,
    text,
    score,
    seed,
    sparkline: normalizedSparkline,
    validationStatus: input.validationStatus ?? null,
  });

  return {
    id,
    title,
    subtitle,
    text,
    score,
    issuedAt: issuedAtDate.toISOString(),
    sparkline: normalizedSparkline,
    seed,
  };
};

export const getCertificateRecord = async (id: string): Promise<CertificatePayload | null> => {
  const normalizedId = id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  if (!normalizedId) return null;

  const result = await db.query.certificates.findFirst({
    where: eq(certificates.id, normalizedId),
  });

  if (!result) {
    return null;
  }

  return {
    id: result.id,
    title: result.title,
    subtitle: result.subtitle,
    text: result.text,
    score: result.score,
    issuedAt: result.issuedAt.toISOString(),
    sparkline: normalizeSparkline(Array.isArray(result.sparkline) ? result.sparkline : []),
    seed: result.seed || result.id,
  };
};
