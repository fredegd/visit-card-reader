"use client";

import jsQR from "jsqr";
type TelemetryDetail = Record<string, unknown>;
type ProcessingContext = { side?: "front" | "back" };
type CropResult = {
  blob: Blob | null;
  width: number | null;
  height: number | null;
  confidence: number | null;
};

const WORKER_PATH = "/workers/opencv-crop.js";
const WORKER_TIMEOUT_MS = 4000;
let telemetryHooksRegistered = false;
let cropWorkerPromise: Promise<Worker | null> | null = null;
let cropWorkerRequestId = 0;
const cropWorkerPending = new Map<
  number,
  {
    resolve: (value: CropResult) => void;
    reject: (error: Error) => void;
    timeoutId: number;
    context?: ProcessingContext;
  }
>();

export function logTelemetry(event: string, detail?: TelemetryDetail) {
  try {
    console.info(`[telemetry] ${event}`, detail ?? {});
  } catch {
    // Ignore console failures
  }

  if (typeof window === "undefined") return;

  if (!telemetryHooksRegistered) {
    telemetryHooksRegistered = true;
    window.addEventListener("error", (event) => {
      try {
        logTelemetry("window:error", {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          error: event.error instanceof Error ? event.error.message : null,
        });
      } catch {
        // Ignore telemetry failures
      }
    });
    window.addEventListener("unhandledrejection", (event) => {
      const reason =
        event.reason instanceof Error
          ? event.reason.message
          : typeof event.reason === "string"
            ? event.reason
            : null;
      try {
        logTelemetry("window:unhandledrejection", { reason });
      } catch {
        // Ignore telemetry failures
      }
    });
  }

  try {
    const payload = {
      event,
      detail: detail ?? {},
      ts: Date.now(),
      href: window.location?.href ?? null,
      ua: navigator.userAgent,
    };
    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/telemetry", body);
    } else {
      void fetch("/api/telemetry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      });
    }
  } catch {
    // Ignore telemetry failures
  }
}

function getWorkerOpenCvUrl() {
  return (
    process.env.NEXT_PUBLIC_OPENCV_WORKER_URL ??
    process.env.NEXT_PUBLIC_OPENCV_FALLBACK_URL ??
    "/opencv/opencv.js"
  );
}

async function getCropWorker(): Promise<Worker | null> {
  if (typeof window === "undefined") return null;
  if (typeof Worker === "undefined") {
    logTelemetry("worker:unsupported");
    return null;
  }
  if (cropWorkerPromise) return cropWorkerPromise;

  cropWorkerPromise = new Promise((resolve) => {
    try {
      const worker = new Worker(WORKER_PATH);
      worker.addEventListener("message", (event) => {
        const data = event.data;
        if (!data || typeof data !== "object") {
          logTelemetry("worker:message_invalid");
          return;
        }
        if (data.type === "telemetry") {
          const detail =
            data.detail && typeof data.detail === "object"
              ? { source: "worker", ...data.detail }
              : { source: "worker" };
          logTelemetry(data.event ?? "worker:telemetry", detail);
          return;
        }
        if (data.type === "result") {
          const pending = cropWorkerPending.get(data.id);
          if (!pending) {
            logTelemetry("worker:orphan_result", { id: data.id });
            return;
          }
          window.clearTimeout(pending.timeoutId);
          cropWorkerPending.delete(data.id);
          if (data.ok) {
            pending.resolve({
              blob: data.blob ?? null,
              width: typeof data.width === "number" ? data.width : null,
              height: typeof data.height === "number" ? data.height : null,
              confidence:
                typeof data.confidence === "number" ? data.confidence : null,
            });
          } else {
            const message =
              typeof data.error === "string" ? data.error : "Worker crop failed";
            logTelemetry("crop:worker_error", {
              message,
              ...pending.context,
            });
            pending.reject(new Error(message));
          }
          return;
        }
        logTelemetry("worker:message_unknown", { type: data.type });
      });
      worker.addEventListener("error", (event) => {
        logTelemetry("worker:error", {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        });
      });
      worker.addEventListener("messageerror", () => {
        logTelemetry("worker:messageerror");
      });
      resolve(worker);
    } catch (error) {
      logTelemetry("worker:init_error", {
        message: error instanceof Error ? error.message : "unknown error",
      });
      resolve(null);
    }
  });

  return cropWorkerPromise;
}

async function fileToCanvas(file: File, maxSize = 1600) {
  let bitmap: ImageBitmap;
  try {
    const probe = await createImageBitmap(file);
    const scale = Math.min(1, maxSize / Math.max(probe.width, probe.height));
    const targetWidth = Math.round(probe.width * scale);
    const targetHeight = Math.round(probe.height * scale);
    probe.close();
    bitmap = await (createImageBitmap as unknown as (
      blob: Blob,
      options?: { resizeWidth?: number; resizeHeight?: number; resizeQuality?: string },
    ) => Promise<ImageBitmap>)(file, {
      resizeWidth: targetWidth,
      resizeHeight: targetHeight,
      resizeQuality: "high",
    });
  } catch {
    bitmap = await createImageBitmap(file);
  }

  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas context not available");
  }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return { canvas, ctx };
}

export async function decodeQrText(file: File, context?: ProcessingContext) {
  const startedAt = performance.now();
  logTelemetry("qr:start", { size: file.size, mime: file.type, ...context });
  try {
    const { canvas, ctx } = await fileToCanvas(file, 900);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const result = jsQR(imageData.data, canvas.width, canvas.height);
    logTelemetry("qr:done", {
      found: Boolean(result?.data),
      duration_ms: Math.round(performance.now() - startedAt),
      ...context,
    });
    return result?.data ?? null;
  } catch (error) {
    logTelemetry("qr:error", {
      message: error instanceof Error ? error.message : "unknown error",
      duration_ms: Math.round(performance.now() - startedAt),
      ...context,
    });
    throw error;
  }
}

export async function cropVisitCard(
  file: File,
  context?: ProcessingContext,
): Promise<CropResult> {
  const worker = await getCropWorker();
  if (!worker) {
    logTelemetry("crop:worker_unavailable", { ...context });
    return { blob: null, width: null, height: null, confidence: null };
  }

  const requestId = (cropWorkerRequestId += 1);
  const buffer = await file.arrayBuffer();
  logTelemetry("crop:worker_request", {
    id: requestId,
    size: file.size,
    mime: file.type,
    ...context,
  });

  return await new Promise<CropResult>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      cropWorkerPending.delete(requestId);
      logTelemetry("crop:worker_timeout", { id: requestId, ...context });
      resolve({ blob: null, width: null, height: null, confidence: null });
    }, WORKER_TIMEOUT_MS);

    cropWorkerPending.set(requestId, {
      resolve,
      reject,
      timeoutId,
      context,
    });

    try {
      worker.postMessage(
        {
          type: "crop",
          id: requestId,
          buffer,
          mime: file.type,
          side: context?.side,
          opencvUrl: getWorkerOpenCvUrl(),
        },
        [buffer],
      );
    } catch (error) {
      window.clearTimeout(timeoutId);
      cropWorkerPending.delete(requestId);
      const message =
        error instanceof Error ? error.message : "Worker postMessage failed";
      logTelemetry("crop:worker_post_error", { message, ...context });
      reject(new Error(message));
    }
  });
}
