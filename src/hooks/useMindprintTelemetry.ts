import { useEffect, useRef } from 'react';

export type TelemetryEvent = 
  | { type: 'keystroke'; timestamp: number; key: string }
  | { type: 'paste'; timestamp: number; charCount: number; source: string };

interface UseMindprintTelemetryOptions {
  batchInterval?: number; // in ms, default 5000
  enabled?: boolean;
}

import { ingestTelemetry } from '@/app/actions/telemetry';

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
        
        console.log('[Mindprint Telemetry] Flushing batch:', batch.length);
        await ingestTelemetry(batch);
      }
    };

    const intervalId = setInterval(flushEvents, batchInterval);

    return () => {
      clearInterval(intervalId);
      flushEvents(); // Flush remaining on unmount
    };
  }, [batchInterval, enabled]);

  // Tiptap passes native DOM events
  const trackKeystroke = (e: KeyboardEvent) => {
    if (!enabled) return;
    eventsRef.current.push({
      type: 'keystroke',
      timestamp: Date.now(),
      key: e.key,
    });
  };

  const trackPaste = (e: ClipboardEvent) => {
    if (!enabled) return;
    const text = e.clipboardData?.getData('text') || '';
    eventsRef.current.push({
      type: 'paste',
      timestamp: Date.now(),
      charCount: text.length,
      source: 'clipboard',
    });
  };

  return {
    trackKeystroke,
    trackPaste,
  };
}
