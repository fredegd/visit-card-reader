import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const imageSchema = z.object({
  storage_path: z.string(),
  cropped_path: z.string().optional().nullable(),
  cropped_width: z.number().optional().nullable(),
  cropped_height: z.number().optional().nullable(),
  crop_confidence: z.number().optional().nullable(),
  mime: z.string().optional().nullable(),
  width: z.number().optional().nullable(),
  height: z.number().optional().nullable(),
  checksum: z.string().optional().nullable(),
});

const bodySchema = z.object({
  front: imageSchema,
  back: imageSchema.optional().nullable(),
});

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: cards, error } = await supabase
    .from("cards")
    .select(
      "id, user_id, status, extracted_json, normalized, full_name, company, title, primary_email, primary_phone, primary_website, raw_ocr, provider, error_message, created_at, updated_at",
    )
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(cards ?? []);
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: z.infer<typeof bodySchema>;
  try {
    payload = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "Invalid payload." },
      { status: 400 },
    );
  }

  const { data: card, error: cardError } = await supabase
    .from("cards")
    .insert({
      user_id: data.user.id,
      status: "uploaded",
      provider: "mistral-ocr-2512",
    })
    .select()
    .single();

  if (cardError || !card) {
    return NextResponse.json(
      { error: cardError?.message ?? "Failed to create card." },
      { status: 500 },
    );
  }

  if (!card.id) {
    return NextResponse.json(
      { error: "Card ID missing after insert." },
      { status: 500 },
    );
  }

  const imagesToInsert = [
    {
      user_id: data.user.id,
      card_id: card.id,
      side: "front",
      ...payload.front,
    },
    payload.back
      ? {
          user_id: data.user.id,
          card_id: card.id,
          side: "back",
          ...payload.back,
        }
      : null,
  ].filter(Boolean) as Array<Record<string, unknown>>;

  const { data: images, error: imageError } = await supabase
    .from("card_images")
    .insert(imagesToInsert)
    .select();

  if (imageError) {
    return NextResponse.json({ error: imageError.message }, { status: 500 });
  }

  const frontImage = images?.find((img) => img.side === "front");
  const backImage = images?.find((img) => img.side === "back");

  const { error: updateError } = await supabase
    .from("cards")
    .update({
      front_image_id: frontImage?.id ?? null,
      back_image_id: backImage?.id ?? null,
    })
    .eq("id", card.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ id: card.id });
}
