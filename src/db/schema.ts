import { pgTable, text, serial, timestamp, jsonb, index, integer, pgEnum } from 'drizzle-orm/pg-core';
import { TelemetryEvent } from '@/types/telemetry';

export const validationStatusEnum = pgEnum('validation_status_enum', [
  'VERIFIED_HUMAN',
  'SUSPICIOUS',
  'LOW_EFFORT',
  'INSUFFICIENT_DATA',
]);

export const telemetryEvents = pgTable(
  'telemetry_events',
  {
    id: serial('id').primaryKey(),
    sessionId: text('session_id').notNull(),
    batchSequence: integer('batch_sequence').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
    events: jsonb('events').$type<TelemetryEvent[]>().notNull(),
  },
  (table) => ({
    sessionIdIdx: index('session_id_idx').on(table.sessionId),
  })
);

export const telemetrySessions = pgTable(
  'telemetry_sessions',
  {
    sessionId: text('session_id').primaryKey(),
    nonce: text('nonce').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    lastSequence: integer('last_sequence').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    expiresAtIdx: index('telemetry_session_expires_at_idx').on(table.expiresAt),
  })
);

export const certificates = pgTable(
  'certificates',
  {
    id: text('id').primaryKey(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    issuedAt: timestamp('issued_at').notNull(),
    title: text('title').notNull(),
    subtitle: text('subtitle').notNull(),
    text: text('text').notNull(),
    score: integer('score').notNull(),
    seed: text('seed').notNull(),
    sparkline: jsonb('sparkline').$type<number[]>().notNull(),
    replay: jsonb('replay').$type<TelemetryEvent[]>().notNull(),
    proof: jsonb('proof').$type<Record<string, unknown>>().notNull(),
    validationStatus: validationStatusEnum('validation_status'),
  },
  (table) => ({
    issuedAtIdx: index('certificate_issued_at_idx').on(table.issuedAt),
  })
);

export const certificateLog = pgTable(
  'certificate_log',
  {
    id: serial('id').primaryKey(),
    certificateId: text('certificate_id').notNull(),
    prevHash: text('prev_hash'),
    entryHash: text('entry_hash').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    certIdIdx: index('certificate_log_certificate_id_idx').on(table.certificateId),
    createdAtIdx: index('certificate_log_created_at_idx').on(table.createdAt),
  })
);

export const analysisResults = pgTable('analysis_results', {
  id: serial('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  result: text('result').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});
