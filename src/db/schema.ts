import { pgTable, text, serial, timestamp, jsonb } from 'drizzle-orm/pg-core';

type TelemetryEvent = 
  | { type: 'keystroke'; timestamp: number; key: string }
  | { type: 'paste'; timestamp: number; charCount: number; source: string };

export const telemetryEvents = pgTable('telemetry_events', {
  id: serial('id').primaryKey(),
  sessionId: text('session_id'), // Optional session identifier
  createdAt: timestamp('created_at').defaultNow(),
  events: jsonb('events').$type<TelemetryEvent[]>(),
});
