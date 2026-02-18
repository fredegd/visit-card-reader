import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toVCard } from "@/lib/export/vcard";
import { toCsv } from "@/lib/export/csv";
import { toJson } from "@/lib/export/json";
import type { ExtractedContact } from "@/lib/types";

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
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

  const url = new URL(request.url);
  const format = url.searchParams.get("format")?.toLowerCase();

  if (!format || !["vcf", "csv", "json"].includes(format)) {
    return NextResponse.json({ error: "Invalid format." }, { status: 400 });
  }

  const { data: card, error } = await supabase
    .from("cards")
    .select("id, extracted_json")
    .eq("id", id)
    .single();

  if (error || !card) {
    return NextResponse.json({ error: error?.message }, { status: 404 });
  }

  const contact = (card.extracted_json ?? {}) as ExtractedContact;

  await supabase.from("card_exports").insert({
    user_id: data.user.id,
    card_id: card.id,
    format,
  });

  if (format === "vcf") {
    const vcard = toVCard(contact);
    return new Response(vcard, {
      headers: {
        "Content-Type": "text/vcard; charset=utf-8",
        "Content-Disposition": `attachment; filename="card-${card.id}.vcf"`,
      },
    });
  }

  if (format === "csv") {
    const csv = toCsv(contact);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="card-${card.id}.csv"`,
      },
    });
  }

  const json = toJson(contact);
  return new Response(json, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="card-${card.id}.json"`,
    },
  });
}
