import { pgTable, text, serial, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { TelemetryEvent } from '@/types/telemetry';

export const telemetryEvents = pgTable('telemetry_events', {
  id: serial('id').primaryKey(),
  sessionId: text('session_id'), // Optional session identifier
  createdAt: timestamp('created_at').defaultNow(),
  events: jsonb('events').$type<TelemetryEvent[]>(),
}, (table) => ({
  sessionIdIdx: index('session_id_idx').on(table.sessionId),
}));
