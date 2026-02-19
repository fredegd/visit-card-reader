import type { SupabaseClient } from "@supabase/supabase-js";
import { cropVisitCard, decodeQrText, logTelemetry } from "@/lib/image-processing";

const MAX_PROCESSING_BYTES = 8 * 1024 * 1024;

export type ImageMeta = {
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

export type PreparedImage = ImageMeta & { qr_text?: string | null };

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

async function getImageSize(
  file: File,
): Promise<{ width: number; height: number } | null> {
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

async function uploadImage(
  supabase: SupabaseClient,
  file: File,
  side: "front" | "back",
  variant: "original" | "cropped" = "original",
): Promise<ImageMeta> {
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
}

export async function prepareCardImage({
  file,
  side,
  enhanced = false,
  supabase,
}: {
  file: File;
  side: "front" | "back";
  enhanced?: boolean;
  supabase: SupabaseClient;
}): Promise<PreparedImage> {
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

  const originalMeta = await uploadImage(supabase, file, side, "original");

  if (crop.blob) {
    const croppedFile = new File([crop.blob], `cropped-${file.name}`, {
      type: "image/jpeg",
    });
    const croppedMeta = await uploadImage(supabase, croppedFile, side, "cropped");

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
}
