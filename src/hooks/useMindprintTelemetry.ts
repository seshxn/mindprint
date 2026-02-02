import { useEffect, useRef, useCallback } from 'react';
import { TelemetryEvent } from '@/types/telemetry';
import { ingestTelemetry } from '@/app/actions/telemetry';

interface UseMindprintTelemetryOptions {
  batchInterval?: number; // in ms, default 5000
  enabled?: boolean;
}

export const useMindprintTelemetry = ({
  batchInterval = 5000,
  enabled = true,
}: UseMindprintTelemetryOptions = {}) => {
  const eventsRef = useRef<TelemetryEvent[]>([]);

  useEffect(() => {
    if (!enabled) return;

    const flushEvents = async () => {
      if (eventsRef.current.length > 0) {
        const batch = [...eventsRef.current];
        eventsRef.current = []; // Clear immediately
        
        try {
          console.log('[Mindprint Telemetry] Flushing batch:', batch.length);
          await ingestTelemetry(batch);
        } catch (error) {
          console.error('[Mindprint Telemetry] Failed to flush events, re-queueing.', error);
          // If ingestion fails, prepend the failed batch to be retried.
          eventsRef.current.unshift(...batch);
        }
      }
    };

    const intervalId = setInterval(flushEvents, batchInterval);

    return () => {
      clearInterval(intervalId);
      flushEvents(); // Flush remaining on unmount
    };
  }, [batchInterval, enabled]);

  // Tiptap passes native DOM events
  const trackKeystroke = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;
    eventsRef.current.push({
      type: 'keystroke',
      timestamp: Date.now(),
      key: e.key,
    });
  }, [enabled]);

  const trackPaste = useCallback((e: ClipboardEvent) => {
    if (!enabled) return;
    const text = e.clipboardData?.getData('text') || '';
    eventsRef.current.push({
      type: 'paste',
      timestamp: Date.now(),
      charCount: text.length,
      source: 'clipboard',
    });
  }, [enabled]);

  return {
    trackKeystroke,
    trackPaste,
  };
}
