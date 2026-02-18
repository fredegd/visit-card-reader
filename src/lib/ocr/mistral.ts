import type { OcrClient, OcrInput, OcrResult } from "@/lib/ocr/types";
import { serverEnv } from "@/lib/env.server";

function extractTextFromResponse(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const record = payload as Record<string, unknown>;

  if (typeof record.text === "string") {
    return record.text;
  }

  if (Array.isArray(record.pages)) {
    return record.pages
      .map((page) => {
        if (!page || typeof page !== "object") return "";
        const pageRecord = page as Record<string, unknown>;
        if (typeof pageRecord.text === "string") return pageRecord.text;
        if (typeof pageRecord.markdown === "string") return pageRecord.markdown;
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }

  if (Array.isArray(record.data)) {
    return record.data
      .map((item) => {
        if (!item || typeof item !== "object") return "";
        const itemRecord = item as Record<string, unknown>;
        if (typeof itemRecord.text === "string") return itemRecord.text;
        if (typeof itemRecord.markdown === "string") return itemRecord.markdown;
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }

  return "";
}

export const mistralOcrClient: OcrClient = {
  name: "mistral-ocr-2512",
  async process(input: OcrInput): Promise<OcrResult> {
    const hasUrl = Boolean(input.imageUrl);
    const hasBase64 = Boolean(input.base64);

    if (!hasUrl && !hasBase64) {
      throw new Error("OCR input requires imageUrl or base64.");
    }

    const document = hasUrl
      ? {
          type: "image_url",
          image_url: input.imageUrl,
        }
      : {
          type: "image_base64",
          image_base64: input.base64,
          mime_type: input.mimeType ?? "image/jpeg",
        };

    const response = await fetch(serverEnv.MISTRAL_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serverEnv.MISTRAL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: serverEnv.MISTRAL_OCR_MODEL,
        document,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Mistral OCR request failed (${response.status}): ${errorText}`,
      );
    }

    const payload = (await response.json()) as unknown;
    const text = extractTextFromResponse(payload);

    return {
      raw: payload,
      text,
    };
  },
};
