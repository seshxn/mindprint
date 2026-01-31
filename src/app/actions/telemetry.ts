'use server';

import { db } from '@/db';
import { telemetryEvents } from '@/db/schema';
import { TelemetryEvent } from '@/hooks/useMindprintTelemetry';

export const ingestTelemetry = async (events: TelemetryEvent[]) => {
  if (events.length === 0) return;

  try {
    await db.insert(telemetryEvents).values({
      events: events,
      // sessionId: ... // Could extract from cookies or passed argument
    });
    console.log(`[Telemetry] Successfully ingested ${events.length} events.`);
  } catch (error) {
    console.error('[Telemetry] Failed to ingest events:', error);
  }
}
