"use client";

import React, { useMemo, useState } from "react";
import Editor, { EditorSessionSnapshot } from "@/components/editor/Editor";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  buildReplayFromTelemetry,
  buildSparklineFromTelemetry,
} from "@/lib/certificate";
import { ValidationStatus } from "@/lib/telemetry";
import { createCertificate } from "@/app/actions/certificate";
import { AnimatedGridPattern } from "@/components/magicui/animated-grid-pattern";
import { AnimatedThemeToggler } from "@/components/magicui/animated-theme-toggler";
import { AnalysisResult } from "@/components/AnalysisResult";

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const SCORE_MODEL = {
  defaultRiskScore: 50,
  defaultConfidence: 0.3,
  uncertaintyPenaltyScale: 20,
  calibratedRange: {
    min: 1,
    max: 99,
  },
  statusBounds: {
    VERIFIED_HUMAN: {
      minimum: 68,
    },
    SUSPICIOUS: {
      maximum: 45,
    },
    LOW_EFFORT: {
      maximum: 28,
    },
  },
} as const;

const scoreFromSnapshot = (
  snapshot: EditorSessionSnapshot,
  hasText: boolean,
) => {
  if (!hasText) return 0;
  const risk = snapshot.riskScore ?? SCORE_MODEL.defaultRiskScore;
  const confidence = snapshot.confidence ?? SCORE_MODEL.defaultConfidence;
  const base = 100 - risk;
  const uncertaintyPenalty =
    (1 - confidence) * SCORE_MODEL.uncertaintyPenaltyScale;
  const calibrated = Math.round(
    clamp(
      base - uncertaintyPenalty,
      SCORE_MODEL.calibratedRange.min,
      SCORE_MODEL.calibratedRange.max,
    ),
  );

  switch (snapshot.validationStatus) {
    case "VERIFIED_HUMAN":
      return clamp(
        Math.max(
          calibrated,
          SCORE_MODEL.statusBounds.VERIFIED_HUMAN.minimum,
        ),
        0,
        SCORE_MODEL.calibratedRange.max,
      );
    case "SUSPICIOUS":
      return clamp(
        Math.min(calibrated, SCORE_MODEL.statusBounds.SUSPICIOUS.maximum),
        0,
        SCORE_MODEL.calibratedRange.max,
      );
    case "LOW_EFFORT":
      return clamp(
        Math.min(calibrated, SCORE_MODEL.statusBounds.LOW_EFFORT.maximum),
        0,
        SCORE_MODEL.calibratedRange.max,
      );
    default:
      return clamp(
        calibrated,
        0,
        SCORE_MODEL.calibratedRange.max,
      );
  }
};

const subtitleFromStatus = (status: ValidationStatus) => {
  switch (status) {
    case "VERIFIED_HUMAN":
      return "Verified Human Writing Session";
    case "SUSPICIOUS":
      return "Flagged For Rhythm Irregularities";
    case "LOW_EFFORT":
      return "High Paste Ratio Detected";
    default:
      return "Session Captured With Limited Data";
  }
};

