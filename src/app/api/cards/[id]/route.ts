import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeContact } from "@/lib/extract/contact";
import type { ExtractedContact } from "@/lib/types";

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const labeledValueSchema = z.object({
  label: z.string().optional().nullable(),
  value: z.string(),
});

const contactValueSchema = z.union([z.string(), labeledValueSchema]);

const patchSchema = z.object({
  extracted_json: z
    .object({
      name: z.string().optional().nullable(),
      company: z.string().optional().nullable(),
      title: z.string().optional().nullable(),
      emails: z.array(z.string()).optional().nullable(),
      phones: z.array(contactValueSchema).optional().nullable(),
      faxes: z.array(contactValueSchema).optional().nullable(),
      websites: z.array(z.string()).optional().nullable(),
      address: z.union([z.string(), z.array(contactValueSchema)]).optional().nullable(),
      notes: z.string().optional().nullable(),
      raw_text: z.string().optional().nullable(),
    })
    .optional(),
});

export async function GET(
  _request: Request,
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

  const { data: card, error } = await supabase
    .from("cards")
    .select(
      "id, user_id, status, extracted_json, normalized, full_name, company, title, primary_email, primary_phone, primary_website, raw_ocr, provider, error_message, created_at, updated_at",
    )
    .eq("id", id)
    .single();

  if (error || !card) {
    return NextResponse.json({ error: error?.message }, { status: 404 });
  }

  return NextResponse.json(card);
}

export async function PATCH(
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

  let payload: z.infer<typeof patchSchema>;
  try {
    payload = patchSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }
  const extracted = (payload.extracted_json ?? {}) as ExtractedContact;
  const normalized = normalizeContact(extracted);

  const { data: card, error } = await supabase
    .from("cards")
    .update({
      extracted_json: extracted,
      normalized,
      full_name: normalized.full_name ?? null,
      company: normalized.company ?? null,
      title: normalized.title ?? null,
      primary_email: normalized.primary_email ?? null,
      primary_phone: normalized.primary_phone ?? null,
      primary_website: normalized.primary_website ?? null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error || !card) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }

  return NextResponse.json(card);
}

export async function DELETE(
  _request: Request,
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

  const { data: images, error: imageError } = await supabase
    .from("card_images")
    .select("storage_path")
    .eq("card_id", id);

  if (imageError) {
    return NextResponse.json({ error: imageError.message }, { status: 500 });
  }

  const paths = (images ?? [])
    .map((img) => img.storage_path)
    .filter(Boolean);

  if (paths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from("card-images")
      .remove(paths);

    if (storageError) {
      return NextResponse.json(
        { error: storageError.message },
        { status: 500 },
      );
    }
  }

  const { error: deleteError } = await supabase
    .from("cards")
    .delete()
    .eq("id", id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ status: "deleted" });
}
