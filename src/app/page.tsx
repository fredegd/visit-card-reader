import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type DuoCopy = {
  titleDe: string;
  titleEn: string;
  copyDe: string;
  copyEn: string;
};

const benefits: DuoCopy[] = [
  {
    titleDe: "Leads schneller aktivieren",
    titleEn: "Activate leads faster",
    copyDe: "Aus Visitenkarten werden in Sekunden CRM-fertige Kontakte.",
    copyEn: "Business cards become CRM-ready contacts in seconds.",
  },
  {
    titleDe: "Besseres Abo, kleinerer Preis",
    titleEn: "Better subscription, lower cost",
    copyDe: "Weniger als klassische OCR-Tools, mit mehr Kontrolle im Workflow.",
    copyEn: "Less than legacy OCR tools, with more workflow control.",
  },
  {
    titleDe: "Für Business & Industry",
    titleEn: "Built for business & industry",
    copyDe: "Skalierbar für Teams, Messen und Außendienst mit Export-Standards.",
    copyEn: "Scales for teams, trade fairs, and field sales with standard exports.",
  },
];

const workflowSteps: DuoCopy[] = [
  {
    titleDe: "Upload",
    titleEn: "Upload",
    copyDe: "Front/Back in einem Schritt, Fortschritt live sichtbar.",
    copyEn: "Front/back in one step, live progress throughout.",
  },
  {
    titleDe: "Extrahieren",
    titleEn: "Extract",
    copyDe: "Mistral OCR 3 liest Namen, Titel, Firma, Telefon, E-Mail.",
    copyEn: "Mistral OCR 3 captures name, title, company, phone, email.",
  },
  {
    titleDe: "Veredeln",
    titleEn: "Refine",
    copyDe: "Du korrigierst, ergänzt und speicherst sauber.",
    copyEn: "You correct, enrich, and save cleanly.",
  },
  {
    titleDe: "Exportieren",
    titleEn: "Export",
    copyDe: "vCard, CSV, JSON oder direkter CRM-Import.",
    copyEn: "vCard, CSV, JSON, or direct CRM import.",
  },
];

