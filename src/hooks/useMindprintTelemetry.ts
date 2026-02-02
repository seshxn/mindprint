import { useState, useRef, useCallback } from 'react';
import {
  TelemetryEvent,
  validateSession,
  ValidationResult,
  KeystrokeAction
} from '@/lib/telemetry';

interface UseMindprintTelemetryOptions {
  enabled?: boolean;
}

export const useMindprintTelemetry = ({
  enabled = true,
}: UseMindprintTelemetryOptions = {}) => {
  const eventsRef = useRef<TelemetryEvent[]>([]);
  const [validationResult, setValidationResult] = useState<ValidationResult>({ status: 'INSUFFICIENT_DATA' });

  const trackKeystroke = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;

    let action: KeystrokeAction = 'other';
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
      action
    });
  }, [enabled]);

  const trackPaste = useCallback((e: ClipboardEvent) => {
    if (!enabled) return;
    const text = e.clipboardData?.getData('text') || '';
    eventsRef.current.push({
      type: 'paste',
      timestamp: performance.now(),
      length: text.length,
    });
  }, [enabled]);

  const updateValidation = useCallback((currentContentLength: number) => {
    if (!enabled) return;
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
