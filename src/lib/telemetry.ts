import { TelemetryEvent, KeystrokeAction, TextOperationType } from '@/types/telemetry';

export type { TelemetryEvent, KeystrokeAction, TextOperationType };

export interface SessionTelemetry {
  events: TelemetryEvent[];
}

export type ValidationStatus = 'VERIFIED_HUMAN' | 'SUSPICIOUS' | 'LOW_EFFORT' | 'INSUFFICIENT_DATA';

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

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

const sampleStdDev = (values: number[]) => {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance = values.reduce((sum, value) => sum + Math.pow(value - avg, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
};

const percentile = (sortedValues: number[], p: number) => {
  if (sortedValues.length === 0) return 0;
  const index = clamp((sortedValues.length - 1) * p, 0, sortedValues.length - 1);
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
      type: 'keystroke',
      timestamp: performance.now(),
      action,
      key,
    });
    this.enforceLimit();
  }

  public recordPaste(length: number, source: string = 'clipboard') {
    this.events.push({
      type: 'paste',
      timestamp: performance.now(),
      length,
      source,
    });
    this.enforceLimit();
  }

  public recordOperation(op: TextOperationType, from: number, to: number, text: string) {
    this.events.push({
      type: 'operation',
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
  const typedComponent = clamp(typedChars / 80, 0, 1);
  const intervalComponent = clamp(typingIntervals.length / 120, 0, 1);
  return Number((typedComponent * 0.6 + intervalComponent * 0.4).toFixed(2));
};

export const validateSession = (events: TelemetryEvent[], currentContentLength: number): ValidationResult => {
  if (events.length === 0) {
    return {
      status: 'INSUFFICIENT_DATA',
      reason: 'No telemetry recorded for session.',
      metrics: {
        pasteRatio: 0,
        netContentLength: currentContentLength,
        riskScore: 50,
        confidence: 0,
        correctionRatio: 0,
        pauseRatePerMin: 0,
      },
    };
  }

  const pasteEvents = events.filter((event) => event.type === 'paste') as Extract<TelemetryEvent, { type: 'paste' }>[];
  const pastedChars = pasteEvents.reduce((acc, event) => acc + event.length, 0);

  const keystrokeEvents = events.filter((event) => event.type === 'keystroke') as Extract<
    TelemetryEvent,
    { type: 'keystroke' }
  >[];
  const typedCharEvents = keystrokeEvents.filter((event) => event.action === 'char');
  const typedChars = typedCharEvents.length;
  const deleteCount = keystrokeEvents.filter((event) => event.action === 'delete').length;
  const totalProduced = pastedChars + typedChars;

  if (totalProduced === 0) {
    return {
      status: 'INSUFFICIENT_DATA',
      reason: 'No content production actions recorded.',
      metrics: {
        pasteRatio: 0,
        netContentLength: currentContentLength,
        riskScore: 50,
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
    const diff = keystrokeEvents[i].timestamp - keystrokeEvents[i - 1].timestamp;
    if (Number.isFinite(diff) && diff > 0 && diff <= MAX_VALID_INTERVAL_MS) {
      typingIntervals.push(diff);
    }
  }

  const confidence = deriveConfidence(typedChars, typingIntervals);
  if (typedChars < MIN_TYPED_EVENTS_FOR_ANALYSIS || typingIntervals.length < MIN_TYPING_INTERVALS || confidence < 0.25) {
    return {
      status: 'INSUFFICIENT_DATA',
      reason: 'Collecting more behavioral data.',
      metrics: {
        pasteRatio,
        netContentLength: currentContentLength,
        riskScore: Math.round(50 + pasteRatio * 30),
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
  const p50 = percentile(sortedIntervals, 0.5);
  const p95 = percentile(sortedIntervals, 0.95);
  const burstiness = p50 > 0 ? p95 / p50 : 1;
  const pauses = typingIntervals.filter((value) => value >= LONG_PAUSE_MS).length;
  const durationMs =
    keystrokeEvents.length > 1 ? keystrokeEvents[keystrokeEvents.length - 1].timestamp - keystrokeEvents[0].timestamp : 0;
  const durationMinutes = durationMs > 0 ? durationMs / 60000 : 1;
  const pauseRatePerMin = pauses / durationMinutes;

  const pasteRisk = clamp((pasteRatio - 0.18) / 0.62, 0, 1);
  const regularityRisk = clamp((0.22 - cv) / 0.22, 0, 1);
  const varianceRisk = stdDev < LOW_VARIANCE_SD_MS ? 1 : 0;
  const burstRisk = clamp((burstiness - 4) / 8, 0, 1);
  const lowRevisionRisk = clamp((0.015 - correctionRatio) / 0.015, 0, 1);

  const baseRisk =
    pasteRisk * 0.4 + regularityRisk * 0.24 + varianceRisk * 0.18 + burstRisk * 0.1 + lowRevisionRisk * 0.08;
  const uncertaintyPenalty = (1 - confidence) * 0.18;
  const risk = clamp(baseRisk + uncertaintyPenalty, 0, 1);
  const riskScore = Math.round(risk * 100);

  if (pasteRatio >= 0.85 && typedChars < 24) {
    return {
      status: 'LOW_EFFORT',
      reason: `High external text injection (${(pasteRatio * 100).toFixed(1)}% pasted).`,
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

  if (risk >= 0.64) {
    return {
      status: 'SUSPICIOUS',
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
    status: 'VERIFIED_HUMAN',
    reason: `Human-like rhythm profile (confidence ${Math.round(confidence * 100)}%).`,
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
