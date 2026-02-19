"use client";

import { useState } from "react";
import DeleteCardButton from "@/components/DeleteCardButton";
import OcrSelectionPanel from "@/components/OcrSelectionPanel";
import type { ContactValue, ExtractedContact, LabeledValue } from "@/lib/types";
import { extractContactFromText, toLabeledList } from "@/lib/extract/contact";
import { mergeContacts } from "@/lib/extract/merge";

export default function CardDetailForm({
  cardId,
  initial,
  images,
}: {
  cardId: string;
  initial: ExtractedContact;
  images?: Array<{
    label: string;
    side: "front" | "back";
    signedUrl: string | null;
    rawOcr?: unknown | null;
  }>;
}) {
  const [form, setForm] = useState<ExtractedContact>(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [rerunStatus, setRerunStatus] = useState<"idle" | "running" | "error">(
    "idle",
  );
  const [activeDropTarget, setActiveDropTarget] = useState<DropTarget | null>(
    null,
  );

  type DropTarget =
    | "name"
    | "company"
    | "title"
    | "emails"
    | "phones"
    | "faxes"
    | "websites"
    | "address"
    | "notes";

  const updateField = (key: keyof ExtractedContact, value: string) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const updateList = (key: "emails" | "websites", value: string) => {
    setForm((prev) => ({
      ...prev,
      [key]: value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
    }));
  };

  const parseLabeled = (value: string): LabeledValue[] => {
    return value
      .split(/\r?\n|,/)
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const [label, ...rest] = entry.split(":");
        if (rest.length === 0) {
          return { value: label.trim() };
        }
        return { label: label.trim() || undefined, value: rest.join(":").trim() };
      });
  };

  const serializeLabeled = (values: LabeledValue[]) => {
    return values
      .map((item) => (item.label ? `${item.label}: ${item.value}` : item.value))
      .join("\n");
  };

  const updatePhones = (value: string) => {
    setForm((prev) => ({
      ...prev,
      phones: parseLabeled(value),
    }));
  };

  const updateFaxes = (value: string) => {
    setForm((prev) => ({
      ...prev,
      faxes: parseLabeled(value),
    }));
  };

  const updateAddress = (value: string) => {
    const lines = value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    setForm((prev) => ({
      ...prev,
      address: parseLabeled(lines.join("\n")),
    }));
  };

  const normalizeDropText = (value: string) => value.replace(/\s+/g, " ").trim();

  const extractDropItems = (value: string) => {
    return value
      .split(/[\s,;]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  };

  const dedupeStrings = (items: string[]) => Array.from(new Set(items));

  const dedupeLabeled = (items: LabeledValue[]) => {
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = `${item.label ?? ""}:${item.value}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const applyDropText = (target: DropTarget, rawText: string) => {
    const text = normalizeDropText(rawText);
    if (!text) return;

    setForm((prev) => {
      if (target === "name" || target === "company" || target === "title") {
        return { ...prev, [target]: text };
      }

      if (target === "emails" || target === "websites") {
        const items = extractDropItems(text);
        const current = target === "emails" ? prev.emails ?? [] : prev.websites ?? [];
        const merged = dedupeStrings([...current, ...items]);
        return { ...prev, [target]: merged };
      }

      if (target === "phones" || target === "faxes") {
        const current = toLabeledList(
          target === "phones" ? prev.phones : prev.faxes,
        );
        const incoming = parseLabeled(text);
        const merged = dedupeLabeled([...current, ...incoming]);
        return { ...prev, [target]: merged };
      }

      if (target === "address") {
        const current = toLabeledList(prev.address);
        const merged = dedupeLabeled([...current, { value: text }]);
        return { ...prev, address: merged };
      }

      if (target === "notes") {
        const existing = prev.notes?.trim();
        const next = existing ? `${existing}\n${text}` : text;
        return { ...prev, notes: next };
      }

      return prev;
    });
  };

  const handleDrop =
    (target: DropTarget) => (event: React.DragEvent<HTMLElement>) => {
      event.preventDefault();
      const text =
        event.dataTransfer.getData("application/x-ocr-text") ||
        event.dataTransfer.getData("text/plain");
      if (!text) return;
      applyDropText(target, text);
    };

  const handleDragOver = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const handleActivateTarget = (target: DropTarget) => {
    setActiveDropTarget(target);
  };

  const applySelectionText = (text: string) => {
    const extracted = extractContactFromText(text);
    setForm((prev) => mergeContacts(extracted, prev));
  };

  const applySelectionToActiveTarget = (text: string) => {
    if (!activeDropTarget) return;
    applyDropText(activeDropTarget, text);
  };

  const activeTargetLabel = activeDropTarget
    ? {
        name: "Name",
        company: "Company",
        title: "Title",
        emails: "Email(s)",
        phones: "Phone(s)",
        faxes: "Fax(es)",
        websites: "Website(s)",
        address: "Address",
        notes: "Notes",
      }[activeDropTarget]
    : null;

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

  const handleRerun = async () => {
    if (!confirm("Re-run OCR on this card?")) return;
    setRerunStatus("running");
    try {
      const response = await fetch(`/api/cards/${cardId}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qr: { front: null, back: null } }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Unable to re-run OCR.");
      }

      setRerunStatus("idle");
      window.location.reload();
    } catch {
      setRerunStatus("error");
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

      {images && images.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {images.map((image) => (
            <OcrSelectionPanel
              key={image.side}
              label={image.label}
              imageUrl={image.signedUrl}
              rawOcr={image.rawOcr ?? null}
              onApplySelection={applySelectionText}
              activeTargetLabel={activeTargetLabel}
              onApplyToActiveTarget={applySelectionToActiveTarget}
            />
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-1 text-sm">
          Name
          <input
            value={form.name ?? ""}
            onChange={(event) => updateField("name", event.target.value)}
            onDragOver={handleDragOver}
            onDrop={handleDrop("name")}
            onClick={() => handleActivateTarget("name")}
            onFocus={() => handleActivateTarget("name")}
            className={`rounded-xl border bg-sand-50 px-3 py-2 ${
              activeDropTarget === "name"
                ? "border-ink-800 ring-2 ring-ink-200"
                : "border-ink-200/70"
            }`}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Company
          <input
            value={form.company ?? ""}
            onChange={(event) => updateField("company", event.target.value)}
            onDragOver={handleDragOver}
            onDrop={handleDrop("company")}
            onClick={() => handleActivateTarget("company")}
            onFocus={() => handleActivateTarget("company")}
            className={`rounded-xl border bg-sand-50 px-3 py-2 ${
              activeDropTarget === "company"
                ? "border-ink-800 ring-2 ring-ink-200"
                : "border-ink-200/70"
            }`}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Title
          <input
            value={form.title ?? ""}
            onChange={(event) => updateField("title", event.target.value)}
            onDragOver={handleDragOver}
            onDrop={handleDrop("title")}
            onClick={() => handleActivateTarget("title")}
            onFocus={() => handleActivateTarget("title")}
            className={`rounded-xl border bg-sand-50 px-3 py-2 ${
              activeDropTarget === "title"
                ? "border-ink-800 ring-2 ring-ink-200"
                : "border-ink-200/70"
            }`}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Email(s)
          <input
            value={form.emails?.join(", ") ?? ""}
            onChange={(event) => updateList("emails", event.target.value)}
            onDragOver={handleDragOver}
            onDrop={handleDrop("emails")}
            onClick={() => handleActivateTarget("emails")}
            onFocus={() => handleActivateTarget("emails")}
            className={`rounded-xl border bg-sand-50 px-3 py-2 ${
              activeDropTarget === "emails"
                ? "border-ink-800 ring-2 ring-ink-200"
                : "border-ink-200/70"
            }`}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Phone(s)
          <textarea
            value={serializeLabeled(toLabeledList(form.phones))}
            onChange={(event) => updatePhones(event.target.value)}
            onDragOver={handleDragOver}
            onDrop={handleDrop("phones")}
            onClick={() => handleActivateTarget("phones")}
            onFocus={() => handleActivateTarget("phones")}
            className={`min-h-[90px] rounded-xl border bg-sand-50 px-3 py-2 ${
              activeDropTarget === "phones"
                ? "border-ink-800 ring-2 ring-ink-200"
                : "border-ink-200/70"
            }`}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Fax(es)
          <textarea
            value={serializeLabeled(toLabeledList(form.faxes))}
            onChange={(event) => updateFaxes(event.target.value)}
            onDragOver={handleDragOver}
            onDrop={handleDrop("faxes")}
            onClick={() => handleActivateTarget("faxes")}
            onFocus={() => handleActivateTarget("faxes")}
            className={`min-h-[90px] rounded-xl border bg-sand-50 px-3 py-2 ${
              activeDropTarget === "faxes"
                ? "border-ink-800 ring-2 ring-ink-200"
                : "border-ink-200/70"
            }`}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Website(s)
          <input
            value={form.websites?.join(", ") ?? ""}
            onChange={(event) => updateList("websites", event.target.value)}
            onDragOver={handleDragOver}
            onDrop={handleDrop("websites")}
            onClick={() => handleActivateTarget("websites")}
            onFocus={() => handleActivateTarget("websites")}
            className={`rounded-xl border bg-sand-50 px-3 py-2 ${
              activeDropTarget === "websites"
                ? "border-ink-800 ring-2 ring-ink-200"
                : "border-ink-200/70"
            }`}
          />
        </label>
        <label className="grid gap-1 text-sm md:col-span-2">
          Address
          <textarea
            value={serializeLabeled(toLabeledList(form.address))}
            onChange={(event) => updateAddress(event.target.value)}
            onDragOver={handleDragOver}
            onDrop={handleDrop("address")}
            onClick={() => handleActivateTarget("address")}
            onFocus={() => handleActivateTarget("address")}
            className={`min-h-[90px] rounded-xl border bg-sand-50 px-3 py-2 ${
              activeDropTarget === "address"
                ? "border-ink-800 ring-2 ring-ink-200"
                : "border-ink-200/70"
            }`}
          />
        </label>
        <label className="grid gap-1 text-sm md:col-span-2">
          Notes
          <textarea
            value={form.notes ?? ""}
            onChange={(event) => updateField("notes", event.target.value)}
            onDragOver={handleDragOver}
            onDrop={handleDrop("notes")}
            onClick={() => handleActivateTarget("notes")}
            onFocus={() => handleActivateTarget("notes")}
            className={`min-h-[120px] rounded-xl border bg-sand-50 px-3 py-2 ${
              activeDropTarget === "notes"
                ? "border-ink-800 ring-2 ring-ink-200"
                : "border-ink-200/70"
            }`}
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
        <button
          type="button"
          onClick={handleRerun}
          className="rounded-full border border-ink-200/70 px-5 py-2 text-sm font-semibold text-ink-700"
          disabled={rerunStatus === "running"}
        >
          {rerunStatus === "running" ? "Re-running..." : "Re-run OCR"}
        </button>
        <DeleteCardButton cardId={cardId} />
        {status === "saved" ? (
          <span className="text-xs text-emerald-600">Saved</span>
        ) : null}
        {status === "error" ? (
          <span className="text-xs text-rose-600">Save failed</span>
        ) : null}
        {rerunStatus === "error" ? (
          <span className="text-xs text-rose-600">Re-run failed</span>
        ) : null}
      </div>
    </div>
  );
}
