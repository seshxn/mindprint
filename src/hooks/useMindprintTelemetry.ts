import { useEffect, useRef, useCallback } from 'react';

type TelemetryEvent = 
  | { type: 'keystroke'; timestamp: number; key: string }
  | { type: 'paste'; timestamp: number; charCount: number; source: string };

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

    const flushEvents = () => {
      // Atomically get and clear events to prevent race conditions.
      const eventsToFlush = eventsRef.current.splice(0);
      if (eventsToFlush.length > 0) {
        // TODO: Replace with a call to a real telemetry service
        console.log('[Mindprint Telemetry] Batched Events:', eventsToFlush);
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
