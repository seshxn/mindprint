'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ReplayOperation } from '@/lib/certificate';

interface GhostReplayProps {
  text: string;
  replay?: ReplayOperation[];
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const applyOperation = (base: string, op: ReplayOperation) => {
  const from = clamp(op.from, 0, base.length);
  const to = clamp(op.to, from, base.length);
  const insert = op.text || '';
  return `${base.slice(0, from)}${insert}${base.slice(to)}`;
};

const deterministicFallbackDelay = (char: string) => {
  if (char === '\n') return 95;
  if (/[.,!?]/.test(char)) return 80;
  if (/\s/.test(char)) return 32;
  return 22;
};

const GhostReplay = ({ text, replay = [] }: GhostReplayProps) => {
  const [rendered, setRendered] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const timerRef = useRef<number | null>(null);
  const normalizedReplay = useMemo(
    () =>
      replay
        .filter((event) => Number.isFinite(event.timestamp))
        .sort((a, b) => a.timestamp - b.timestamp),
    [replay]
  );

  const stopReplay = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsPlaying(false);
  };

  useEffect(() => () => stopReplay(), []);

  const playFromOperations = () => {
    let index = 0;
    let currentText = '';

    const tick = () => {
      if (index >= normalizedReplay.length) {
        setRendered(currentText);
        setIsPlaying(false);
        timerRef.current = null;
        return;
      }

      const event = normalizedReplay[index];
      currentText = applyOperation(currentText, event);
      setRendered(currentText);

      const next = normalizedReplay[index + 1];
      index += 1;
      if (!next) {
        timerRef.current = window.setTimeout(tick, 40);
        return;
      }

      const rawDelta = next.timestamp - event.timestamp;
      const delay = clamp(Math.round(rawDelta * 0.35), 14, 260);
      timerRef.current = window.setTimeout(tick, delay);
    };

    tick();
  };

  const playFallbackTyping = () => {
    let index = 0;
    const tick = () => {
      if (index >= text.length) {
        setIsPlaying(false);
        timerRef.current = null;
        return;
      }
      const current = text[index];
      setRendered((previous) => previous + current);
      index += 1;
      timerRef.current = window.setTimeout(tick, deterministicFallbackDelay(current));
    };
    tick();
  };

  const play = () => {
    stopReplay();
    setRendered('');
    setIsPlaying(true);
    setHasPlayed(true);

    if (normalizedReplay.length > 0) {
      playFromOperations();
      return;
    }
    playFallbackTyping();
  };

  const status = isPlaying
    ? normalizedReplay.length > 0
      ? 'Replaying deterministic edit operations...'
      : 'Replaying transcript fallback...'
    : hasPlayed
      ? 'Replay complete. Press Play again to rerun.'
      : 'Press Play to start deterministic replay.';

  return (
    <div className="rounded-3xl border border-slate-200 bg-white/85 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900 dark:shadow-[0_18px_40px_rgba(2,6,23,0.45)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">Ghost Replay</div>
          <div className="text-sm text-slate-700 dark:text-slate-200">{status}</div>
        </div>
        <button
          onClick={play}
          disabled={!text || isPlaying}
          className="rounded-full border border-sky-300/50 bg-sky-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-55"
        >
          {isPlaying ? 'Playing...' : 'Play'}
        </button>
      </div>

      <div className="relative min-h-[220px] whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 p-5 font-mono text-sm leading-6 text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
        {rendered}
        <span
          className={`inline-block w-2 translate-y-[1px] rounded-sm bg-sky-500 ${isPlaying ? 'animate-pulse' : 'opacity-40'}`}
        >
          &nbsp;
        </span>
      </div>
    </div>
  );
};

export default GhostReplay;
