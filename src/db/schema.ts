import { pgTable, text, serial, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { TelemetryEvent } from '@/types/telemetry';

export const telemetryEvents = pgTable('telemetry_events', {
  id: serial('id').primaryKey(),
  sessionId: text('session_id'), // Optional session identifier
  createdAt: timestamp('created_at').defaultNow(),
  events: jsonb('events').$type<TelemetryEvent[]>(),
}, (table) => ({
  sessionIdIdx: index('session_id_idx').on(table.sessionId),
}));

export const analysisResults = pgTable('analysis_results', {
  id: serial('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  result: text('result').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});
