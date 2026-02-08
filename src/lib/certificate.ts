import { TelemetryEvent, TextOperationType } from '@/types/telemetry';

export interface ReplayOperation {
  type: 'operation';
  timestamp: number;
  op: TextOperationType;
  from: number;
  to: number;
  text: string;
}

export interface CertificateProof {
  version: 'v1';
  artifactSha256: string;
  telemetryDigestSha256: string;
  issuedAt: string;
  validationStatus: string | null;
  riskScore: number | null;
  confidence: number | null;
  signature: string;
  logEntryHash: string | null;
  prevLogEntryHash: string | null;
}

export interface CertificatePayload {
  id: string;
  title: string;
  subtitle: string;
  text: string;
  score: number;
  issuedAt: string;
  sparkline: number[];
  seed: string;
  replay: ReplayOperation[];
  proof: CertificateProof | null;
}

const DEFAULT_SPARKLINE = [2, 4, 3, 5, 7, 6, 8, 5, 4, 6, 3, 2];
const MAX_TEXT_LENGTH = 420;
const MAX_POINTS = 48;
const MAX_REPLAY_EVENTS = 4000;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const decodeParam = (value: string | null) => {
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const parseScore = (raw: string | null) => {
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) {
    return 82;
  }
  return Math.round(clamp(numeric, 0, 100));
};

const parseSparkline = (raw: string | null) => {
  if (!raw) {
    return [];
  }

  return raw
    .split(',')
    .map((entry) => Number(entry.trim()))
    .filter((entry) => Number.isFinite(entry) && entry >= 0)
    .slice(0, MAX_POINTS);
};

const parseEvents = (raw: string | null) => {
  if (!raw) {
    return [] as TelemetryEvent[];
  }

  const decoded = decodeParam(raw);
  try {
    const parsed = JSON.parse(decoded);
    if (Array.isArray(parsed)) {
      return parsed as TelemetryEvent[];
    }
    if (parsed && Array.isArray(parsed.events)) {
      return parsed.events as TelemetryEvent[];
    }
  } catch {
    return [];
  }

  return [];
};

const parseReplay = (raw: string | null): ReplayOperation[] => {
  if (!raw) return [];
  const decoded = decodeParam(raw);
  try {
    const parsed = JSON.parse(decoded);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((event): event is ReplayOperation => {
        if (!event || typeof event !== 'object') return false;
        const candidate = event as ReplayOperation;
        return (
          Number.isFinite(candidate.timestamp) &&
          (candidate.type === 'operation' || typeof (candidate as { type?: string }).type === 'undefined') &&
          (candidate.op === 'insert' || candidate.op === 'delete' || candidate.op === 'replace') &&
          Number.isInteger(candidate.from) &&
          Number.isInteger(candidate.to) &&
          typeof candidate.text === 'string'
        );
      })
      .map((event) => ({
        type: 'operation' as const,
        timestamp: event.timestamp,
        op: event.op,
        from: event.from,
        to: event.to,
        text: event.text,
      }))
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(0, MAX_REPLAY_EVENTS);
  } catch {
    return [];
  }
};

export const buildReplayFromTelemetry = (events: TelemetryEvent[]) => {
  const operations = events
    .filter((event): event is Extract<TelemetryEvent, { type: 'operation' }> => event.type === 'operation')
    .filter(
      (event) =>
        Number.isFinite(event.timestamp) &&
        Number.isInteger(event.from) &&
        Number.isInteger(event.to) &&
        event.from >= 0 &&
        event.to >= event.from
    )
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(0, MAX_REPLAY_EVENTS);

  return operations.map((event) => ({
    type: 'operation' as const,
    timestamp: event.timestamp,
    op: event.op,
    from: event.from,
    to: event.to,
    text: event.text.slice(0, 1000),
  }));
};

export const buildSparklineFromTelemetry = (events: TelemetryEvent[]) => {
  const typingEvents = events.filter(
    (event) =>
      event.type === 'keystroke' &&
      (event.action === 'char' || event.action === 'delete') &&
      Number.isFinite(event.timestamp)
  ) as Extract<TelemetryEvent, { type: 'keystroke' }>[];

  if (typingEvents.length === 0) {
    return [];
  }

  const sorted = [...typingEvents].sort((a, b) => a.timestamp - b.timestamp);
  const bucketMs = 1000;
  const start = sorted[0].timestamp;
  const end = sorted[sorted.length - 1].timestamp;
  const bucketCount = Math.max(1, Math.ceil((end - start) / bucketMs) + 1);
  const buckets = new Array(bucketCount).fill(0);

  for (const event of sorted) {
    const idx = Math.min(bucketCount - 1, Math.floor((event.timestamp - start) / bucketMs));
    buckets[idx] += 1;
  }

  if (buckets.length <= MAX_POINTS) {
    return buckets;
  }

  // Downsample by averaging windows to keep query strings bounded.
  const windowSize = Math.ceil(buckets.length / MAX_POINTS);
  const sampled: number[] = [];
  for (let i = 0; i < buckets.length; i += windowSize) {
    const window = buckets.slice(i, i + windowSize);
    const avg = window.reduce((sum, value) => sum + value, 0) / window.length;
    sampled.push(Number(avg.toFixed(2)));
  }
  return sampled.slice(0, MAX_POINTS);
};

