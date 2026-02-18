import CardDetailForm from "@/components/CardDetailForm";
import DeleteCardButton from "@/components/DeleteCardButton";
import ProcessingPanel from "@/components/ProcessingPanel";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CardImageRecord, CardRecord, ExtractedContact } from "@/lib/types";

export default async function CardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: card, error } = await supabase
    .from("cards")
    .select(
      "id, user_id, status, extracted_json, normalized, full_name, company, title, primary_email, primary_phone, primary_website, raw_ocr, provider, error_message, created_at, updated_at",
    )
    .eq("id", id)
    .single();

  if (error || !card) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
        {error?.message ?? "Card not found."}
      </div>
    );
  }

  const { data: images } = await supabase
    .from("card_images")
    .select("id, user_id, card_id, side, storage_path, cropped_path, cropped_width, cropped_height, crop_confidence, mime, width, height, checksum, created_at, updated_at")
    .eq("card_id", card.id);

  const imageList = (images ?? []) as CardImageRecord[];
  const frontImage = imageList.find((img) => img.side === "front");
  const backImage = imageList.find((img) => img.side === "back");

  const [frontSigned, backSigned] = await Promise.all([
    frontImage
      ? supabase.storage
          .from("card-images")
          .createSignedUrl(
            frontImage.cropped_path ?? frontImage.storage_path,
            60 * 60,
          )
      : Promise.resolve({ data: null, error: null }),
    backImage
      ? supabase.storage
          .from("card-images")
          .createSignedUrl(
            backImage.cropped_path ?? backImage.storage_path,
            60 * 60,
          )
      : Promise.resolve({ data: null, error: null }),
  ]);

  const placeholder = {
    name: "",
    company: "",
    title: "",
    emails: [],
    phones: [],
    websites: [],
    address: "",
    notes: "",
  } satisfies ExtractedContact;

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            {card.full_name || card.company || card.normalized?.full_name || "Visit card"}
          </h1>
          <p className="text-sm text-ink-500">
            Status: <span className="capitalize">{card.status}</span>
          </p>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {[
          {
            label: "Front",
            image: frontImage,
            signedUrl: frontSigned.data?.signedUrl ?? null,
          },
          {
            label: "Back",
            image: backImage,
            signedUrl: backSigned.data?.signedUrl ?? null,
          },
        ].map(({ label, image, signedUrl }) => (
          <div
            key={label}
            className="rounded-3xl border border-ink-200/70 bg-white/80 p-4 shadow-soft"
          >
            <p className="text-sm font-semibold text-ink-700">{label}</p>
            {image ? (
              signedUrl ? (
                <img
                  src={signedUrl}
                  alt={`${label} card`}
                  className="mt-3 max-h-80 h-auto w-full rounded-2xl object-cover"
                />
              ) : (
                <p className="mt-2 text-xs text-ink-500">
                  Signed URL unavailable
                </p>
              )
            ) : (
              <p className="mt-2 text-xs text-ink-500">Not uploaded</p>
            )}
          </div>
        ))}
      </div>

      {card.status === "processing" || card.status === "uploaded" ? (
        <ProcessingPanel status={card.status} cardId={card.id} />
      ) : card.status === "error" ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
          {card.error_message ?? "Processing failed."}
          <div className="mt-4">
            <DeleteCardButton cardId={card.id} label="Delete card" />
          </div>
        </div>
      ) : (
        <CardDetailForm
          cardId={card.id}
          initial={(card.extracted_json as ExtractedContact) ?? placeholder}
        />
      )}
    </div>
  );
}
