import 'server-only';

import { createHmac, timingSafeEqual } from 'crypto';

const DEFAULT_DEV_SECRET = 'mindprint-dev-signing-secret-change-in-production';

const sortKeysDeep = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return entries.reduce<Record<string, unknown>>((acc, [key, nested]) => {
      acc[key] = sortKeysDeep(nested);
      return acc;
    }, {});
  }
  return value;
};

export const stableStringify = (value: unknown) => JSON.stringify(sortKeysDeep(value));

const toBase64Url = (buffer: Buffer) =>
  buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

export const base64UrlEncode = (value: string) =>
  Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

export const base64UrlDecode = (value: string) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = `${normalized}${'='.repeat((4 - (normalized.length % 4)) % 4)}`;
  return Buffer.from(padded, 'base64').toString('utf8');
};

const getSecret = (envKey: string) => process.env[envKey] || process.env.MINDPRINT_SIGNING_SECRET || DEFAULT_DEV_SECRET;

export const signPayload = (payload: unknown, envKey: string) => {
  const content = stableStringify(payload);
  const digest = createHmac('sha256', getSecret(envKey)).update(content).digest();
  return toBase64Url(digest);
};

export const verifyPayloadSignature = (payload: unknown, signature: string, envKey: string) => {
  const expected = signPayload(payload, envKey);
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const providedBuffer = Buffer.from(signature || '', 'utf8');
  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }
  return timingSafeEqual(expectedBuffer, providedBuffer);
};
