"use client";

import { useEffect, useMemo, useState } from "react";
import {
  extractOcrBoxes,
  extractOcrDimensions,
  type OcrBox,
  type OcrBoxLevel,
  type OcrDimensions,
} from "@/lib/ocr/boxes";

type NormalizedBox = OcrBox & {
  norm: { left: number; top: number; width: number; height: number };
};

type OcrSelectionPanelProps = {
  label: string;
  imageUrl: string | null;
  rawOcr: unknown | null;
  onApplySelection: (text: string) => void;
  activeTargetLabel?: string | null;
  onApplyToActiveTarget?: (text: string) => void;
};

function normalizeBoxes(
  boxes: OcrBox[],
  size: { width: number; height: number } | null,
): NormalizedBox[] {
  if (boxes.length === 0) return [];
  const normalized: NormalizedBox[] = [];

  boxes.forEach((box) => {
    const { x, y, width, height } = box.bbox;
    const maxCoord = Math.max(x, y, width, height);
    const isNormalized = maxCoord <= 1.5;
    if (!isNormalized && !size) return;

    const left = isNormalized ? x : x / size!.width;
    const top = isNormalized ? y : y / size!.height;
    const w = isNormalized ? width : width / size!.width;
    const h = isNormalized ? height : height / size!.height;

    if (![left, top, w, h].every((v) => Number.isFinite(v))) return;
    if (w <= 0 || h <= 0) return;

    normalized.push({
      ...box,
      norm: {
        left: Math.max(0, Math.min(1, left)),
        top: Math.max(0, Math.min(1, top)),
        width: Math.max(0, Math.min(1, w)),
        height: Math.max(0, Math.min(1, h)),
      },
    });
  });

  return normalized;
}

function levelLabel(level: OcrBoxLevel) {
  if (level === "line") return "Lines";
  if (level === "word") return "Words";
  if (level === "block") return "Blocks";
  return "All";
}

