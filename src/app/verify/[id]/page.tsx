import Image from 'next/image';
import GhostReplay from '@/components/certificate/GhostReplay';
import {
  buildCertificateSearchParams,
  parseCertificatePayload,
} from '@/lib/certificate';
import { getCertificateRecord } from '@/lib/certificate-store';
import { AnimatedThemeToggler } from '@/components/magicui/animated-theme-toggler';

interface VerifyPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const toUrlSearchParams = (input: Record<string, string | string[] | undefined>) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string') {
      params.set(key, value);
    } else if (Array.isArray(value) && value.length > 0) {
      params.set(key, value[0]);
    }
  }
  return params;
};

const VerifyPage = async ({ params, searchParams }: VerifyPageProps) => {
  const { id } = await params;
  const search = await searchParams;
  const searchAsParams = toUrlSearchParams(search);
  const dbPayload = await getCertificateRecord(id);
  const payload = dbPayload ?? parseCertificatePayload(searchAsParams, id);
  const ogSearch = buildCertificateSearchParams(payload);
  const ogImageUrl = dbPayload
    ? `/api/og?id=${encodeURIComponent(payload.id)}`
    : `/api/og?${ogSearch.toString()}`;

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-slate-50 via-white to-sky-50/50 px-4 py-8 dark:bg-gradient-to-b dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 sm:px-8">
      <div
        className="pointer-events-none absolute inset-0 opacity-40 dark:opacity-20"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(148,163,184,0.2) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.2) 1px, transparent 1px)',
          backgroundSize: '36px 36px',
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_10%,rgba(56,189,248,0.14),transparent_34%),radial-gradient(circle_at_90%_10%,rgba(99,102,241,0.12),transparent_34%)] dark:bg-[radial-gradient(circle_at_14%_10%,rgba(14,165,233,0.24),transparent_34%),radial-gradient(circle_at_90%_10%,rgba(99,102,241,0.20),transparent_34%)]" />

      <div
        className="relative z-10 mx-auto w-full max-w-6xl rounded-[32px] border border-slate-200 bg-white/85 p-5 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur dark:border-slate-700 dark:bg-slate-900/80 dark:shadow-[0_20px_50px_rgba(2,6,23,0.45)] sm:p-8"
      >
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="font-mono text-xs uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">Mindprint Verify</div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 sm:text-3xl">Certificate {payload.id}</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-full border border-sky-300/40 bg-sky-50 px-4 py-2 text-sm text-sky-700 dark:border-sky-600/50 dark:bg-sky-900/30 dark:text-sky-200">
              Human Score: <span className="font-semibold text-sky-800 dark:text-sky-100">{payload.score}</span>
            </div>
            <AnimatedThemeToggler />
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-3 shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:border-slate-700 dark:bg-slate-900 dark:shadow-[0_14px_35px_rgba(2,6,23,0.45)] sm:p-5">
            <Image
              src={ogImageUrl}
              alt={`Mindprint certificate ${payload.id}`}
              width={1200}
              height={630}
              unoptimized
              className="h-auto w-full rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-950"
            />
          </section>

          <section className="space-y-5">
            <GhostReplay text={payload.text} />
            <div className="rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-700 shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:shadow-[0_14px_35px_rgba(2,6,23,0.45)]">
              <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
                Certificate Notes
              </div>
              <p className="leading-relaxed text-slate-600 dark:text-slate-300">
                This certificate visual is generated on-demand from query data and can be independently verified by
                re-opening this URL.
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
};

export default VerifyPage;
