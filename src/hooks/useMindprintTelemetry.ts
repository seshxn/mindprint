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
  const MAX_UI_EVENTS = 2000;
  const uiEventsRef = useRef<(TelemetryEvent | null)[]>(new Array(MAX_UI_EVENTS).fill(null));
  const uiEventsHeadRef = useRef<number>(0);
  const uiEventsTotalRef = useRef<number>(0);

  const [validationResult, setValidationResult] = useState<ValidationResult>({ status: 'INSUFFICIENT_DATA' });
  const [isWarming, setIsWarming] = useState(false);
  const lastValidationTimeRef = useRef<number>(0);
  const validationThrottleMs = 500; // Throttle validation to run at most every 500ms

  const MIN_TYPED_EVENTS_FOR_WARMING = 10;

  // Helper to add event to buffer with O(1) circular insertion
  const addToUiBuffer = useCallback((event: TelemetryEvent) => {
    uiEventsRef.current[uiEventsHeadRef.current] = event;
    uiEventsHeadRef.current = (uiEventsHeadRef.current + 1) % MAX_UI_EVENTS;
    uiEventsTotalRef.current = Math.min(uiEventsTotalRef.current + 1, MAX_UI_EVENTS);
  }, [MAX_UI_EVENTS]);

  // Helper to get events in chronological order from circular buffer
  const getUiEventsInternal = useCallback(() => {
    const result: TelemetryEvent[] = [];
    const total = uiEventsTotalRef.current;
    const size = MAX_UI_EVENTS;
    const head = uiEventsHeadRef.current;

    if (total < size) {
      for (let i = 0; i < total; i++) {
        const ev = uiEventsRef.current[i];
        if (ev) result.push(ev);
      }
    } else {
      for (let i = 0; i < size; i++) {
        const ev = uiEventsRef.current[(head + i) % size];
        if (ev) result.push(ev);
      }
    }
    return result;
  }, [MAX_UI_EVENTS]);

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
    addToUiBuffer({
      type: 'keystroke',
      timestamp: performance.now(),
      action,
      key: e.key
    });
  }, [enabled, addToUiBuffer]);

  const trackPaste = useCallback((e: ClipboardEvent) => {
    if (!enabled) return;
    const text = e.clipboardData?.getData('text') || '';
    trackerRef.current.recordPaste(text.length, 'clipboard');
    addToUiBuffer({
      type: 'paste',
      timestamp: performance.now(),
      length: text.length,
      source: 'clipboard'
    });
  }, [enabled, addToUiBuffer]);

  const updateValidation = useCallback((currentContentLength: number) => {
    if (!enabled) return;

    // Throttle validation to avoid expensive computation on every keystroke
    const now = performance.now();
    if (now - lastValidationTimeRef.current < validationThrottleMs) {
      return;
    }
    lastValidationTimeRef.current = now;

    // validateSession logic from HEAD
    const uiEvents = getUiEventsInternal();
    const typedCount = uiEvents.filter(
      (event) => event.type === 'keystroke' && event.action === 'char'
    ).length;
    setIsWarming(typedCount > 0 && typedCount < MIN_TYPED_EVENTS_FOR_WARMING);
    const result = validateSession(uiEvents, currentContentLength);
    setValidationResult(result);
  }, [enabled, validationThrottleMs, getUiEventsInternal]);

  const getEvents = useCallback(() => {
    return trackerRef.current.getEvents();
  }, []);

  const getUiEvents = useCallback(() => {
    return getUiEventsInternal();
  }, [getUiEventsInternal]);

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
