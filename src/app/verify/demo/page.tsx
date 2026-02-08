import GhostReplay from "@/components/certificate/GhostReplay";
import { AnimatedThemeToggler } from "@/components/magicui/animated-theme-toggler";
import { ReplayOperation } from "@/lib/certificate";

const DEMO_TEXT =
  "Mindprint captures the process behind writing, not just the final output.";

const DEMO_REPLAY: ReplayOperation[] = [
  {
    type: "operation",
    timestamp: 0,
    op: "insert",
    from: 0,
    to: 0,
    text: "Mindprint captures ",
  },
  {
    type: "operation",
    timestamp: 320,
    op: "insert",
    from: 18,
    to: 18,
    text: "the process behind writing, ",
  },
  {
    type: "operation",
    timestamp: 760,
    op: "insert",
    from: 46,
    to: 46,
    text: "not just the final output.",
  },
];

const DEMO_SPARK = [3, 5, 4, 7, 6, 3, 8, 6, 4, 2, 3, 2];

const DemoVerifyPage = () => {
  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-slate-50 via-white to-sky-50/50 px-4 py-8 dark:bg-gradient-to-b dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 sm:px-8">
      <div
        className="pointer-events-none absolute inset-0 opacity-40 dark:opacity-20"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(148,163,184,0.2) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.2) 1px, transparent 1px)",
          backgroundSize: "36px 36px",
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_10%,rgba(56,189,248,0.14),transparent_34%),radial-gradient(circle_at_90%_10%,rgba(99,102,241,0.12),transparent_34%)] dark:bg-[radial-gradient(circle_at_14%_10%,rgba(14,165,233,0.24),transparent_34%),radial-gradient(circle_at_90%_10%,rgba(99,102,241,0.20),transparent_34%)]" />

      <div className="relative z-10 mx-auto w-full max-w-6xl rounded-[32px] border border-slate-200 bg-white/85 p-5 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur dark:border-slate-700 dark:bg-slate-900/80 dark:shadow-[0_20px_50px_rgba(2,6,23,0.45)] sm:p-8">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="font-mono text-xs uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
              Mindprint Verify
            </div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 sm:text-3xl">
              Demo Certificate
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-full border border-sky-300/40 bg-sky-50 px-4 py-2 text-sm text-sky-700 dark:border-sky-600/50 dark:bg-sky-900/30 dark:text-sky-200">
              Human Score:{" "}
              <span className="font-semibold text-sky-800 dark:text-sky-100">
                92
              </span>
            </div>
            <AnimatedThemeToggler />
          </div>
        </header>

        <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-200">
          Demo mode: this sample is illustrative and is not a persisted,
          cryptographically verified certificate from your trusted store.
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:border-slate-700 dark:bg-slate-900 dark:shadow-[0_14px_35px_rgba(2,6,23,0.45)]">
            <div className="mb-4 font-mono text-[11px] uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
              Demo Certificate Snapshot
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-950">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                ID
              </div>
              <div className="mt-1 font-mono text-sm text-slate-800 dark:text-slate-100">
                demo
              </div>

              <div className="mt-4 text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Title
              </div>
              <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                Mindprint Human Origin Certificate
              </div>

              <div className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {DEMO_TEXT}
              </div>

              <div className="mt-5">
                <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Typing Velocity
                </div>
                <div className="flex items-end gap-1 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                  {DEMO_SPARK.map((value, index) => (
                    <div
                      key={`${value}-${index}`}
                      className="w-3 rounded-full bg-gradient-to-t from-sky-500 to-cyan-300"
                      style={{ height: `${Math.max(10, value * 8)}px` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-5">
            <GhostReplay text={DEMO_TEXT} replay={DEMO_REPLAY} />
            <div className="rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-700 shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:shadow-[0_14px_35px_rgba(2,6,23,0.45)]">
              <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
                About This Demo
              </div>
              <p className="leading-relaxed text-slate-600 dark:text-slate-300">
                This route exists to preview the verification experience without
                requiring seeded production records. Real verification is done
                on persisted certificate IDs generated from live sessions.
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
};

export default DemoVerifyPage;
