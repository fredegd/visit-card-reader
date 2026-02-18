"use client";

import { useState } from "react";
import DeleteCardButton from "@/components/DeleteCardButton";
import type { ExtractedContact } from "@/lib/types";

export default function CardDetailForm({
  cardId,
  initial,
}: {
  cardId: string;
  initial: ExtractedContact;
}) {
  const [form, setForm] = useState<ExtractedContact>(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );

  const updateField = (key: keyof ExtractedContact, value: string) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const updateList = (key: "emails" | "phones" | "websites", value: string) => {
    setForm((prev) => ({
      ...prev,
      [key]: value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
    }));
  };

  const handleSave = async () => {
    setStatus("saving");
    try {
      const response = await fetch(`/api/cards/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extracted_json: form }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Unable to save.");
      }

      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="grid gap-6 rounded-3xl border border-ink-200/70 bg-white/80 p-6 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Extracted details</h2>
          <p className="text-sm text-ink-500">
            Review and edit before exporting.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={`/api/cards/${cardId}/export?format=vcf`}
            className="rounded-full border border-ink-200/70 px-4 py-2 text-xs font-semibold text-ink-700"
          >
            vCard
          </a>
          <a
            href={`/api/cards/${cardId}/export?format=csv`}
            className="rounded-full border border-ink-200/70 px-4 py-2 text-xs font-semibold text-ink-700"
          >
            CSV
          </a>
          <a
            href={`/api/cards/${cardId}/export?format=json`}
            className="rounded-full border border-ink-200/70 px-4 py-2 text-xs font-semibold text-ink-700"
          >
            JSON
          </a>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-1 text-sm">
          Name
          <input
            value={form.name ?? ""}
            onChange={(event) => updateField("name", event.target.value)}
            className="rounded-xl border border-ink-200/70 bg-sand-50 px-3 py-2"
          />
        </label>
        <label className="grid gap-1 text-sm">
          Company
          <input
            value={form.company ?? ""}
            onChange={(event) => updateField("company", event.target.value)}
            className="rounded-xl border border-ink-200/70 bg-sand-50 px-3 py-2"
          />
        </label>
        <label className="grid gap-1 text-sm">
          Title
          <input
            value={form.title ?? ""}
            onChange={(event) => updateField("title", event.target.value)}
            className="rounded-xl border border-ink-200/70 bg-sand-50 px-3 py-2"
          />
        </label>
        <label className="grid gap-1 text-sm">
          Email(s)
          <input
            value={form.emails?.join(", ") ?? ""}
            onChange={(event) => updateList("emails", event.target.value)}
            className="rounded-xl border border-ink-200/70 bg-sand-50 px-3 py-2"
          />
        </label>
        <label className="grid gap-1 text-sm">
          Phone(s)
          <input
            value={form.phones?.join(", ") ?? ""}
            onChange={(event) => updateList("phones", event.target.value)}
            className="rounded-xl border border-ink-200/70 bg-sand-50 px-3 py-2"
          />
        </label>
        <label className="grid gap-1 text-sm">
          Website(s)
          <input
            value={form.websites?.join(", ") ?? ""}
            onChange={(event) => updateList("websites", event.target.value)}
            className="rounded-xl border border-ink-200/70 bg-sand-50 px-3 py-2"
          />
        </label>
        <label className="grid gap-1 text-sm md:col-span-2">
          Address
          <input
            value={form.address ?? ""}
            onChange={(event) => updateField("address", event.target.value)}
            className="rounded-xl border border-ink-200/70 bg-sand-50 px-3 py-2"
          />
        </label>
        <label className="grid gap-1 text-sm md:col-span-2">
          Notes
          <textarea
            value={form.notes ?? ""}
            onChange={(event) => updateField("notes", event.target.value)}
            className="min-h-[120px] rounded-xl border border-ink-200/70 bg-sand-50 px-3 py-2"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          className="rounded-full bg-ink-900 px-5 py-2 text-sm font-semibold text-sand-100"
          disabled={status === "saving"}
        >
          {status === "saving" ? "Saving..." : "Save changes"}
        </button>
        <DeleteCardButton cardId={cardId} />
        {status === "saved" ? (
          <span className="text-xs text-emerald-600">Saved</span>
        ) : null}
        {status === "error" ? (
          <span className="text-xs text-rose-600">Save failed</span>
        ) : null}
      </div>
    </div>
  );
}