export default function OcrSelectionPanel({
  label,
  imageUrl,
  rawOcr,
  onApplySelection,
  activeTargetLabel,
  onApplyToActiveTarget,
}: OcrSelectionPanelProps) {
  const [imageSize, setImageSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeLevel, setActiveLevel] = useState<OcrBoxLevel>("unknown");
  const [tesseractBoxes, setTesseractBoxes] = useState<OcrBox[]>([]);
  const [tesseractSize, setTesseractSize] = useState<OcrDimensions | null>(null);
  const [tesseractStatus, setTesseractStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [tesseractProgress, setTesseractProgress] = useState<number | null>(null);
  const [tesseractError, setTesseractError] = useState<string | null>(null);

  const rawBoxes = useMemo(() => extractOcrBoxes(rawOcr), [rawOcr]);
  const rawDimensions = useMemo(() => extractOcrDimensions(rawOcr), [rawOcr]);
  const boxes = rawBoxes.length > 0 ? rawBoxes : tesseractBoxes;
  const boxSourceSize =
    rawBoxes.length > 0 ? rawDimensions : tesseractSize ?? rawDimensions;
  const boxSourceLabel = rawBoxes.length > 0 ? "mistral" : tesseractBoxes.length > 0 ? "tesseract" : "none";
  const levels = useMemo(() => {
    const set = new Set<OcrBoxLevel>();
    boxes.forEach((box) => set.add(box.level));
    return Array.from(set);
  }, [boxes]);

  useEffect(() => {
    if (levels.includes("line")) {
      setActiveLevel("line");
    } else if (levels.includes("word")) {
      setActiveLevel("word");
    } else if (levels.includes("block")) {
      setActiveLevel("block");
    } else {
      setActiveLevel("unknown");
    }
  }, [levels]);

  const visibleBoxes = useMemo(() => {
    if (activeLevel === "unknown") return boxes;
    return boxes.filter((box) => box.level === activeLevel);
  }, [boxes, activeLevel]);

  const normalizedBoxes = useMemo(() => {
    const size = boxSourceSize ?? imageSize;
    return normalizeBoxes(visibleBoxes, size);
  }, [visibleBoxes, boxSourceSize, imageSize]);

  const selectedBoxes = useMemo(() => {
    return normalizedBoxes.filter((box) => selectedIds.has(box.id));
  }, [normalizedBoxes, selectedIds]);

  const selectedText = useMemo(() => {
    const ordered = [...selectedBoxes].sort((a, b) => {
      if (a.norm.top === b.norm.top) {
        return a.norm.left - b.norm.left;
      }
      return a.norm.top - b.norm.top;
    });
    return ordered.map((box) => box.text).join("\n");
  }, [selectedBoxes]);

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleApply = () => {
    if (!selectedText.trim()) return;
    onApplySelection(selectedText);
  };

  const handleApplyToActive = () => {
    if (!selectedText.trim() || !onApplyToActiveTarget) return;
    onApplyToActiveTarget(selectedText);
  };

  const handleClear = () => {
    setSelectedIds(new Set());
  };

  const handleSelectAll = () => {
    setSelectedIds(new Set(normalizedBoxes.map((box) => box.id)));
  };

  useEffect(() => {
    setSelectedIds(new Set());
  }, [activeLevel, boxes]);

  const detectWithTesseract = async () => {
    if (!imageUrl) return;
    setTesseractStatus("loading");
    setTesseractError(null);
    setTesseractProgress(null);

    try {
      const response = await fetch(imageUrl, { mode: "cors" });
      if (!response.ok) {
        throw new Error("Unable to fetch image for OCR.");
      }
      const originalBlob = await response.blob();
      const bitmap = await createImageBitmap(originalBlob);
      const maxSize = 1400;
      const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
      const targetWidth = Math.max(1, Math.round(bitmap.width * scale));
      const targetHeight = Math.max(1, Math.round(bitmap.height * scale));
      let ocrBlob = originalBlob;
      let ocrSize = { width: bitmap.width, height: bitmap.height };

      if (scale < 1) {
        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          bitmap.close();
          throw new Error("Canvas context not available.");
        }
        ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
        const scaledBlob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob((blob) => resolve(blob), originalBlob.type || "image/jpeg", 0.92);
        });
        if (scaledBlob) {
          ocrBlob = scaledBlob;
          ocrSize = { width: targetWidth, height: targetHeight };
        }
      }
      bitmap.close();

      const tesseract = await import("tesseract.js");
      const lang = process.env.NEXT_PUBLIC_TESSERACT_LANG ?? "eng";
      const resolvePath = async (candidates: string[], fallback: string) => {
        for (const candidate of candidates) {
          try {
            const head = await fetch(candidate, { method: "HEAD" });
            if (head.ok) return candidate;
          } catch {
            // ignore
          }
        }
        return fallback;
      };

      const workerPath =
        process.env.NEXT_PUBLIC_TESSERACT_WORKER_PATH ??
        (await resolvePath(
          ["/tesseract/worker.min.js", "/tesseract/worker.js"],
          "/tesseract/worker.min.js",
        ));
      const corePath =
        process.env.NEXT_PUBLIC_TESSERACT_CORE_PATH ??
        (await resolvePath(
          [
            "/tesseract/tesseract-core-simd.wasm.js",
            "/tesseract/tesseract-core.wasm.js",
            "/tesseract/tesseract-core-simd.js",
            "/tesseract/tesseract-core.js",
          ],
          "/tesseract/tesseract-core.wasm.js",
        ));
      const langPath =
        process.env.NEXT_PUBLIC_TESSERACT_LANG_PATH ?? "/tesseract/lang";

      const createWorker = tesseract.createWorker;
      const runWithLogger = async (enableLogger: boolean) => {
        const logger = enableLogger
          ? (info: { status?: string; progress?: number }) => {
              if (typeof info.progress === "number") {
                setTesseractProgress(info.progress);
              }
            }
          : undefined;
        const options = logger
          ? { logger, workerPath, corePath, langPath }
          : { workerPath, corePath, langPath };

        const maybeWorker = createWorker(
          lang,
          undefined,
          options as unknown as Record<string, unknown>,
        );

        const worker =
          typeof (maybeWorker as Promise<unknown>).then === "function"
            ? await maybeWorker
            : (maybeWorker as {
                load?: () => Promise<void>;
                loadLanguage?: (value: string) => Promise<void>;
                initialize?: (value: string) => Promise<void>;
                recognize: (value: unknown) => Promise<{ data: unknown }>;
                terminate?: () => Promise<void>;
              });

        if (worker.load) await worker.load();
        if (worker.loadLanguage) await worker.loadLanguage(lang);
        if (worker.initialize) await worker.initialize(lang);

        const { data } = await worker.recognize(ocrBlob);
        if (worker.terminate) await worker.terminate();
        return data;
      };

      let data;
      try {
        data = await runWithLogger(true);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("DataCloneError") || message.includes("could not be cloned")) {
          setTesseractProgress(null);
          data = await runWithLogger(false);
        } else {
          throw error;
        }
      }

      const wordBoxes: OcrBox[] = [];
      const lineBoxes: OcrBox[] = [];
      const dataRecord = data as {
        words?: Array<{ text?: string; bbox?: { x0: number; y0: number; x1: number; y1: number } }>;
        lines?: Array<{ text?: string; bbox?: { x0: number; y0: number; x1: number; y1: number } }>;
      };

      dataRecord.words?.forEach((word, index) => {
        if (!word.text || !word.bbox) return;
        const { x0, y0, x1, y1 } = word.bbox;
        if ([x0, y0, x1, y1].some((v) => typeof v !== "number")) return;
        wordBoxes.push({
          id: `tess-word-${index}`,
          text: word.text,
          level: "word",
          bbox: {
            x: x0,
            y: y0,
            width: x1 - x0,
            height: y1 - y0,
          },
        });
      });

      dataRecord.lines?.forEach((line, index) => {
        if (!line.text || !line.bbox) return;
        const { x0, y0, x1, y1 } = line.bbox;
        if ([x0, y0, x1, y1].some((v) => typeof v !== "number")) return;
        lineBoxes.push({
          id: `tess-line-${index}`,
          text: line.text,
          level: "line",
          bbox: {
            x: x0,
            y: y0,
            width: x1 - x0,
            height: y1 - y0,
          },
        });
      });

      const combined = [...lineBoxes, ...wordBoxes];
      if (combined.length === 0) {
        throw new Error("No text boxes detected.");
      }

      setTesseractBoxes(combined);
      setTesseractSize(ocrSize);
      setTesseractStatus("ready");
    } catch (error) {
      setTesseractStatus("error");
      setTesseractError(
        error instanceof Error ? error.message : "Tesseract failed.",
      );
    }
  };

  return (
    <div className="rounded-3xl border border-ink-200/70 bg-white/80 p-4 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-ink-700">{label}</p>
          <p className="text-xs text-ink-500">
            Click or drag text boxes onto fields.
          </p>
        </div>
        {levels.length > 1 ? (
          <div className="flex items-center gap-2 text-xs">
            {levels.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setActiveLevel(level)}
                className={`rounded-full border px-3 py-1 ${
                  activeLevel === level
                    ? "border-ink-700 bg-ink-900 text-sand-100"
                    : "border-ink-200/70 bg-white text-ink-600"
                }`}
              >
                {levelLabel(level)}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-2 grid gap-1 text-[11px] text-ink-500">
        <div className="flex flex-wrap items-center gap-3">
          <span>Source: {boxSourceLabel}</span>
          <span>Total boxes: {boxes.length}</span>
          <span>Visible: {normalizedBoxes.length}</span>
          <span>Selected: {selectedBoxes.length}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span>
            Image size:{" "}
            {imageSize
              ? `${imageSize.width}×${imageSize.height}`
              : "unknown"}
          </span>
          <span>
            OCR size:{" "}
            {boxSourceSize
              ? `${Math.round(boxSourceSize.width)}×${Math.round(
                  boxSourceSize.height,
                )}`
              : "unknown"}
          </span>
          <span>
            Tesseract: {tesseractStatus}
            {tesseractProgress !== null
              ? ` (${Math.round(tesseractProgress * 100)}%)`
              : ""}
          </span>
        </div>
      </div>

      {imageUrl ? (
        <div className="mt-3">
          <div className="relative">
            <img
              src={imageUrl}
              alt={`${label} card`}
              className="w-full rounded-2xl object-cover"
              onLoad={(event) => {
                setImageSize({
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                });
              }}
            />
            <div className="pointer-events-none absolute inset-0">
              {normalizedBoxes.map((box) => {
                const isSelected = selectedIds.has(box.id);
                return (
                  <button
                    key={box.id}
                    type="button"
                    title={box.text}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "copy";
                      event.dataTransfer.setData("text/plain", box.text);
                      event.dataTransfer.setData("application/x-ocr-text", box.text);
                    }}
                    onClick={() => {
                      if (activeTargetLabel && onApplyToActiveTarget) {
                        onApplyToActiveTarget(box.text);
                      }
                      toggleSelection(box.id);
                    }}
                    className={`pointer-events-auto absolute rounded border text-[10px] transition ${
                      isSelected
                        ? "border-ink-800 bg-ink-900/20"
                        : "border-ink-300/70 bg-white/10 hover:border-ink-500"
                    }`}
                    style={{
                      left: `${box.norm.left * 100}%`,
                      top: `${box.norm.top * 100}%`,
                      width: `${box.norm.width * 100}%`,
                      height: `${box.norm.height * 100}%`,
                    }}
                  />
                );
              })}
            </div>
          </div>

          {boxes.length === 0 ? (
            <div className="mt-3 grid gap-2 text-xs text-ink-500">
              <p>OCR layout data not available for this image.</p>
              <button
                type="button"
                onClick={detectWithTesseract}
                className="w-fit rounded-full border border-ink-200/70 px-3 py-1 text-xs font-semibold text-ink-700"
                disabled={tesseractStatus === "loading"}
              >
                {tesseractStatus === "loading"
                  ? "Detecting..."
                  : "Detect text boxes (Tesseract)"}
              </button>
              {tesseractStatus === "loading" && tesseractProgress !== null ? (
                <p>Progress: {Math.round(tesseractProgress * 100)}%</p>
              ) : null}
              {tesseractStatus === "error" && tesseractError ? (
                <p className="text-rose-600">{tesseractError}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-xs text-ink-500">Not uploaded</p>
      )}

      <div className="mt-4 grid gap-3">
        <div className="rounded-2xl border border-ink-200/70 bg-sand-50 p-3 text-xs text-ink-700">
          <div className="flex items-center justify-between">
            <span>Selected text</span>
            <span className="text-ink-400">
              {selectedBoxes.length} boxes
            </span>
          </div>
          <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap">
            {selectedText || "Nothing selected yet."}
          </pre>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleApply}
            className="rounded-full bg-ink-900 px-4 py-2 text-xs font-semibold text-sand-100"
            disabled={!selectedText.trim()}
          >
            Apply to fields
          </button>
          {activeTargetLabel && onApplyToActiveTarget ? (
            <button
              type="button"
              onClick={handleApplyToActive}
              className="rounded-full border border-ink-200/70 px-4 py-2 text-xs font-semibold text-ink-700"
              disabled={!selectedText.trim()}
            >
              Drop into {activeTargetLabel}
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleSelectAll}
            className="rounded-full border border-ink-200/70 px-4 py-2 text-xs font-semibold text-ink-700"
            disabled={normalizedBoxes.length === 0}
          >
            Select all
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="rounded-full border border-ink-200/70 px-4 py-2 text-xs font-semibold text-ink-700"
            disabled={selectedIds.size === 0}
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
