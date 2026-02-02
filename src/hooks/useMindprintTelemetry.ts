import { useState, useRef, useCallback, useEffect } from 'react';
import {
  TelemetryEvent,
  KeystrokeAction
} from '@/types/telemetry';
import { validateSession, ValidationResult } from '@/lib/telemetry';
import { ingestTelemetry } from '@/app/actions/telemetry';

interface UseMindprintTelemetryOptions {
  enabled?: boolean;
  batchInterval?: number;
}

export const useMindprintTelemetry = ({
  enabled = true,
  batchInterval = 5000,
}: UseMindprintTelemetryOptions = {}) => {
  const eventsRef = useRef<TelemetryEvent[]>([]);
  const [validationResult, setValidationResult] = useState<ValidationResult>({ status: 'INSUFFICIENT_DATA' });

  // Ingestion Effect (from main)
  useEffect(() => {
    if (!enabled) return;

    const flushEvents = async () => {
      if (eventsRef.current.length > 0) {
        const batch = [...eventsRef.current];
        eventsRef.current = []; // Clear immediately

        try {
          // console.log('[Mindprint Telemetry] Flushing batch:', batch.length);
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

  const trackKeystroke = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;

    let action: KeystrokeAction = 'other';
    // Logic from HEAD
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      action = 'char';
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      action = 'delete';
    } else if (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End' || e.key === 'PageUp' || e.key === 'PageDown') {
      action = 'nav';
    }

    eventsRef.current.push({
      type: 'keystroke',
      timestamp: performance.now(),
      action,
      key: e.key // Required by unified type
    });
  }, [enabled]);

  const trackPaste = useCallback((e: ClipboardEvent) => {
    if (!enabled) return;
    const text = e.clipboardData?.getData('text') || '';
    const length = text.length;
    eventsRef.current.push({
      type: 'paste',
      timestamp: performance.now(),
      length: length,      // Compat
      charCount: length,   // Compat
      source: 'clipboard'  // Required by unified type
    });
  }, [enabled]);

  const updateValidation = useCallback((currentContentLength: number) => {
    if (!enabled) return;
    // validateSession logic from HEAD
    const result = validateSession(eventsRef.current, currentContentLength);
    setValidationResult(result);
  }, [enabled]);

  const getEvents = useCallback(() => {
    return [...eventsRef.current];
  }, []);

  return {
    trackKeystroke,
    trackPaste,
    updateValidation,
    validationResult,
    getEvents
  };
}