const normalizeSparkline = (values: number[]) => {
  if (values.length === 0) {
    return DEFAULT_SPARKLINE;
  }
  const finite = values.filter((value) => Number.isFinite(value) && value >= 0);
  if (finite.length === 0) {
    return DEFAULT_SPARKLINE;
  }
  return finite.map((value) => Number(value.toFixed(2)));
};

const parseIssuedAt = (raw: string | null) => {
  const candidate = decodeParam(raw);
  if (!candidate) {
    return new Date().toISOString();
  }

  const parsed = new Date(candidate);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }

  return parsed.toISOString();
};

const generateCertificateId = () => {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return `mp-${globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  }
  return `mp-${Math.random().toString(36).slice(2, 14)}`;
};

const safeId = (input: string) => {
  const cleaned = input.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  return cleaned || generateCertificateId();
};

export const parseCertificatePayload = (
  params: URLSearchParams,
  forcedId?: string
): CertificatePayload => {
  const id = safeId(forcedId || decodeParam(params.get('id')) || generateCertificateId());
  const text = decodeParam(params.get('text')).slice(0, MAX_TEXT_LENGTH);
  const sparkFromParam = parseSparkline(params.get('spark'));
  const sparkFromEvents = buildSparklineFromTelemetry(parseEvents(params.get('events')));
  const replay = parseReplay(params.get('replay'));

  return {
    id,
    title: decodeParam(params.get('title')) || 'Mindprint Human Origin Certificate',
    subtitle: decodeParam(params.get('subtitle')) || 'Proof of Human Creation',
    text: text || 'No transcript attached to this certificate.',
    score: parseScore(params.get('score')),
    issuedAt: parseIssuedAt(params.get('issuedAt')),
    sparkline: normalizeSparkline(sparkFromParam.length > 0 ? sparkFromParam : sparkFromEvents),
    seed: decodeParam(params.get('seed')) || id,
    replay,
    proof: null,
  };
};

export const buildCertificateSearchParams = (
  payload: CertificatePayload,
  includeId: boolean = true
) => {
  const params = new URLSearchParams();
  if (includeId) {
    params.set('id', payload.id);
  }
  params.set('score', String(payload.score));
  params.set('text', payload.text);
  params.set('title', payload.title);
  params.set('subtitle', payload.subtitle);
  params.set('issuedAt', payload.issuedAt);
  params.set('seed', payload.seed);
  params.set('spark', payload.sparkline.map((point) => point.toFixed(2)).join(','));
  if (payload.replay.length > 0) {
    params.set('replay', JSON.stringify(payload.replay));
  }
  return params;
};

const PALETTES = [
  {
    base: '#040611',
    overlayA: '#00E5FF',
    overlayB: '#7C3AED',
    overlayC: '#06D6A0',
    border: '#8B5CF6',
    glow: '#22D3EE',
  },
  {
    base: '#06040f',
    overlayA: '#FF6B6B',
    overlayB: '#4D96FF',
    overlayC: '#6A00FF',
    border: '#60A5FA',
    glow: '#F472B6',
  },
  {
    base: '#030712',
    overlayA: '#00F5D4',
    overlayB: '#B5179E',
    overlayC: '#4895EF',
    border: '#22D3EE',
    glow: '#A78BFA',
  },
];

export interface CyberpunkPalette {
  base: string;
  overlayA: string;
  overlayB: string;
  overlayC: string;
  border: string;
  glow: string;
}

export const getCyberpunkPalette = (seed: string): CyberpunkPalette => {
  const numeric = [...seed].reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return PALETTES[numeric % PALETTES.length];
};

export const buildSparklinePath = (
  values: number[],
  width: number,
  height: number,
  padding: number = 12
) => {
  if (values.length === 0) {
    return '';
  }

  const maxValue = Math.max(...values, 1);
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;
  const points = values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : padding + (index / (values.length - 1)) * usableWidth;
    const y = padding + (1 - value / maxValue) * usableHeight;
    return { x, y };
  });

  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');
};
