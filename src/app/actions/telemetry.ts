'use server';

import { db } from '@/db';
import { telemetryEvents } from '@/db/schema';
import { TelemetryEvent } from '@/types/telemetry';

export const ingestTelemetry = async (events: TelemetryEvent[], sessionId?: string) => {
  if (events.length === 0) return;

  try {
    await db.insert(telemetryEvents).values({
      events: events,
      sessionId: sessionId,
    });
    console.log(`[Telemetry] Successfully ingested ${events.length} events.`);
  } catch (error) {
    console.error('[Telemetry] Failed to ingest events:', error);
    throw error;
  }
}