const pricing = [
  {
    name: "Starter",
    price: "12 €",
    cadence: "/ Monat",
    highlights: [
      "200 Karten/Monat",
      "vCard, CSV, JSON",
      "Team-Upload",
      "E-Mail Support",
    ],
  },
  {
    name: "Business",
    price: "29 €",
    cadence: "/ Monat",
    highlights: [
      "1.500 Karten/Monat",
      "Batch-Upload",
      "Export-Vorlagen",
      "Priorisierter Support",
    ],
  },
  {
    name: "Industry",
    price: "Individuell",
    cadence: "",
    highlights: [
      "Unlimitierte Karten",
      "Team-Rollen",
      "SLA & Compliance",
      "Onboarding",
    ],
  },
];

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const primaryHref = data.user ? "/dashboard" : "/login";

  return (
    <div className="min-h-screen bg-sand-100 text-ink-900">
      <div className="pointer-events-none fixed inset-0 opacity-80">
        <div className="absolute -left-32 top-10 h-80 w-80 rounded-full bg-coral-200 blur-[120px]" />
        <div className="absolute right-6 top-32 h-96 w-96 rounded-full bg-ocean-200 blur-[140px]" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-moss-200 blur-[120px]" />
      </div>

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-20 px-6 py-16">
        <section className="grid items-center gap-12 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-ink-200/70 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-ink-600">
              Business & Industry
            </div>
            <h1 className="mt-6 text-4xl font-semibold leading-tight md:text-5xl">
              Visitenkarten zu verwertbaren Leads in Sekunden.
            </h1>
            <p className="mt-4 text-base text-ink-600">
              Scanne Karten, veredle die Daten und exportiere sofort in dein
              CRM. Ein Abo, das günstiger ist und mehr Workflow-Kontrolle bietet.
            </p>
            <p className="mt-4 text-base text-ink-500">
              Turn business cards into clean contact data in seconds. One
              subscription, lower cost, and tighter workflow control.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              {data.user ? null : (
                <Link
                  href={primaryHref}
                  className="rounded-full bg-ink-900 px-6 py-3 text-sm font-semibold text-sand-100"
                >
                  Demo starten
                </Link>
              )}
              <Link
                href="#pricing"
                className="rounded-full border border-ink-200/70 px-6 py-3 text-sm font-semibold text-ink-700"
              >
                Preise ansehen
              </Link>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                {
                  stat: "~6 Sek.",
                  label: "Pro Karte",
                  labelEn: "per card",
                },
                {
                  stat: "99%",
                  label: "Felder erkannt",
                  labelEn: "fields captured",
                },
                {
                  stat: "3",
                  label: "Exports",
                  labelEn: "export formats",
                },
              ].map((item) => (
                <div
                  key={item.stat}
                  className="rounded-3xl border border-ink-200/70 bg-white/80 p-4 text-sm text-ink-600 shadow-soft"
                >
                  <p className="text-2xl font-semibold text-ink-900">
                    {item.stat}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-[0.2em] text-ink-500">
                    {item.label}
                  </p>
                  <p className="text-xs text-ink-400">{item.labelEn}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[32px] border border-ink-200/70 bg-white/80 p-6 shadow-soft">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.2em] text-ink-500">
              <span>Live Preview</span>
              <span>OCR READY</span>
            </div>
            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-dashed border-ink-200/80 bg-sand-50 px-4 py-6 text-sm text-ink-500">
                Drop front/back images here
              </div>
              <div className="rounded-2xl border border-ink-200/70 bg-white px-4 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-ink-400">
                  Extracted Contact
                </p>
                <div className="mt-3 space-y-2 text-sm text-ink-700">
                  <p>Alex Meyer · Sales Director</p>
                  <p>Falkenberg Maschinenbau GmbH</p>
                  <p>+49 170 111 2233</p>
                  <p>alex.meyer@falkenberg.de</p>
                </div>
              </div>
              <div className="flex gap-3">
                {[
                  { label: "vCard", tone: "bg-ink-900 text-sand-100" },
                  { label: "CSV", tone: "bg-sand-100 text-ink-700" },
                  { label: "JSON", tone: "bg-sand-100 text-ink-700" },
                ].map((item) => (
                  <span
                    key={item.label}
                    className={`rounded-full px-4 py-2 text-xs font-semibold ${item.tone}`}
                  >
                    {item.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          {benefits.map((item) => (
            <div
              key={item.titleDe}
              className="rounded-3xl border border-ink-200/70 bg-white/80 p-6 shadow-soft"
            >
              <h3 className="text-lg font-semibold">{item.titleDe}</h3>
              <p className="mt-2 text-sm text-ink-600">{item.copyDe}</p>
              <p className="mt-3 text-sm text-ink-500">{item.titleEn}</p>
              <p className="mt-2 text-xs text-ink-400">{item.copyEn}</p>
            </div>
          ))}
        </section>

        <section className="rounded-[32px] border border-ink-200/70 bg-white/75 p-8 shadow-soft">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-500">
                Workflow
              </p>
              <h2 className="mt-3 text-3xl font-semibold">
                Vom Scan bis Export - in einem klaren Ablauf.
              </h2>
              <p className="mt-2 text-sm text-ink-500">
                From scan to export in one seamless flow.
              </p>
            </div>
            <div className="rounded-full border border-ink-200/70 bg-sand-50 px-4 py-2 text-xs font-semibold text-ink-600">
              Optimiert für Messen & Sales Teams
            </div>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-4">
            {workflowSteps.map((item, index) => (
              <div
                key={item.titleDe}
                className="rounded-2xl border border-ink-200/70 bg-white p-4"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-400">
                  0{index + 1}
                </p>
                <h3 className="mt-2 text-base font-semibold text-ink-900">
                  {item.titleDe}
                </h3>
                <p className="mt-2 text-sm text-ink-600">{item.copyDe}</p>
                <p className="mt-3 text-xs text-ink-400">{item.titleEn}</p>
                <p className="mt-1 text-xs text-ink-400">{item.copyEn}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[32px] border border-ink-200/70 bg-white/80 p-8 shadow-soft">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-500">
              Video Demo
            </p>
            <h2 className="mt-3 text-3xl font-semibold">
              Upload + Generierung als Video - sofort nachvollziehbar.
            </h2>
            <p className="mt-2 text-sm text-ink-500">
              Watch the full capture-to-contact flow in under 60 seconds.
            </p>
            <div className="mt-6 aspect-video rounded-3xl border border-ink-200/70 bg-gradient-to-br from-sand-50 to-white p-6">
              <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-ink-200/70 bg-white/60">
                <div className="flex flex-col items-center gap-2 text-ink-500">
                  <span className="text-4xl">PLAY</span>
                  <span className="text-xs uppercase tracking-[0.3em]">
                    Demo Video
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[32px] border border-ink-200/70 bg-white/80 p-8 shadow-soft">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-500">
              Export
            </p>
            <h2 className="mt-3 text-3xl font-semibold">
              Export in allen Formaten, die Teams wirklich brauchen.
            </h2>
            <p className="mt-2 text-sm text-ink-500">
              Export to vCard, CSV, JSON, or your CRM mapping templates.
            </p>
            <div className="mt-6 grid gap-4">
              {[
                {
                  title: "vCard",
                  descDe: "Für Apple Kontakte, Outlook & iOS.",
                  descEn: "For Apple Contacts, Outlook & iOS.",
                },
                {
                  title: "CSV",
                  descDe: "Für CRM-Importe, Events & Reporting.",
                  descEn: "For CRM imports, events & reporting.",
                },
                {
                  title: "JSON",
                  descDe: "Für Integrationen in interne Systeme.",
                  descEn: "For internal integrations and pipelines.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-ink-200/70 bg-white p-4"
                >
                  <h3 className="text-base font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm text-ink-600">{item.descDe}</p>
                  <p className="mt-2 text-xs text-ink-400">{item.descEn}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="rounded-[32px] border border-ink-200/70 bg-white/80 p-8 shadow-soft">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-500">
                Preise
              </p>
              <h2 className="mt-3 text-3xl font-semibold">
                Ein besseres Abo, das schlank startet und groß skaliert.
              </h2>
              <p className="mt-2 text-sm text-ink-500">
                Simple plans for teams that process real lead volume.
              </p>
            </div>
            <div className="rounded-full border border-ink-200/70 bg-sand-50 px-4 py-2 text-xs font-semibold text-ink-600">
              Monatlich kündbar
            </div>
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {pricing.map((plan) => (
              <div
                key={plan.name}
                className="rounded-3xl border border-ink-200/70 bg-white p-6"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  <span className="rounded-full bg-sand-50 px-3 py-1 text-xs font-semibold text-ink-500">
                    Abo
                  </span>
                </div>
                <div className="mt-4 flex items-end gap-2">
                  <span className="text-3xl font-semibold text-ink-900">
                    {plan.price}
                  </span>
                  <span className="text-sm text-ink-500">{plan.cadence}</span>
                </div>
                <div className="mt-5 flex flex-col gap-2 text-sm text-ink-600">
                  {plan.highlights.map((item) => (
                    <div key={item} className="flex items-center gap-2">
                      <span className="text-ink-500">-</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
                <button className="mt-6 w-full rounded-full border border-ink-200/70 px-5 py-2 text-sm font-semibold text-ink-700">
                  Angebot anfragen
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          {[
            {
              titleDe: "Sicher & sauber",
              titleEn: "Secure & clean",
              copyDe:
                "Daten bleiben strukturiert, nachvollziehbar und revisionssicher.",
              copyEn:
                "Data stays structured, traceable, and audit-friendly for teams.",
            },
            {
              titleDe: "Ready für CRM",
              titleEn: "CRM-ready",
              copyDe:
                "Export-Vorlagen passen Felder exakt an HubSpot, Salesforce & Co. an.",
              copyEn:
                "Export templates map fields precisely to HubSpot, Salesforce, and more.",
            },
          ].map((item) => (
            <div
              key={item.titleDe}
              className="rounded-3xl border border-ink-200/70 bg-white/80 p-6 shadow-soft"
            >
              <h3 className="text-lg font-semibold">{item.titleDe}</h3>
              <p className="mt-2 text-sm text-ink-600">{item.copyDe}</p>
              <p className="mt-3 text-sm text-ink-500">{item.titleEn}</p>
              <p className="mt-2 text-xs text-ink-400">{item.copyEn}</p>
            </div>
          ))}
        </section>

        <section className="rounded-[32px] border border-ink-200/70 bg-ink-900 p-10 text-sand-50 shadow-soft">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sand-100/60">
                Let's go
              </p>
              <h2 className="mt-3 text-3xl font-semibold">
                Demo starten und den Unterschied sehen.
              </h2>
              <p className="mt-2 text-sm text-sand-100/70">
                Start your demo now and see the capture-to-CRM flow.
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              {data.user ? (
                <Link
                  href="/dashboard"
                  className="rounded-full bg-sand-100 px-6 py-3 text-sm font-semibold text-ink-900"
                >
                  Zum Dashboard
                </Link>
              ) : (
                <Link
                  href={primaryHref}
                  className="rounded-full bg-sand-100 px-6 py-3 text-sm font-semibold text-ink-900"
                >
                  Demo starten
                </Link>
              )}
              <Link
                href="#pricing"
                className="rounded-full border border-sand-100/40 px-6 py-3 text-sm font-semibold text-sand-100"
              >
                Preise vergleichen
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
