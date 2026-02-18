import Link from "next/link";
import CardList from "@/components/CardList";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CardImageRecord, CardRecord } from "@/lib/types";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("cards")
    .select(
      "id, user_id, status, extracted_json, normalized, full_name, company, title, primary_email, primary_phone, primary_website, raw_ocr, provider, error_message, created_at, updated_at",
    )
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
        {error.message}
      </div>
    );
  }

  const cards = (data ?? []) as CardRecord[];
  const cardIds = cards.map((card) => card.id);
  let thumbnails: Record<string, string | null> = {};

  if (cardIds.length > 0) {
    const { data: images } = await supabase
      .from("card_images")
      .select("card_id, side, storage_path, cropped_path, created_at")
      .in("card_id", cardIds)
      .order("created_at", { ascending: true });

    type ThumbnailImage = Pick<
      CardImageRecord,
      "card_id" | "side" | "storage_path" | "cropped_path" | "created_at"
    >;

    const imageList = (images ?? []) as ThumbnailImage[];
    const imagesByCard = new Map<string, ThumbnailImage[]>();

    for (const image of imageList) {
      const existing = imagesByCard.get(image.card_id) ?? [];
      existing.push(image);
      imagesByCard.set(image.card_id, existing);
    }

    const selections = cardIds
      .map((cardId) => {
        const list = imagesByCard.get(cardId) ?? [];
        if (list.length === 0) return null;
        const front = list.find((img) => img.side === "front");
        const chosen = front ?? list[0];
        return {
          cardId,
          path: chosen.cropped_path ?? chosen.storage_path,
        };
      })
      .filter(
        (selection): selection is { cardId: string; path: string } =>
          Boolean(selection?.path),
      );

    const signedResults = await Promise.all(
      selections.map(async (selection) => {
        const { data: signed, error: signedError } = await supabase.storage
          .from("card-images")
          .createSignedUrl(selection.path, 60 * 60);
        return {
          cardId: selection.cardId,
          url: signedError ? null : signed?.signedUrl ?? null,
        };
      }),
    );

    thumbnails = signedResults.reduce<Record<string, string | null>>(
      (acc, result) => {
        acc[result.cardId] = result.url;
        return acc;
      },
      {},
    );
  }

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-ink-500">
            Track processing status and export contacts.
          </p>
        </div>
        <Link
          href="/cards/new"
          className="rounded-full bg-ink-900 px-5 py-2 text-sm font-semibold text-sand-100"
        >
          New upload
        </Link>
      </header>

      <CardList cards={cards} thumbnails={thumbnails} />
    </div>
  );
}
