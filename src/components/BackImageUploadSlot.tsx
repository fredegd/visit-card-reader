"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { prepareCardImage } from "@/lib/upload/card-images";
import { cn } from "@/lib/utils";

type BackImageUploadSlotProps = {
  cardId: string;
  label?: string;
  showMessage?: boolean;
  className?: string;
};

export default function BackImageUploadSlot({
  cardId,
  label,
  showMessage = true,
  className,
}: BackImageUploadSlotProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState<
    "idle" | "uploading" | "error" | "done"
  >("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [enhanced, setEnhanced] = useState(false);
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const handlePick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;

    setStatus("uploading");
    setMessage(null);

    try {
      const prepared = await prepareCardImage({
        file,
        side: "back",
        enhanced,
        supabase,
      });
      const { qr_text: qrText, ...payload } = prepared;

      const response = await fetch(`/api/cards/${cardId}/images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          side: "back",
          image: payload,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to save image.");
      }

      setStatus("done");
      setMessage("Back image uploaded. OCR running in background.");
      router.refresh();

      void fetch(`/api/cards/${cardId}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qr: { front: null, back: qrText ?? null },
        }),
      })
        .then(async (processResponse) => {
          if (!processResponse.ok) {
            const errorText = await processResponse.text();
            throw new Error(errorText || "Failed to process card.");
          }
          setMessage("Back image processed.");
          router.refresh();
        })
        .catch((error) => {
          const errorMessage =
            error instanceof Error ? error.message : "OCR failed.";
          setStatus("error");
          setMessage(errorMessage);
        });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Upload failed.";
      setStatus("error");
      setMessage(errorMessage);
    } finally {
      event.target.value = "";
    }
  };

  return (
    <div className="grid gap-2">
      {label ? (
        <p className="text-sm font-semibold text-ink-700">{label}</p>
      ) : null}
      <div
        className={cn(
          "flex min-h-[12rem] items-center justify-center rounded-2xl border border-dashed border-ink-200/70 bg-sand-50",
          className,
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handlePick}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={status === "uploading"}
          className="inline-flex items-center gap-2 rounded-full border border-ink-200/70 bg-white px-4 py-2 text-xs font-semibold text-ink-700 transition hover:border-ink-400 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full border border-ink-300 text-base leading-none">
            +
          </span>
          {status === "uploading" ? "Uploading..." : "Add back image"}
        </button>
      </div>
      <label className="flex items-center gap-3 text-xs text-ink-600">
        <input
          type="checkbox"
          checked={enhanced}
          onChange={(event) => setEnhanced(event.target.checked)}
          className="h-4 w-4 rounded border border-ink-300"
          disabled={status === "uploading"}
        />
        Enhanced crop (uses OpenCV)
      </label>
      {showMessage && message ? (
        <p
          className={`text-xs ${
            status === "error" ? "text-rose-600" : "text-ink-500"
          }`}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
