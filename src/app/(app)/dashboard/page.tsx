import Link from "next/link";
import CardList from "@/components/CardList";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CardRecord } from "@/lib/types";

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

      <CardList cards={cards} />
    </div>
  );
}
