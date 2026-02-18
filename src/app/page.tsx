import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-sand-100 text-ink-900">
      <div className="pointer-events-none fixed inset-0 opacity-70">
        <div className="absolute -left-32 top-16 h-72 w-72 rounded-full bg-coral-200 blur-[110px]" />
        <div className="absolute right-10 top-40 h-80 w-80 rounded-full bg-ocean-200 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-moss-200 blur-[110px]" />
      </div>

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-6 py-16">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-500">
            Visit Card OCR
          </p>
          <h1 className="mt-6 text-4xl font-semibold leading-tight md:text-5xl">
            Turn visit cards into clean contact data in seconds.
          </h1>
          <p className="mt-4 text-base text-ink-600">
            Upload a front/back image, let Mistral OCR 3 extract details, then
            edit and export to vCard, CSV, or JSON.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/login"
              className="rounded-full bg-ink-900 px-6 py-3 text-sm font-semibold text-sand-100"
            >
              Get started
            </Link>
            <Link
              href="/dashboard"
              className="rounded-full border border-ink-200/70 px-6 py-3 text-sm font-semibold text-ink-700"
            >
              Go to dashboard
            </Link>
          </div>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {[
            {
              title: "Upload",
              copy: "Front or front+back images, with progress and retries.",
            },
            {
              title: "Extract",
              copy: "Pluggable OCR pipeline with Mistral OCR 3.",
            },
            {
              title: "Export",
              copy: "vCard, CSV, or JSON in one click.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-3xl border border-ink-200/70 bg-white/80 p-6 shadow-soft"
            >
              <h3 className="text-lg font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm text-ink-500">{item.copy}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
