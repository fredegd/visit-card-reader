import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  side: z.enum(["front", "back"]),
  image: imageSchema,
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!uuidRegex.test(id)) {
    return NextResponse.json({ error: "Invalid card id." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: z.infer<typeof bodySchema>;
  try {
    payload = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const { data: card, error: cardError } = await supabase
    .from("cards")
    .select("id, user_id")
    .eq("id", id)
    .single();

  if (cardError || !card) {
    return NextResponse.json({ error: cardError?.message }, { status: 404 });
  }

  const { data: existing, error: existingError } = await supabase
    .from("card_images")
    .select("id, storage_path, cropped_path")
    .eq("card_id", card.id)
    .eq("side", payload.side)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  let imageId = existing?.id ?? null;

  let removePaths: string[] = [];
  if (existing?.id) {
    const { data: updated, error: updateError } = await supabase
      .from("card_images")
      .update(payload.image)
      .eq("id", existing.id)
      .select("id")
      .single();

    if (updateError || !updated) {
      return NextResponse.json(
        { error: updateError?.message ?? "Unable to update image." },
        { status: 500 },
      );
    }

    imageId = updated.id;
    const nextPaths = [
      payload.image.storage_path,
      payload.image.cropped_path,
    ].filter(Boolean) as string[];
    const previousPaths = [
      existing.storage_path,
      existing.cropped_path,
    ].filter(Boolean) as string[];
    removePaths = previousPaths.filter((path) => !nextPaths.includes(path));
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from("card_images")
      .insert({
        user_id: data.user.id,
        card_id: card.id,
        side: payload.side,
        ...payload.image,
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      return NextResponse.json(
        { error: insertError?.message ?? "Unable to save image." },
        { status: 500 },
      );
    }

    imageId = inserted.id;
  }

  if (imageId) {
    const updatePayload =
      payload.side === "front"
        ? { front_image_id: imageId }
        : { back_image_id: imageId };

    const { error: updateError } = await supabase
      .from("cards")
      .update(updatePayload)
      .eq("id", card.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
  }

  if (removePaths.length > 0) {
    await supabase.storage.from("card-images").remove(removePaths);
  }

  return NextResponse.json({ id: imageId });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!uuidRegex.test(id)) {
    return NextResponse.json({ error: "Invalid card id." }, { status: 400 });
  }

  const url = new URL(request.url);
  const side = url.searchParams.get("side");
  if (side !== "front" && side !== "back") {
    return NextResponse.json({ error: "Invalid side." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: card, error: cardError } = await supabase
    .from("cards")
    .select("id, user_id")
    .eq("id", id)
    .single();

  if (cardError || !card) {
    return NextResponse.json({ error: cardError?.message }, { status: 404 });
  }

  const { data: image, error: imageError } = await supabase
    .from("card_images")
    .select("id, storage_path, cropped_path")
    .eq("card_id", card.id)
    .eq("side", side)
    .maybeSingle();

  if (imageError) {
    return NextResponse.json({ error: imageError.message }, { status: 500 });
  }

  if (!image) {
    return NextResponse.json({ error: "Image not found." }, { status: 404 });
  }

  const paths = [image.storage_path, image.cropped_path].filter(
    Boolean,
  ) as string[];

  if (paths.length > 0) {
    await supabase.storage.from("card-images").remove(paths);
  }

  const updatePayload =
    side === "front" ? { front_image_id: null } : { back_image_id: null };

  const { error: updateError } = await supabase
    .from("cards")
    .update(updatePayload)
    .eq("id", card.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const { error: deleteError } = await supabase
    .from("card_images")
    .delete()
    .eq("id", image.id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ status: "deleted" });
}
