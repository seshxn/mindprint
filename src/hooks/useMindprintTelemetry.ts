import { useState, useRef, useCallback, useEffect } from 'react';
import { KeystrokeAction, TelemetryEvent } from '@/types/telemetry';
import { validateSession, ValidationResult, TelemetryTracker } from '@/lib/telemetry';
import { ingestTelemetry } from '@/app/actions/telemetry';

interface UseMindprintTelemetryOptions {
  enabled?: boolean;
  batchInterval?: number;
}

export const useMindprintTelemetry = ({
  enabled = true,
  batchInterval = 5000,
}: UseMindprintTelemetryOptions = {}) => {
  // Use the tracker class for internal logic (capping, etc.)
  const trackerRef = useRef<TelemetryTracker>(new TelemetryTracker());
  const uiEventsRef = useRef<TelemetryEvent[]>([]);
  const [validationResult, setValidationResult] = useState<ValidationResult>({ status: 'INSUFFICIENT_DATA' });
  const [isWarming, setIsWarming] = useState(false);

  const MAX_UI_EVENTS = 2000;
  const MIN_TYPED_EVENTS_FOR_WARMING = 10;

  // Ingestion Effect (Matches logic from main, but clears tracker instead of raw array)
  useEffect(() => {
    if (!enabled) return;

    const flushEvents = async () => {
      const events = trackerRef.current.getEvents();
      if (events.length > 0) {
        try {
          await ingestTelemetry(events);
          trackerRef.current.clear();
        } catch (error) {
          console.error('[Mindprint Telemetry] Failed to flush events.', error);
          // Events are not cleared on failure and will be retried in the next flush.
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
    uiEventsRef.current.push({
      type: 'keystroke',
      timestamp: performance.now(),
      action,
      key: e.key
    });
    if (uiEventsRef.current.length > MAX_UI_EVENTS) {
      uiEventsRef.current.shift();
    }
  }, [enabled]);

  const trackPaste = useCallback((e: ClipboardEvent) => {
    if (!enabled) return;
    const text = e.clipboardData?.getData('text') || '';
    trackerRef.current.recordPaste(text.length, 'clipboard');
    uiEventsRef.current.push({
      type: 'paste',
      timestamp: performance.now(),
      length: text.length,
      source: 'clipboard'
    });
    if (uiEventsRef.current.length > MAX_UI_EVENTS) {
      uiEventsRef.current.shift();
    }
  }, [enabled]);

  const updateValidation = useCallback((currentContentLength: number) => {
    if (!enabled) return;
    // validateSession logic from HEAD
    const uiEvents = uiEventsRef.current;
    const typedCount = uiEvents.filter(
      (event) => event.type === 'keystroke' && event.action === 'char'
    ).length;
    setIsWarming(typedCount > 0 && typedCount < MIN_TYPED_EVENTS_FOR_WARMING);
    const result = validateSession(uiEvents, currentContentLength);
    setValidationResult(result);
  }, [enabled]);

  const getEvents = useCallback(() => {
    return trackerRef.current.getEvents();
  }, []);

  const getUiEvents = useCallback(() => {
    return [...uiEventsRef.current];
  }, []);

  return {
    trackKeystroke,
    trackPaste,
    updateValidation,
    validationResult,
    getEvents,
    getUiEvents,
    isWarming
  };
}
