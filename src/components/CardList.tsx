import Link from "next/link";
import CardStatusBadge from "@/components/CardStatusBadge";
import type { CardRecord } from "@/lib/types";

export default function CardList({ cards }: { cards: CardRecord[] }) {
  if (cards.length === 0) {
    return (
      <div className="rounded-3xl border border-ink-200/70 bg-white/80 p-8 shadow-soft">
        <h3 className="text-lg font-semibold">No cards yet</h3>
        <p className="mt-2 text-sm text-ink-500">
          Upload your first visit card to see it appear here.
        </p>
        <Link
          href="/cards/new"
          className="mt-6 inline-flex items-center justify-center rounded-full bg-ink-900 px-5 py-2 text-sm font-semibold text-sand-100"
        >
          Add a card
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {cards.map((card) => (
        <Link
          key={card.id}
          href={`/cards/${card.id}`}
          className="group rounded-3xl border border-ink-200/70 bg-white/80 p-5 shadow-soft transition hover:border-ink-400"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-ink-900">
                {card.full_name || card.company || card.normalized?.full_name || "Untitled card"}
              </h3>
              <p className="text-xs text-ink-500">
                {new Date(card.created_at).toLocaleDateString()}
              </p>
            </div>
            <CardStatusBadge status={card.status} />
          </div>
          <div className="mt-4 text-sm text-ink-600">
            <p>{card.title ?? card.normalized?.title ?? ""}</p>
            <p>{card.primary_email ?? card.primary_phone ?? card.normalized?.primary_email ?? card.normalized?.primary_phone ?? ""}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
