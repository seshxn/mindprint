export type KeystrokeAction = 'char' | 'delete' | 'nav' | 'other';

export type TelemetryEvent =
    | { type: 'keystroke'; timestamp: number; action: KeystrokeAction }
    | { type: 'paste'; timestamp: number; length: number };

export interface SessionTelemetry {
    events: TelemetryEvent[];
    // We can track other aggregates here if needed
}

export type ValidationStatus = 'VERIFIED_HUMAN' | 'SUSPICIOUS' | 'LOW_EFFORT' | 'INSUFFICIENT_DATA';

export type ValidationResult = {
    status: ValidationStatus;
    reason?: string;
    metrics?: {
        pasteRatio: number;
        cv?: number;
        netContentLength: number;
    };
};

export class TelemetryTracker {
    private events: TelemetryEvent[] = [];

    public recordKeystroke(action: KeystrokeAction) {
        this.events.push({
            type: 'keystroke',
            timestamp: performance.now(),
            action
        });
    }

    public recordPaste(length: number) {
        this.events.push({
            type: 'paste',
            timestamp: performance.now(),
            length
        });
    }

    public getEvents(): TelemetryEvent[] {
        return [...this.events];
    }

    public clear() {
        this.events = [];
    }
}

export const validateSession = (
    events: TelemetryEvent[],
    currentContentLength: number
): ValidationResult => {
    // 1. Check for Insufficient Data
    // If we have content but no events, it's suspicious/unknown (preloaded, hydration, or avoided instrumentation).
    if (events.length === 0) {
        return {
            status: 'INSUFFICIENT_DATA',
            reason: 'No telemetry recorded for session.',
            metrics: { pasteRatio: 0, netContentLength: currentContentLength }
        };
    }

    // Calculate produced character metrics
    const pasteEvents = events.filter(e => e.type === 'paste') as Extract<TelemetryEvent, { type: 'paste' }>[];
    const pastedChars = pasteEvents.reduce((acc, e) => acc + e.length, 0);

    const keystrokeEvents = events.filter(e => e.type === 'keystroke') as Extract<TelemetryEvent, { type: 'keystroke' }>[];
    const typedCharEvents = keystrokeEvents.filter(e => e.action === 'char');
    const typedChars = typedCharEvents.length;

    const totalProduced = pastedChars + typedChars;

    // Guard against divide by zero if user only did nav keys
    if (totalProduced === 0) {
        return {
            status: 'INSUFFICIENT_DATA',
            reason: 'No content production actions recorded.',
            metrics: { pasteRatio: 0, netContentLength: currentContentLength }
        };
    }

    // 2. Paste Ratio Validation
    // Ratio = Pasted / (Pasted + Typed)
    const pasteRatio = pastedChars / totalProduced;

    if (pasteRatio > 0.8) {
        // Check if deletions compensate? 
        // If I paste 1000 and type 5, ratio is high.
        // If I paste 1000 and delete 900, type 5, ratio is still high relative to *production* method.
        // This aligns with "Low Effort" creation.
        return {
            status: 'LOW_EFFORT',
            reason: `High paste ratio (${(pasteRatio * 100).toFixed(1)}%)`,
            metrics: { pasteRatio, netContentLength: currentContentLength }
        };
    }

    // 3. Typing Variance (Coefficient of Variation)
    // Only analyze if we have enough keystrokes to be statistically meaningful
    if (typedCharEvents.length < 10) {
        // Not enough typing to fingerprint, but if paste ratio is low, we might loosely accept or stay insufficient.
        // Let's be conservative:
        return {
            status: 'INSUFFICIENT_DATA',
            reason: 'Not enough typing data to verify human rhythm.',
            metrics: { pasteRatio, netContentLength: currentContentLength }
        };
    }

    const intervals: number[] = [];
    // Use typedCharEvents for rhythm (ignore nav/deletes for rhythm calculation to avoid noise? 
    // actually deletes are part of rhythm, but let's stick to 'char' for pure typing speed analysis or use all keystrokes)
    // Let's use all keystrokes for rhythm as navigation/deletion is part of human flow.
    for (let i = 1; i < keystrokeEvents.length; i++) {
        intervals.push(keystrokeEvents[i].timestamp - keystrokeEvents[i - 1].timestamp);
    }

    // Filter valid typing intervals (exclude massive pauses > 2s which are "thinking" time)
    const typingIntervals = intervals.filter(i => i < 2000);

    if (typingIntervals.length < 5) {
        return {
            status: 'INSUFFICIENT_DATA',
            metrics: { pasteRatio, netContentLength: currentContentLength }
        };
    }

    const mean = typingIntervals.reduce((a, b) => a + b, 0) / typingIntervals.length;
    const variance = typingIntervals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / typingIntervals.length;
    const stdDev = Math.sqrt(variance);

    // Coefficient of Variation (CV) = s / mu
    // Humans are noisy. Robots are precise.
    // CV < 0.15 is extremely regular (likely robotic or highly skilled repetitive macro).
    const cv = mean > 0 ? stdDev / mean : 0;

    // 4. Regularity Check (Duplicate Intervals)
    // If many intervals are EXACTLY the same (e.g. 50.0ms), it's a bot.
    // Floating point jitter might exist, but usually scripts are cleaner than humans.
    // (Optional simple check)

    if (cv < 0.2 && mean < 150) {
        // Very fast and very regular.
        return {
            status: 'SUSPICIOUS',
            reason: `Typing too regular (CV: ${cv.toFixed(2)})`,
            metrics: { pasteRatio, cv, netContentLength: currentContentLength }
        };
    }

    // Additional Bot Check: extremely low variance absolute
    if (stdDev < 15) {
        return {
            status: 'SUSPICIOUS',
            reason: `Typing variance unnaturally low (SD: ${stdDev.toFixed(1)}ms)`,
            metrics: { pasteRatio, cv, netContentLength: currentContentLength }
        };
    }

    return {
        status: 'VERIFIED_HUMAN',
        metrics: { pasteRatio, cv, netContentLength: currentContentLength }
    };
};