const WritePage = () => {
  const router = useRouter();
  const [isFinishing, setIsFinishing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisText, setAnalysisText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sessionSnapshot, setSessionSnapshot] = useState<EditorSessionSnapshot>(
    {
      text: "",
      events: [],
      validationStatus: "INSUFFICIENT_DATA",
      riskScore: null,
      confidence: null,
      sessionId: null,
      telemetryReady: false,
      telemetryError: null,
    },
  );
  const hasText = useMemo(
    () => sessionSnapshot.text.trim().length > 0,
    [sessionSnapshot.text],
  );

  const handleAnalyzeSession = async () => {
    if (!hasText || isAnalyzing) return;
    setIsAnalyzing(true);
    setError(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          log: sessionSnapshot.events,
          sessionId: sessionSnapshot.sessionId,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Analysis request failed.");
      }

      const eventDescriptions = Array.isArray(payload.events)
        ? payload.events
            .slice(0, 4)
            .map(
              (event: { type?: string; description?: string }) =>
                `- ${event.type || "signal"}: ${event.description || "n/a"}`,
            )
        : [];

      const sections = [
        `Cognitive Effort: ${payload.cognitive_effort ?? "n/a"}/100`,
        `Human Likelihood: ${payload.human_likelihood ?? "n/a"}/100`,
        "",
        `${payload.analysis_summary || "No summary returned."}`,
      ];
      if (eventDescriptions.length > 0) {
        sections.push("", "Detected behavioral events:", ...eventDescriptions);
      }

      setAnalysisText(sections.join("\n"));
      setAnalysisOpen(true);
    } catch (analysisError) {
      console.error("Failed to analyze session:", analysisError);
      setError(
        analysisError instanceof Error
          ? analysisError.message
          : "Analysis failed. Please retry.",
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFinishSession = async () => {
    if (!hasText || isFinishing) return;
    if (!sessionSnapshot.sessionId) {
      setError(
        sessionSnapshot.telemetryError
          ? `Trusted telemetry failed to initialize: ${sessionSnapshot.telemetryError}`
          : "Trusted telemetry session is still initializing. Please wait a moment and retry.",
      );
      return;
    }

    setIsFinishing(true);
    setError(null);
    const certificateText = sessionSnapshot.text.trim().slice(0, 420);
    const score = scoreFromSnapshot(sessionSnapshot, hasText);
    const sparkline = buildSparklineFromTelemetry(sessionSnapshot.events);
    const replay = buildReplayFromTelemetry(sessionSnapshot.events);
    const issuedAt = new Date().toISOString();

    try {
      const { id } = await createCertificate({
        title: "Mindprint Human Origin Certificate",
        subtitle: subtitleFromStatus(sessionSnapshot.validationStatus),
        text: certificateText,
        score,
        issuedAt,
        seed: `seed-${Date.now().toString(36)}`,
        sparkline,
        replay,
        validationStatus: sessionSnapshot.validationStatus,
        riskScore: sessionSnapshot.riskScore ?? undefined,
        confidence: sessionSnapshot.confidence ?? undefined,
      });

      router.push(`/verify/${encodeURIComponent(id)}`);
    } catch (error) {
      console.error("Failed to create certificate record:", error);
      setError(
        "Could not issue a trusted certificate. Please retry once telemetry/database are available.",
      );
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
              onClick={handleAnalyzeSession}
              disabled={!hasText || isAnalyzing}
              className="rounded-full border border-slate-300/70 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-55 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
            >
              {isAnalyzing ? "Analyzing..." : "Analyze Session"}
            </button>
            <button
              onClick={handleFinishSession}
              disabled={!hasText || isFinishing}
              className="rounded-full border border-sky-300/50 bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_22px_rgba(14,165,233,0.35)] transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-55"
            >
              {isFinishing ? "Finishing..." : "Finish Session"}
            </button>
            <AnimatedThemeToggler />
          </div>
        </header>

        {isAnalyzing && (
          <div className="pointer-events-none fixed inset-x-0 top-24 z-30 flex justify-center px-4">
            <div
              role="status"
              aria-live="polite"
              className="inline-flex items-center gap-3 rounded-full border border-sky-300/60 bg-white/95 px-5 py-3 text-sm font-semibold text-sky-800 shadow-[0_18px_40px_rgba(14,165,233,0.25)] backdrop-blur dark:border-sky-700 dark:bg-slate-900/95 dark:text-sky-200"
            >
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Analyzing typing behavior and cognitive signals...</span>
            </div>
          </div>
        )}

        <section className="rounded-[2rem] border border-slate-200 bg-white/80 p-4 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur sm:p-7 dark:border-slate-700 dark:bg-slate-900/75 dark:shadow-[0_20px_50px_rgba(2,6,23,0.45)]">
          <div className="mb-4 px-1">
            <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl dark:text-slate-100">
              Create your proof of human writing
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Write naturally. We capture process signals and issue a
              certificate when you finish.
            </p>
            {error && (
              <p className="mt-2 text-sm text-rose-600 dark:text-rose-300">
                {error}
              </p>
            )}
            {isAnalyzing && (
              <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50/80 px-4 py-3 text-sm text-sky-900 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-200">
                Session analysis is running in the background. You can keep
                writing while we process your telemetry.
              </div>
            )}
          </div>
          <Editor onSessionChange={setSessionSnapshot} />
        </section>
      </main>
      <AnalysisResult
        isOpen={analysisOpen}
        onClose={() => setAnalysisOpen(false)}
        analysis={analysisText}
      />
    </div>
  );
};

export default WritePage;
