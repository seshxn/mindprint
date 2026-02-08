import { useState, useRef, useCallback, useEffect } from "react";
import { KeystrokeAction, TelemetryEvent } from "@/types/telemetry";
import {
  validateSession,
  ValidationResult,
  TelemetryTracker,
} from "@/lib/telemetry";
import { ingestTelemetry, initTelemetrySession } from "@/app/actions/telemetry";

interface UseMindprintTelemetryOptions {
  batchInterval?: number;
  enabled?: boolean;
}

const MAX_UI_EVENTS = 4000;
const MIN_TYPED_EVENTS_FOR_WARMING = 10;
const VALIDATION_THROTTLE_MS = 400;
const TELEMETRY_INIT_MAX_ATTEMPTS = 4;
const TELEMETRY_INIT_BASE_RETRY_MS = 1200;

const diffText = (previousText: string, nextText: string) => {
  if (previousText === nextText) return null;

  let start = 0;
  const previousLength = previousText.length;
  const nextLength = nextText.length;

  while (
    start < previousLength &&
    start < nextLength &&
    previousText[start] === nextText[start]
  ) {
    start += 1;
  }

  let previousEnd = previousLength - 1;
  let nextEnd = nextLength - 1;
  while (
    previousEnd >= start &&
    nextEnd >= start &&
    previousText[previousEnd] === nextText[nextEnd]
  ) {
    previousEnd -= 1;
    nextEnd -= 1;
  }

  const removed = previousText.slice(start, previousEnd + 1);
  const inserted = nextText.slice(start, nextEnd + 1);

  if (removed.length === 0 && inserted.length > 0) {
    return { op: "insert" as const, from: start, to: start, text: inserted };
  }
  if (removed.length > 0 && inserted.length === 0) {
    return {
      op: "delete" as const,
      from: start,
      to: start + removed.length,
      text: "",
    };
  }
  return {
    op: "replace" as const,
    from: start,
    to: start + removed.length,
    text: inserted,
  };
};

