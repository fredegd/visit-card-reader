import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mistralOcrClient } from "@/lib/ocr/mistral";
import { extractContactFromText, normalizeContact } from "@/lib/extract/contact";
import { extractContactFromQrPayload } from "@/lib/extract/qr";
import { mergeContacts } from "@/lib/extract/merge";

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!uuidRegex.test(id)) {
    return NextResponse.json({ error: "Invalid card id." }, { status: 400 });
  }
  let qrPayload: { front?: string | null; back?: string | null } | null = null;
  try {
    const body = await request.json();
    if (body && typeof body === "object" && "qr" in body) {
      const qr = (body as { qr?: unknown }).qr;
      if (qr && typeof qr === "object") {
        qrPayload = qr as { front?: string | null; back?: string | null };
      }
    }
  } catch {
    qrPayload = null;
  }
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: card, error } = await supabase
    .from("cards")
    .select("id, user_id, status")
    .eq("id", id)
    .single();

  if (error || !card) {
    return NextResponse.json({ error: error?.message }, { status: 404 });
  }

  const { data: images, error: imageError } = await supabase
    .from("card_images")
    .select("id, storage_path, cropped_path, side")
    .eq("card_id", card.id);

  if (imageError) {
    return NextResponse.json({ error: imageError.message }, { status: 500 });
  }

  const front = images?.find((img) => img.side === "front");
  const back = images?.find((img) => img.side === "back");

  if (!front) {
    return NextResponse.json(
      { error: "Front image missing." },
      { status: 400 },
    );
  }

  await supabase
    .from("cards")
    .update({ status: "processing", error_message: null })
    .eq("id", card.id);

  try {
    const frontPath = front.cropped_path ?? front.storage_path;
    const signedFront = await supabase.storage
      .from("card-images")
      .createSignedUrl(frontPath, 60 * 10);

    if (signedFront.error || !signedFront.data) {
      throw new Error(signedFront.error?.message ?? "Unable to sign URL.");
    }

    const frontResult = await mistralOcrClient.process({
      imageUrl: signedFront.data.signedUrl,
    });

    let backResult = null as null | { raw: unknown; text: string };

    if (back) {
      const backPath = back.cropped_path ?? back.storage_path;
      const signedBack = await supabase.storage
        .from("card-images")
        .createSignedUrl(backPath, 60 * 10);

      if (signedBack.error || !signedBack.data) {
        throw new Error(signedBack.error?.message ?? "Unable to sign URL.");
      }

      backResult = await mistralOcrClient.process({
        imageUrl: signedBack.data.signedUrl,
      });
    }

    const combinedText = [frontResult.text, backResult?.text]
      .filter(Boolean)
      .join("\n");

    let extracted = extractContactFromText(combinedText);
    const qrTexts = [qrPayload?.front, qrPayload?.back].filter(
      (value): value is string => Boolean(value),
    );
    if (qrTexts.length > 0) {
      const qrExtracted = qrTexts.reduce((acc, qrText) => {
        const qrData = extractContactFromQrPayload(qrText);
        return mergeContacts(acc, qrData);
      }, {} as ReturnType<typeof extractContactFromQrPayload>);

      extracted = mergeContacts(extracted, qrExtracted);
    }
    const normalized = normalizeContact(extracted);

    const raw = {
      front: frontResult.raw,
      back: backResult?.raw ?? null,
    };

    await supabase
      .from("cards")
      .update({
        status: "ready",
        extracted_json: extracted,
        normalized,
        full_name: normalized.full_name ?? null,
        company: normalized.company ?? null,
        title: normalized.title ?? null,
        primary_email: normalized.primary_email ?? null,
        primary_phone: normalized.primary_phone ?? null,
        primary_website: normalized.primary_website ?? null,
        raw_ocr: raw,
        raw_qr: qrPayload,
        provider: mistralOcrClient.name,
      })
      .eq("id", card.id);

    return NextResponse.json({ status: "ready" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "OCR failed";
    await supabase
      .from("cards")
      .update({ status: "error", error_message: message })
      .eq("id", card.id);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
