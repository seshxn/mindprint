import {
  TelemetryEvent,
  KeystrokeAction,
  TextOperationType,
} from "@/types/telemetry";

export type { TelemetryEvent, KeystrokeAction, TextOperationType };

export interface SessionTelemetry {
  events: TelemetryEvent[];
}

export type ValidationStatus =
  | "VERIFIED_HUMAN"
  | "SUSPICIOUS"
  | "LOW_EFFORT"
  | "INSUFFICIENT_DATA";

export type ValidationResult = {
  status: ValidationStatus;
  reason?: string;
  metrics?: {
    pasteRatio: number;
    cv?: number;
    netContentLength: number;
    riskScore: number;
    confidence: number;
    correctionRatio: number;
    pauseRatePerMin: number;
  };
};

const MIN_TYPED_EVENTS_FOR_ANALYSIS = 12;
const MIN_TYPING_INTERVALS = 6;
const MAX_VALID_INTERVAL_MS = 6000;
const LONG_PAUSE_MS = 2000;
const LOW_VARIANCE_SD_MS = 12;
const MAX_EVENTS_HISTORY = 12000;
const EVENTS_TRIM_TARGET = 10000;
const DEFAULT_INSUFFICIENT_RISK_SCORE = 50;
const INSUFFICIENT_CONFIDENCE_THRESHOLD = 0.25;
const INSUFFICIENT_RISK_PASTE_MULTIPLIER = 30;
const MEDIAN_PERCENTILE = 0.5;
const HIGH_PERCENTILE = 0.95;
const PERCENT_SCALE = 100;

const CONFIDENCE_MODEL = {
  typedCharsTarget: 80,
  typingIntervalsTarget: 120,
  typedCharsWeight: 0.6,
  typingIntervalsWeight: 0.4,
} as const;

const RISK_MODEL = {
  paste: {
    threshold: 0.18,
    span: 0.62,
    weight: 0.4,
  },
  regularity: {
    cvThreshold: 0.22,
    weight: 0.24,
  },
  variance: {
    sdThreshold: LOW_VARIANCE_SD_MS,
    weight: 0.18,
  },
  burst: {
    threshold: 4,
    span: 8,
    weight: 0.1,
  },
  lowRevision: {
    threshold: 0.015,
    weight: 0.08,
  },
  uncertaintyPenaltyWeight: 0.18,
  suspiciousRiskThreshold: 0.64,
  lowEffortPasteThreshold: 0.85,
  lowEffortTypedCharsThreshold: 24,
} as const;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const mean = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

const sampleStdDev = (values: number[]) => {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance =
    values.reduce((sum, value) => sum + Math.pow(value - avg, 2), 0) /
    (values.length - 1);
  return Math.sqrt(variance);
};

const percentile = (sortedValues: number[], p: number) => {
  if (sortedValues.length === 0) return 0;
  const index = clamp(
    (sortedValues.length - 1) * p,
    0,
    sortedValues.length - 1,
  );
  const low = Math.floor(index);
  const high = Math.ceil(index);
  if (low === high) return sortedValues[low];
  const weight = index - low;
  return sortedValues[low] * (1 - weight) + sortedValues[high] * weight;
};

export class TelemetryTracker {
  private events: TelemetryEvent[] = [];

  public recordKeystroke(action: KeystrokeAction, key: string) {
    this.events.push({
      type: "keystroke",
      timestamp: performance.now(),
      action,
      key,
    });
    this.enforceLimit();
  }

  public recordPaste(length: number, source: string = "clipboard") {
    this.events.push({
      type: "paste",
      timestamp: performance.now(),
      length,
      source,
    });
    this.enforceLimit();
  }

  public recordOperation(
    op: TextOperationType,
    from: number,
    to: number,
    text: string,
  ) {
    this.events.push({
      type: "operation",
      timestamp: performance.now(),
      op,
      from,
      to,
      text,
    });
    this.enforceLimit();
  }

