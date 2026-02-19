"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { cropVisitCard, decodeQrText, logTelemetry } from "@/lib/image-processing";

type UploadFile = {
  file: File | null;
  previewUrl?: string;
};

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_PROCESSING_BYTES = 8 * 1024 * 1024;

type ImageMeta = {
  storage_path: string;
  cropped_path?: string | null;
  cropped_width?: number | null;
  cropped_height?: number | null;
  crop_confidence?: number | null;
  mime: string;
  width: number | null;
  height: number | null;
  checksum: string | null;
};

type PreparedImage = ImageMeta & { qr_text?: string | null };

function getWebCrypto(): Crypto | null {
  if (typeof globalThis === "undefined") return null;
  return (globalThis as { crypto?: Crypto }).crypto ?? null;
}

function randomId() {
  const webCrypto = getWebCrypto();

  if (webCrypto?.randomUUID) {
    return webCrypto.randomUUID();
  }

  if (webCrypto?.getRandomValues) {
    const bytes = new Uint8Array(16);
    webCrypto.getRandomValues(bytes);
    // RFC4122 v4
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function getImageSize(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    };
    img.src = objectUrl;
  });
}

async function sha256(file: File): Promise<string | null> {
  const webCrypto = getWebCrypto();
  if (!webCrypto?.subtle) return null;

  try {
    const buffer = await file.arrayBuffer();
    const digest = await webCrypto.subtle.digest("SHA-256", buffer);
    const bytes = Array.from(new Uint8Array(digest));
    return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}

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

  const uploadImage = async (
    file: File,
    side: "front" | "back",
    variant: "original" | "cropped" = "original",
  ): Promise<ImageMeta> => {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      throw new Error("You need to be signed in to upload.");
    }

    const metadata = await getImageSize(file);
    const checksum = await sha256(file);
    const extension = file.name.split(".").pop() || "jpg";
    const filename = `${randomId()}.${extension}`;
    const storagePath =
      variant === "cropped"
        ? `${userData.user.id}/${side}/cropped/${filename}`
        : `${userData.user.id}/${side}/${filename}`;

    const { error } = await supabase.storage
      .from("card-images")
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: true,
      });

    if (error) {
      throw new Error(error.message);
    }

    return {
      storage_path: storagePath,
      mime: file.type,
      width: metadata?.width ?? null,
      height: metadata?.height ?? null,
      checksum,
    };
  };

  const prepareImage = async (
    file: File,
    side: "front" | "back",
  ): Promise<PreparedImage> => {
    logTelemetry("prepare:start", {
      side,
      size: file.size,
      mime: file.type,
      enhanced,
    });
    let qrText: string | null = null;
    let crop = {
      blob: null as Blob | null,
      width: null as number | null,
      height: null as number | null,
      confidence: null as number | null,
    };
    if (file.size <= MAX_PROCESSING_BYTES) {
      const withTimeout = async <T,>(
        task: Promise<T>,
        ms: number,
      ): Promise<T | null> => {
        return Promise.race([
          task,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
        ]);
      };

      try {
        const qrResult = await withTimeout(decodeQrText(file, { side }), 2000);
        qrText = typeof qrResult === "string" ? qrResult : null;
      } catch {
        qrText = null;
      }

      if (enhanced) {
        try {
          const cropResult = await withTimeout(cropVisitCard(file, { side }), 2500);
          if (cropResult) {
            crop = cropResult;
          }
        } catch {
          crop = {
            blob: null,
            width: null,
            height: null,
            confidence: null,
          };
        }
      }
    } else {
      logTelemetry("prepare:skip_large", { side, size: file.size });
    }

    const originalMeta = await uploadImage(file, side, "original");

    if (crop.blob) {
      const croppedFile = new File([crop.blob], `cropped-${file.name}`, {
        type: "image/jpeg",
      });
      const croppedMeta = await uploadImage(croppedFile, side, "cropped");

      return {
        ...originalMeta,
        cropped_path: croppedMeta.storage_path,
        cropped_width: crop.width ?? croppedMeta.width ?? null,
        cropped_height: crop.height ?? croppedMeta.height ?? null,
        crop_confidence: crop.confidence ?? null,
        qr_text: qrText ?? null,
      };
    }

    return {
      ...originalMeta,
      qr_text: qrText ?? null,
    };
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
      const frontMeta = await prepareImage(front.file, "front");
      const backMeta = back.file ? await prepareImage(back.file, "back") : null;

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
