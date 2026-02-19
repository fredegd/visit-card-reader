"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { prepareCardImage } from "@/lib/upload/card-images";

type UploadFile = {
  file: File | null;
  previewUrl?: string;
};

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function UploadCardForm() {
  const [front, setFront] = useState<UploadFile>({ file: null });
  const [back, setBack] = useState<UploadFile>({ file: null });
  const [enhanced, setEnhanced] = useState(false);
  const [status, setStatus] = useState<"idle" | "uploading" | "processing" | "error">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  const supabase = createSupabaseBrowserClient();

  const handlePick = (
    side: "front" | "back",
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    if (side === "front") {
      setFront((prev) => {
        if (prev.previewUrl) URL.revokeObjectURL(prev.previewUrl);
        return { file, previewUrl };
      });
    }
    if (side === "back") {
      setBack((prev) => {
        if (prev.previewUrl) URL.revokeObjectURL(prev.previewUrl);
        return { file, previewUrl };
      });
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);

    if (!front.file) {
      setMessage("Please upload at least the front of the card.");
      return;
    }

    setStatus("uploading");

    try {
      const frontMeta = await prepareCardImage({
        file: front.file,
        side: "front",
        enhanced,
        supabase,
      });
      const backMeta = back.file
        ? await prepareCardImage({
            file: back.file,
            side: "back",
            enhanced,
            supabase,
          })
        : null;

      const { qr_text: frontQrText, ...frontPayload } = frontMeta;
      const { qr_text: backQrText, ...backPayload } = backMeta ?? {};

      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          front: frontPayload,
          back: backMeta ? backPayload : null,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to create card.");
      }

      const payload = (await response.json().catch(() => null)) as
        | { id?: string; error?: string }
        | null;

      if (!payload?.id || !uuidRegex.test(payload.id)) {
        throw new Error(payload?.error ?? "Card ID missing.");
      }

      setStatus("processing");

      const processResponse = await fetch(`/api/cards/${payload.id}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qr: {
            front: frontQrText ?? null,
            back: backQrText ?? null,
          },
        }),
      });

      if (!processResponse.ok) {
        const errorText = await processResponse.text();
        throw new Error(errorText || "Failed to process card.");
      }

      router.push(`/cards/${payload.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed.";
      setMessage(message);
      setStatus("error");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-6 rounded-3xl border border-ink-200/70 bg-white/80 p-6 shadow-soft backdrop-blur"
    >
      <div>
        <h2 className="text-xl font-semibold">Upload visit card</h2>
        <p className="text-sm text-ink-500">
          Add the front image (required) and optionally the back side.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {[{ label: "Front", side: "front" as const, state: front }, { label: "Back", side: "back" as const, state: back }].map(
          ({ label, side, state }) => (
            <label
              key={side}
              className={cn(
                "group flex min-h-[220px] cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-ink-200/70 bg-sand-50/80 p-4 text-center transition hover:border-ink-400",
                state.file ? "border-solid" : "",
              )}
            >
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => handlePick(side, event)}
              />
              <div className="text-sm font-semibold text-ink-700">{label}</div>
              {state.previewUrl ? (
                <img
                  src={state.previewUrl}
                  alt={`${label} preview`}
                  className="max-h-80 h-auto w-full rounded-xl object-cover"
                />
              ) : (
                <div className="text-xs text-ink-500">
                  Drop an image or click to browse
                </div>
              )}
            </label>
          ),
        )}
      </div>

      <label className="flex items-center gap-3 text-sm text-ink-600">
        <input
          type="checkbox"
          checked={enhanced}
          onChange={(event) => setEnhanced(event.target.checked)}
          className="h-4 w-4 rounded border border-ink-300"
        />
        Enhanced crop (uses OpenCV)
      </label>

      {message ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {message}
        </div>
      ) : null}

      <button
        type="submit"
        className="inline-flex items-center justify-center rounded-full bg-ink-900 px-6 py-3 text-sm font-semibold text-sand-100 transition hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-70"
        disabled={status === "uploading" || status === "processing"}
      >
        {status === "uploading"
          ? "Uploading..."
          : status === "processing"
            ? "Processing..."
            : "Analyze card"}
      </button>
    </form>
  );
}
