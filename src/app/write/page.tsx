'use client';

import React, { useMemo, useState } from 'react';
import Editor, { EditorSessionSnapshot } from '@/components/editor/Editor';
import { ArrowLeft, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { buildSparklineFromTelemetry } from '@/lib/certificate';
import { ValidationStatus } from '@/lib/telemetry';
import { createCertificate } from '@/app/actions/certificate';
import { AnimatedGridPattern } from '@/components/magicui/animated-grid-pattern';
import { AnimatedThemeToggler } from '@/components/magicui/animated-theme-toggler';

const scoreFromStatus = (status: ValidationStatus, hasText: boolean) => {
  if (!hasText) return 0;
  switch (status) {
    case 'VERIFIED_HUMAN':
      return 93;
    case 'SUSPICIOUS':
      return 34;
    case 'LOW_EFFORT':
      return 24;
    default:
      return 61;
  }
};

const subtitleFromStatus = (status: ValidationStatus) => {
  switch (status) {
    case 'VERIFIED_HUMAN':
      return 'Verified Human Writing Session';
    case 'SUSPICIOUS':
      return 'Flagged For Rhythm Irregularities';
    case 'LOW_EFFORT':
      return 'High Paste Ratio Detected';
    default:
      return 'Session Captured With Limited Data';
  }
};

const WritePage = () => {
  const router = useRouter();
  const [isFinishing, setIsFinishing] = useState(false);
  const [sessionSnapshot, setSessionSnapshot] = useState<EditorSessionSnapshot>({
    text: '',
    events: [],
    validationStatus: 'INSUFFICIENT_DATA',
  });
  const hasText = useMemo(() => sessionSnapshot.text.trim().length > 0, [sessionSnapshot.text]);

  const handleFinishSession = async () => {
    if (!hasText || isFinishing) return;

    setIsFinishing(true);
    const certificateText = sessionSnapshot.text.trim().slice(0, 420);
    const score = scoreFromStatus(sessionSnapshot.validationStatus, hasText);
    const sparkline = buildSparklineFromTelemetry(sessionSnapshot.events);
    const issuedAt = new Date().toISOString();

    try {
      const { id } = await createCertificate({
        title: 'Mindprint Human Origin Certificate',
        subtitle: subtitleFromStatus(sessionSnapshot.validationStatus),
        text: certificateText,
        score,
        issuedAt,
        seed: `seed-${Date.now().toString(36)}`,
        sparkline,
        validationStatus: sessionSnapshot.validationStatus,
      });

      router.push(`/verify/${encodeURIComponent(id)}`);
    } catch (error) {
      console.error('Failed to create certificate record:', error);
      const fallbackId = `mp-${Date.now().toString(36)}`;
      const params = new URLSearchParams();
      params.set('score', String(score));
      params.set('text', certificateText);
      params.set('title', 'Mindprint Human Origin Certificate');
      params.set('subtitle', subtitleFromStatus(sessionSnapshot.validationStatus));
      params.set('issuedAt', issuedAt);
      params.set('seed', fallbackId);
      if (sparkline.length > 0) {
        params.set('spark', sparkline.map((point) => point.toFixed(2)).join(','));
      }

      router.push(`/verify/${encodeURIComponent(fallbackId)}?${params.toString()}`);
    } finally {
      setIsFinishing(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-slate-50 via-white to-sky-50/50 text-slate-900 dark:bg-gradient-to-b dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 dark:text-slate-100">
      <AnimatedGridPattern className="opacity-45 [mask-image:radial-gradient(ellipse_at_top,white,transparent_75%)] dark:opacity-25" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(56,189,248,0.14),transparent_34%),radial-gradient(circle_at_88%_15%,rgba(99,102,241,0.10),transparent_32%)] dark:bg-[radial-gradient(circle_at_15%_10%,rgba(14,165,233,0.24),transparent_34%),radial-gradient(circle_at_88%_15%,rgba(99,102,241,0.20),transparent_32%)]" />

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-8 sm:px-8">
        <header className="mb-8 flex items-center justify-between rounded-full border border-slate-200/80 bg-white/85 px-4 py-3 shadow-[0_10px_30px_rgba(15,23,42,0.06)] backdrop-blur sm:px-6 dark:border-slate-700 dark:bg-slate-900/80 dark:shadow-[0_10px_30px_rgba(2,6,23,0.45)]">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-slate-700 dark:text-slate-200">
              <Sparkles className="h-4 w-4 text-sky-500 dark:text-sky-400" />
              Writing Session
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleFinishSession}
              disabled={!hasText || isFinishing}
              className="rounded-full border border-sky-300/50 bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_22px_rgba(14,165,233,0.35)] transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-55"
            >
              {isFinishing ? 'Finishing...' : 'Finish Session'}
            </button>
            <AnimatedThemeToggler />
          </div>
        </header>

        <section className="rounded-[2rem] border border-slate-200 bg-white/80 p-4 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur sm:p-7 dark:border-slate-700 dark:bg-slate-900/75 dark:shadow-[0_20px_50px_rgba(2,6,23,0.45)]">
          <div className="mb-4 px-1">
            <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl dark:text-slate-100">
              Create your proof of human writing
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Write naturally. We capture process signals and issue a certificate when you finish.
            </p>
          </div>
          <Editor onSessionChange={setSessionSnapshot} />
        </section>
      </main>
    </div>
  );
};

export default WritePage;
