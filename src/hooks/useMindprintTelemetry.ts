import { useState, useRef, useCallback, useEffect } from 'react';
import {
  KeystrokeAction
} from '@/types/telemetry';
import { validateSession, ValidationResult, TelemetryTracker } from '@/lib/telemetry';
import { ingestTelemetry } from '@/app/actions/telemetry';

interface UseMindprintTelemetryOptions {
  batchInterval?: number;
  enabled?: boolean;
  sessionId?: string;
}

export const useMindprintTelemetry = ({
  batchInterval = 5000,
  enabled = true,
  sessionId,
}: UseMindprintTelemetryOptions = {}) => {
  // Use the tracker class for internal logic (capping, etc.)
  const trackerRef = useRef<TelemetryTracker>(new TelemetryTracker());
  const [validationResult, setValidationResult] = useState<ValidationResult>({ status: 'INSUFFICIENT_DATA' });

  // Ingestion Effect (Matches logic from main, but clears tracker instead of raw array)
  useEffect(() => {
    if (!enabled) return;

    const flushEvents = async () => {
      const events = trackerRef.current.getEvents();
      if (events.length > 0) {
        try {
          console.log('[Mindprint Telemetry] Flushing batch:', events.length);
          await ingestTelemetry(events, sessionId);
          trackerRef.current.clear();
        } catch (error) {
          console.error('[Mindprint Telemetry] Failed to flush events.', error);
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

    trackerRef.current.recordKeystroke(action, e.key);
  }, [enabled]);

  const trackPaste = useCallback((e: ClipboardEvent) => {
    if (!enabled) return;
    const text = e.clipboardData?.getData('text') || '';
    trackerRef.current.recordPaste(text.length, 'clipboard');
  }, [enabled]);

  const updateValidation = useCallback((currentContentLength: number) => {
    if (!enabled) return;
    // validateSession logic from HEAD
    const result = validateSession(trackerRef.current.getEvents(), currentContentLength);
    setValidationResult(result);
  }, [enabled]);

  const getEvents = useCallback(() => {
    return trackerRef.current.getEvents();
  }, []);

  return {
    trackKeystroke,
    trackPaste,
    updateValidation,
    validationResult,
    getEvents
  };
}