export const useMindprintTelemetry = ({
  batchInterval = 5000,
  enabled = true,
}: UseMindprintTelemetryOptions = {}) => {
  const trackerRef = useRef<TelemetryTracker>(new TelemetryTracker());
  const uiEventsRef = useRef<(TelemetryEvent | null)[]>(
    new Array(MAX_UI_EVENTS).fill(null),
  );
  const uiEventsHeadRef = useRef<number>(0);
  const uiEventsTotalRef = useRef<number>(0);
  const lastValidationTimeRef = useRef<number>(0);
  const lastTextRef = useRef<string>("");
  const batchSequenceRef = useRef<number>(0);
  const initInFlightRef = useRef<boolean>(false);
  const sessionRef = useRef<{ sessionId: string; sessionToken: string } | null>(
    null,
  );

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult>({
    status: "INSUFFICIENT_DATA",
  });
  const [isWarming, setIsWarming] = useState(false);
  const [telemetryReady, setTelemetryReady] = useState(false);
  const [telemetryError, setTelemetryError] = useState<string | null>(null);
  const [telemetryInitializing, setTelemetryInitializing] = useState(false);
  const [initCycle, setInitCycle] = useState(0);

  const wait = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));

  const addToUiBuffer = useCallback((event: TelemetryEvent) => {
    uiEventsRef.current[uiEventsHeadRef.current] = event;
    uiEventsHeadRef.current = (uiEventsHeadRef.current + 1) % MAX_UI_EVENTS;
    uiEventsTotalRef.current = Math.min(
      uiEventsTotalRef.current + 1,
      MAX_UI_EVENTS,
    );
  }, []);

  const getUiEventsInternal = useCallback(() => {
    const result: TelemetryEvent[] = [];
    const total = uiEventsTotalRef.current;
    const head = uiEventsHeadRef.current;

    if (total < MAX_UI_EVENTS) {
      for (let i = 0; i < total; i += 1) {
        const event = uiEventsRef.current[i];
        if (event) result.push(event);
      }
      return result;
    }

    for (let i = 0; i < MAX_UI_EVENTS; i += 1) {
      const event = uiEventsRef.current[(head + i) % MAX_UI_EVENTS];
      if (event) result.push(event);
    }
    return result;
  }, []);

  const retryTelemetryInit = useCallback(() => {
    if (!enabled || sessionRef.current || initInFlightRef.current) return;
    setTelemetryReady(false);
    setInitCycle((previous) => previous + 1);
  }, [enabled]);

  useEffect(() => {
    if (!enabled || sessionRef.current || initInFlightRef.current) return;
    let cancelled = false;
    initInFlightRef.current = true;

    const start = async () => {
      setTelemetryInitializing(true);
      setTelemetryError(null);
      for (
        let attempt = 1;
        attempt <= TELEMETRY_INIT_MAX_ATTEMPTS && !cancelled;
        attempt += 1
      ) {
        try {
          const initialized = await initTelemetrySession();
          if (cancelled) return;
          sessionRef.current = {
            sessionId: initialized.sessionId,
            sessionToken: initialized.sessionToken,
          };
          setSessionId(initialized.sessionId);
          setTelemetryReady(true);
          setTelemetryError(null);
          return;
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Unknown telemetry initialization error.";
          console.error(
            `[Mindprint Telemetry] Failed to initialize session (attempt ${attempt}/${TELEMETRY_INIT_MAX_ATTEMPTS}).`,
            error,
          );
          if (!cancelled) {
            setTelemetryError(message);
          }
          if (attempt < TELEMETRY_INIT_MAX_ATTEMPTS) {
            const jitter = Math.floor(Math.random() * 200);
            const delay =
              TELEMETRY_INIT_BASE_RETRY_MS * attempt + jitter;
            await wait(delay);
          }
        }
      }
    };

    void start().finally(() => {
      initInFlightRef.current = false;
      if (!cancelled) {
        setTelemetryInitializing(false);
      }
    });
    return () => {
      cancelled = true;
      initInFlightRef.current = false;
    };
  }, [enabled, initCycle]);

  useEffect(() => {
    if (!enabled) return;

    const flushEvents = async () => {
      const session = sessionRef.current;
      if (!session) return;
      const events = trackerRef.current.getEvents();
      if (events.length === 0) return;

      const nextSequence = batchSequenceRef.current + 1;
      try {
        await ingestTelemetry(events, session.sessionId, {
          sessionToken: session.sessionToken,
          batchSequence: nextSequence,
        });
        batchSequenceRef.current = nextSequence;
        trackerRef.current.clear();
      } catch (error) {
        console.error("[Mindprint Telemetry] Failed to flush events.", error);
      }
    };

    const intervalId = setInterval(flushEvents, batchInterval);
    return () => {
      clearInterval(intervalId);
      void flushEvents();
    };
  }, [batchInterval, enabled]);

  const trackKeystroke = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      let action: KeystrokeAction = "other";
      if (
        event.key.length === 1 &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        action = "char";
      } else if (event.key === "Backspace" || event.key === "Delete") {
        action = "delete";
      } else if (
        event.key.startsWith("Arrow") ||
        event.key === "Home" ||
        event.key === "End" ||
        event.key === "PageUp" ||
        event.key === "PageDown"
      ) {
        action = "nav";
      }

      trackerRef.current.recordKeystroke(action, event.key);
      addToUiBuffer({
        type: "keystroke",
        timestamp: performance.now(),
        action,
        key: event.key,
      });
    },
    [addToUiBuffer, enabled],
  );

  const trackPaste = useCallback(
    (event: ClipboardEvent) => {
      if (!enabled) return;
      const text = event.clipboardData?.getData("text") || "";
      trackerRef.current.recordPaste(text.length, "clipboard");
      addToUiBuffer({
        type: "paste",
        timestamp: performance.now(),
        length: text.length,
        source: "clipboard",
      });
    },
    [addToUiBuffer, enabled],
  );

  const trackContentMutation = useCallback(
    (nextText: string) => {
      if (!enabled) return;
      const diff = diffText(lastTextRef.current, nextText);
      lastTextRef.current = nextText;
      if (!diff) return;
      trackerRef.current.recordOperation(
        diff.op,
        diff.from,
        diff.to,
        diff.text,
      );
      addToUiBuffer({
        type: "operation",
        timestamp: performance.now(),
        op: diff.op,
        from: diff.from,
        to: diff.to,
        text: diff.text,
      });
    },
    [addToUiBuffer, enabled],
  );

  const updateValidation = useCallback(
    (currentContentLength: number) => {
      if (!enabled) return;
      const now = performance.now();
      if (now - lastValidationTimeRef.current < VALIDATION_THROTTLE_MS) return;
      lastValidationTimeRef.current = now;

      const uiEvents = getUiEventsInternal();
      const typedCount = uiEvents.filter(
        (event) => event.type === "keystroke" && event.action === "char",
      ).length;
      setIsWarming(typedCount > 0 && typedCount < MIN_TYPED_EVENTS_FOR_WARMING);
      const result = validateSession(uiEvents, currentContentLength);
      setValidationResult(result);
    },
    [enabled, getUiEventsInternal],
  );

  const getUiEvents = useCallback(
    () => getUiEventsInternal(),
    [getUiEventsInternal],
  );

  return {
    trackKeystroke,
    trackPaste,
    trackContentMutation,
    updateValidation,
    validationResult,
    getUiEvents,
    isWarming,
    sessionId,
    telemetryError,
    telemetryInitializing,
    telemetryReady,
    retryTelemetryInit,
  };
};
