"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { prepareCardImage } from "@/lib/upload/card-images";
import { cn } from "@/lib/utils";

type CardImageActionsProps = {
  cardId: string;
  side: "front" | "back";
  hasImage?: boolean;
  className?: string;
};

type ActionStatus = "idle" | "uploading" | "processing" | "deleting" | "error";

export default function CardImageActions({
  cardId,
  side,
  hasImage = true,
  className,
}: CardImageActionsProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState<ActionStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const isBusy = status === "uploading" || status === "processing" || status === "deleting";

  const triggerPick = () => {
    if (isBusy) return;
    inputRef.current?.click();
  };

  const handlePick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;

    setStatus("uploading");
    setMessage(null);

    try {
      const prepared = await prepareCardImage({
        file,
        side,
        enhanced: false,
        supabase,
      });
      const { qr_text: qrText, ...payload } = prepared;

      const response = await fetch(`/api/cards/${cardId}/images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          side,
          image: payload,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to save image.");
      }

      setStatus("processing");

      const processResponse = await fetch(`/api/cards/${cardId}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qr: {
            front: side === "front" ? qrText ?? null : null,
            back: side === "back" ? qrText ?? null : null,
          },
        }),
      });

      if (!processResponse.ok) {
        const errorText = await processResponse.text();
        throw new Error(errorText || "Failed to process card.");
      }

      setStatus("idle");
      router.refresh();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Upload failed.";
      setStatus("error");
      setMessage(errorMessage);
    } finally {
      event.target.value = "";
    }
  };

  const handleDelete = async () => {
    if (isBusy) return;

    if (side === "front") {
      triggerPick();
      return;
    }

    if (!hasImage) return;

    setStatus("deleting");
    setMessage(null);

    try {
      const response = await fetch(
        `/api/cards/${cardId}/images?side=${side}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to delete image.");
      }

      setStatus("idle");
      router.refresh();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Delete failed.";
      setStatus("error");
      setMessage(errorMessage);
    }
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePick}
      />
      <button
        type="button"
        onClick={triggerPick}
        disabled={isBusy}
        className="rounded-full border border-ink-200/70 bg-white px-3 py-1 text-xs font-semibold text-ink-700 transition hover:border-ink-400 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {status === "uploading"
          ? "Uploading..."
          : status === "processing"
            ? "Processing..."
            : "Edit"}
      </button>
      <button
        type="button"
        onClick={handleDelete}
        disabled={isBusy || (side === "back" && !hasImage)}
        title={side === "front" ? "Replace front image" : "Delete image"}
        aria-label={side === "front" ? "Replace front image" : "Delete image"}
        className="rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-semibold text-rose-600 transition hover:border-rose-300 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {status === "deleting" ? "Deleting..." : "Delete"}
      </button>
      {message ? (
        <span className="text-xs text-rose-600">{message}</span>
      ) : null}
    </div>
  );
}
