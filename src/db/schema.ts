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
    sessionId: text('session_id'),
    createdAt: timestamp('created_at').defaultNow(),
    events: jsonb('events').$type<TelemetryEvent[]>(),
  },
  (table) => ({
    sessionIdIdx: index('session_id_idx').on(table.sessionId),
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
    validationStatus: validationStatusEnum('validation_status'),
  },
  (table) => ({
    issuedAtIdx: index('certificate_issued_at_idx').on(table.issuedAt),
  })
);

export const analysisResults = pgTable('analysis_results', {
  id: serial('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  result: text('result').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});
