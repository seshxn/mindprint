"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Fingerprint,
  Radar,
  ShieldCheck,
  Sparkles,
  Waves,
} from "lucide-react";
import { AnimatedGridPattern } from "@/components/magicui/animated-grid-pattern";
import { MagicCard } from "@/components/magicui/magic-card";
import { ShimmerButton } from "@/components/magicui/shimmer-button";
import { AnimatedThemeToggler } from "@/components/magicui/animated-theme-toggler";

const features = [
  {
    icon: Fingerprint,
    title: "Behavioral Signature",
    copy: "Track human writing cadence, edits, pauses, and revision flow with privacy-first telemetry.",
  },
  {
    icon: ShieldCheck,
    title: "Verifiable Certificates",
    copy: "Generate short-ID certificates that can be verified independently with shareable links.",
  },
  {
    icon: Radar,
    title: "Ghost Replay",
    copy: "Replay text creation character-by-character to show the process, not just the final output.",
  },
];

const signals = [
  { label: "Score", value: "93" },
  { label: "Events", value: "1.2k" },
  { label: "Status", value: "Verified" },
];

const integrations = [
  "Writers",
  "Agencies",
  "EdTech",
  "Hiring Ops",
  "Compliance",
  "Trust & Safety",
];

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-slate-50 via-white to-sky-50/50 text-slate-900 dark:bg-gradient-to-b dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 dark:text-slate-100">
      <AnimatedGridPattern className="opacity-45 [mask-image:radial-gradient(ellipse_at_top,white,transparent_75%)] dark:opacity-25" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(56,189,248,0.16),transparent_36%),radial-gradient(circle_at_88%_12%,rgba(99,102,241,0.12),transparent_36%)] dark:bg-[radial-gradient(circle_at_15%_15%,rgba(14,165,233,0.24),transparent_36%),radial-gradient(circle_at_88%_12%,rgba(99,102,241,0.20),transparent_36%)]" />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-5 pb-16 pt-7 sm:px-8 lg:px-10">
        <header className="mb-12 flex items-center justify-between rounded-full border border-slate-200/80 bg-white/85 px-4 py-3 shadow-[0_10px_30px_rgba(15,23,42,0.06)] backdrop-blur sm:px-6 dark:border-slate-700 dark:bg-slate-900/80 dark:shadow-[0_10px_30px_rgba(2,6,23,0.45)]">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.22em] text-slate-700 dark:text-slate-200">
            <Sparkles className="h-4 w-4 text-sky-500 dark:text-sky-400" />
            Mindprint
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/verify/demo"
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-700 transition hover:border-sky-300 hover:text-sky-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-400 dark:hover:text-sky-300"
            >
              Verify
            </Link>
            <Link href="/write">
              <ShimmerButton className="px-4 py-2 text-xs uppercase tracking-[0.2em]">
                Start Writing
              </ShimmerButton>
            </Link>
            <AnimatedThemeToggler />
          </div>
        </header>

        <section className="grid items-center gap-8 lg:grid-cols-[1.06fr_0.94fr]">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-6"
          >
            <h1 className="text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
              Verify how content was created
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-slate-600 dark:text-slate-300">
              Mindprint captures how writing was created, generates a
              certificate, and lets anyone verify authorship confidence from
              process evidence.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/write">
                <ShimmerButton className="inline-flex items-center gap-2">
                  Create Certificate
                  <ArrowRight className="h-4 w-4" />
                </ShimmerButton>
              </Link>
              <Link
                href="/verify/demo"
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-sky-300 hover:text-sky-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-400 dark:hover:text-sky-300"
              >
                View Verification Demo
              </Link>
            </div>
            <div className="flex flex-wrap gap-3 pt-1 text-sm text-slate-600 dark:text-slate-300">
              {[
                "No prompt logs required",
                "Process-based scoring",
                "Shareable verification links",
              ].map((item) => (
                <div
                  key={item}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 shadow-sm dark:bg-slate-900 dark:shadow-none"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  {item}
                </div>
              ))}
            </div>
          </motion.div>

          <MagicCard className="p-6">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-700 dark:text-sky-300">
              Realtime Signal
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/80">
              <div className="flex h-28 items-end gap-2">
                {[26, 48, 43, 63, 70, 37, 56, 24].map((height, index) => (
                  <motion.div
                    key={`${height}-${index}`}
                    initial={{ height: 8 }}
                    whileInView={{ height }}
                    viewport={{ once: true, amount: 0.4 }}
                    transition={{ duration: 0.45, delay: index * 0.04 }}
                    className="w-4 rounded-full bg-gradient-to-t from-sky-500 to-cyan-300"
                  />
                ))}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {signals.map((signal) => (
                <div
                  key={signal.label}
                  className="rounded-xl border border-slate-200 bg-white px-2 py-3 dark:border-slate-700 dark:bg-slate-900"
                >
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    {signal.label}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {signal.value}
                  </div>
                </div>
              ))}
            </div>
          </MagicCard>
        </section>

        <section className="mt-14 grid gap-4 md:grid-cols-3">
          {features.map(({ icon: Icon, title, copy }, index) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.4, delay: index * 0.06 }}
            >
              <MagicCard>
                <div className="mb-3 inline-flex rounded-xl border border-sky-200 bg-sky-50 p-2 dark:border-sky-700/60 dark:bg-sky-900/30">
                  <Icon className="h-5 w-5 text-sky-600 dark:text-sky-300" />
                </div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  {title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {copy}
                </p>
              </MagicCard>
            </motion.div>
          ))}
        </section>

        <section className="mt-14 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <MagicCard className="p-6">
            <div className="mb-2 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              <Waves className="h-4 w-4 text-sky-500 dark:text-sky-300" />
              Where Mindprint Fits
            </div>
            <h3 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
              Built for teams shipping trusted content at scale
            </h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {integrations.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-300"
                >
                  {item}
                </span>
              ))}
            </div>
          </MagicCard>
          <MagicCard className="p-6">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Next Step
            </div>
            <h3 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
              Generate your first certificate in under a minute
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Start a writing session, click finish, and share your short
              verification link instantly.
            </p>
            <div className="mt-5">
              <Link href="/write">
                <ShimmerButton className="w-full justify-center">
                  Launch Mindprint Writer
                </ShimmerButton>
              </Link>
            </div>
          </MagicCard>
        </section>
      </div>
    </main>
  );
}