  private enforceLimit() {
    if (this.events.length > MAX_EVENTS_HISTORY) {
      this.events.splice(0, this.events.length - EVENTS_TRIM_TARGET);
    }
  }

  public getEvents(): TelemetryEvent[] {
    return [...this.events];
  }

  public clear() {
    this.events = [];
  }
}

const deriveConfidence = (typedChars: number, typingIntervals: number[]) => {
  const typedComponent = clamp(
    typedChars / CONFIDENCE_MODEL.typedCharsTarget,
    0,
    1,
  );
  const intervalComponent = clamp(
    typingIntervals.length / CONFIDENCE_MODEL.typingIntervalsTarget,
    0,
    1,
  );
  return Number(
    (
      typedComponent * CONFIDENCE_MODEL.typedCharsWeight +
      intervalComponent * CONFIDENCE_MODEL.typingIntervalsWeight
    ).toFixed(2),
  );
};

export const validateSession = (
  events: TelemetryEvent[],
  currentContentLength: number,
): ValidationResult => {
  if (events.length === 0) {
    return {
      status: "INSUFFICIENT_DATA",
      reason: "No telemetry recorded for session.",
      metrics: {
        pasteRatio: 0,
        netContentLength: currentContentLength,
        riskScore: DEFAULT_INSUFFICIENT_RISK_SCORE,
        confidence: 0,
        correctionRatio: 0,
        pauseRatePerMin: 0,
      },
    };
  }

  const pasteEvents = events.filter(
    (event) => event.type === "paste",
  ) as Extract<TelemetryEvent, { type: "paste" }>[];
  const pastedChars = pasteEvents.reduce((acc, event) => acc + event.length, 0);

  const keystrokeEvents = events.filter(
    (event) => event.type === "keystroke",
  ) as Extract<TelemetryEvent, { type: "keystroke" }>[];
  const typedCharEvents = keystrokeEvents.filter(
    (event) => event.action === "char",
  );
  const typedChars = typedCharEvents.length;
  const deleteCount = keystrokeEvents.filter(
    (event) => event.action === "delete",
  ).length;
  const totalProduced = pastedChars + typedChars;

  if (totalProduced === 0) {
    return {
      status: "INSUFFICIENT_DATA",
      reason: "No content production actions recorded.",
      metrics: {
        pasteRatio: 0,
        netContentLength: currentContentLength,
        riskScore: DEFAULT_INSUFFICIENT_RISK_SCORE,
        confidence: 0,
        correctionRatio: 0,
        pauseRatePerMin: 0,
      },
    };
  }

  const pasteRatio = pastedChars / totalProduced;
  const correctionRatio = typedChars > 0 ? deleteCount / typedChars : 0;

  const typingIntervals: number[] = [];
  for (let i = 1; i < keystrokeEvents.length; i += 1) {
    const diff =
      keystrokeEvents[i].timestamp - keystrokeEvents[i - 1].timestamp;
    if (Number.isFinite(diff) && diff > 0 && diff <= MAX_VALID_INTERVAL_MS) {
      typingIntervals.push(diff);
    }
  }

  const confidence = deriveConfidence(typedChars, typingIntervals);
  if (
    typedChars < MIN_TYPED_EVENTS_FOR_ANALYSIS ||
    typingIntervals.length < MIN_TYPING_INTERVALS ||
    confidence < INSUFFICIENT_CONFIDENCE_THRESHOLD
  ) {
    return {
      status: "INSUFFICIENT_DATA",
      reason: "Collecting more behavioral data.",
      metrics: {
        pasteRatio,
        netContentLength: currentContentLength,
        riskScore: Math.round(
          DEFAULT_INSUFFICIENT_RISK_SCORE +
            pasteRatio * INSUFFICIENT_RISK_PASTE_MULTIPLIER,
        ),
        confidence,
        correctionRatio: Number(correctionRatio.toFixed(3)),
        pauseRatePerMin: 0,
      },
    };
  }

  const avgInterval = mean(typingIntervals);
  const stdDev = sampleStdDev(typingIntervals);
  const cv = avgInterval > 0 ? stdDev / avgInterval : 0;
  const sortedIntervals = [...typingIntervals].sort((a, b) => a - b);
  const p50 = percentile(sortedIntervals, MEDIAN_PERCENTILE);
  const p95 = percentile(sortedIntervals, HIGH_PERCENTILE);
  const burstiness = p50 > 0 ? p95 / p50 : 1;
  const pauses = typingIntervals.filter(
    (value) => value >= LONG_PAUSE_MS,
  ).length;
  const durationMs =
    keystrokeEvents.length > 1
      ? keystrokeEvents[keystrokeEvents.length - 1].timestamp -
        keystrokeEvents[0].timestamp
      : 0;
  const durationMinutes = durationMs > 0 ? durationMs / 60000 : 1;
  const pauseRatePerMin = pauses / durationMinutes;

  const pasteRisk = clamp(
    (pasteRatio - RISK_MODEL.paste.threshold) / RISK_MODEL.paste.span,
    0,
    1,
  );
  const regularityRisk = clamp(
    (RISK_MODEL.regularity.cvThreshold - cv) / RISK_MODEL.regularity.cvThreshold,
    0,
    1,
  );
  const varianceRisk = stdDev < RISK_MODEL.variance.sdThreshold ? 1 : 0;
  const burstRisk = clamp(
    (burstiness - RISK_MODEL.burst.threshold) / RISK_MODEL.burst.span,
    0,
    1,
  );
  const lowRevisionRisk = clamp(
    (RISK_MODEL.lowRevision.threshold - correctionRatio) /
      RISK_MODEL.lowRevision.threshold,
    0,
    1,
  );

  const baseRisk =
    pasteRisk * RISK_MODEL.paste.weight +
    regularityRisk * RISK_MODEL.regularity.weight +
    varianceRisk * RISK_MODEL.variance.weight +
    burstRisk * RISK_MODEL.burst.weight +
    lowRevisionRisk * RISK_MODEL.lowRevision.weight;
  const uncertaintyPenalty =
    (1 - confidence) * RISK_MODEL.uncertaintyPenaltyWeight;
  const risk = clamp(baseRisk + uncertaintyPenalty, 0, 1);
  const riskScore = Math.round(risk * PERCENT_SCALE);

  if (
    pasteRatio >= RISK_MODEL.lowEffortPasteThreshold &&
    typedChars < RISK_MODEL.lowEffortTypedCharsThreshold
  ) {
    return {
      status: "LOW_EFFORT",
      reason: `High external text injection (${(pasteRatio * PERCENT_SCALE).toFixed(1)}% pasted).`,
      metrics: {
        pasteRatio,
        cv: Number(cv.toFixed(3)),
        netContentLength: currentContentLength,
        riskScore,
        confidence,
        correctionRatio: Number(correctionRatio.toFixed(3)),
        pauseRatePerMin: Number(pauseRatePerMin.toFixed(2)),
      },
    };
  }

  if (risk >= RISK_MODEL.suspiciousRiskThreshold) {
    return {
      status: "SUSPICIOUS",
      reason: `Anomalous rhythm profile (risk ${riskScore}/100).`,
      metrics: {
        pasteRatio,
        cv: Number(cv.toFixed(3)),
        netContentLength: currentContentLength,
        riskScore,
        confidence,
        correctionRatio: Number(correctionRatio.toFixed(3)),
        pauseRatePerMin: Number(pauseRatePerMin.toFixed(2)),
      },
    };
  }

  return {
    status: "VERIFIED_HUMAN",
    reason: `Human-like rhythm profile (confidence ${Math.round(confidence * PERCENT_SCALE)}%).`,
    metrics: {
      pasteRatio,
      cv: Number(cv.toFixed(3)),
      netContentLength: currentContentLength,
      riskScore,
      confidence,
      correctionRatio: Number(correctionRatio.toFixed(3)),
      pauseRatePerMin: Number(pauseRatePerMin.toFixed(2)),
    },
  };
};
