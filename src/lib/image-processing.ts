"use client";

import jsQR from "jsqr";

type CvType = any;

let cvPromise: Promise<CvType | null> | null = null;

async function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      const existingCv = (window as unknown as { cv?: CvType }).cv;
      if (existingCv?.Mat) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Load failed")));
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Load failed"));
    document.body.appendChild(script);
  });
}

async function loadOpenCv(): Promise<CvType | null> {
  if (typeof window === "undefined") return null;
  const existing = (window as unknown as { cv?: CvType }).cv;
  if (existing?.Mat) return existing;

  if (!cvPromise) {
    cvPromise = (async () => {
      const url =
        process.env.NEXT_PUBLIC_OPENCV_URL ??
        "https://docs.opencv.org/4.10.0/opencv.js";
      try {
        await loadScript(url);
      } catch {
        return null;
      }

      const cv = (window as unknown as { cv?: CvType }).cv;
      if (!cv) return null;

      if (cv?.onRuntimeInitialized) {
        return await new Promise<CvType>((resolve) => {
          cv.onRuntimeInitialized = () => resolve(cv);
        });
      }

      if (cv?.ready && typeof cv.ready.then === "function") {
        await cv.ready;
        return cv;
      }

      return cv;
    })();
  }

  return cvPromise;
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

function orderPoints(points: Array<{ x: number; y: number }>) {
  const sum = points.map((p) => p.x + p.y);
  const diff = points.map((p) => p.y - p.x);
  const tl = points[sum.indexOf(Math.min(...sum))];
  const br = points[sum.indexOf(Math.max(...sum))];
  const tr = points[diff.indexOf(Math.min(...diff))];
  const bl = points[diff.indexOf(Math.max(...diff))];
  return [tl, tr, br, bl];
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

async function canvasToBlob(canvas: HTMLCanvasElement, mime = "image/jpeg") {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mime, 0.92);
  });
}

export async function decodeQrText(file: File) {
  const { canvas, ctx } = await fileToCanvas(file, 900);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const result = jsQR(imageData.data, canvas.width, canvas.height);
  return result?.data ?? null;
}

export async function cropVisitCard(file: File) {
  const cv = await loadOpenCv();
  if (!cv) {
    return {
      blob: null as Blob | null,
      width: null as number | null,
      height: null as number | null,
      confidence: null as number | null,
    };
  }

  const { canvas } = await fileToCanvas(file, 1400);
  const src = cv.imread(canvas);
  const gray = new cv.Mat();
  const blurred = new cv.Mat();
  const edged = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();

  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
    cv.Canny(blurred, edged, 75, 200);
    cv.findContours(edged, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    let best: { contour: CvType; area: number; approx: CvType } | null = null;

    for (let i = 0; i < contours.size(); i += 1) {
      const contour = contours.get(i);
      const perimeter = cv.arcLength(contour, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(contour, approx, 0.02 * perimeter, true);
      if (approx.rows === 4) {
        const area = cv.contourArea(approx);
        if (!best || area > best.area) {
          if (best) {
            best.approx.delete();
          }
          best = { contour, area, approx };
        } else {
          approx.delete();
        }
      } else {
        approx.delete();
      }
    }

    if (!best) {
      return {
        blob: null,
        width: null,
        height: null,
        confidence: null,
      };
    }

    const points: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < 4; i += 1) {
      const x = best.approx.data32S[i * 2];
      const y = best.approx.data32S[i * 2 + 1];
      points.push({ x, y });
    }

    const [tl, tr, br, bl] = orderPoints(points);
    const widthA = distance(br, bl);
    const widthB = distance(tr, tl);
    const maxWidth = Math.max(widthA, widthB);
    const heightA = distance(tr, br);
    const heightB = distance(tl, bl);
    const maxHeight = Math.max(heightA, heightB);

    const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
      tl.x,
      tl.y,
      tr.x,
      tr.y,
      br.x,
      br.y,
      bl.x,
      bl.y,
    ]);
    const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
      0,
      0,
      maxWidth - 1,
      0,
      maxWidth - 1,
      maxHeight - 1,
      0,
      maxHeight - 1,
    ]);

    const transform = cv.getPerspectiveTransform(srcTri, dstTri);
    const warped = new cv.Mat();
    const dsize = new cv.Size(Math.round(maxWidth), Math.round(maxHeight));
    cv.warpPerspective(src, warped, transform, dsize, cv.INTER_LINEAR, cv.BORDER_REPLICATE);

    const outputCanvas = document.createElement("canvas");
    outputCanvas.width = warped.cols;
    outputCanvas.height = warped.rows;
    cv.imshow(outputCanvas, warped);

    const blob = await canvasToBlob(outputCanvas);

    best.approx.delete();
    srcTri.delete();
    dstTri.delete();
    transform.delete();
    warped.delete();

    const confidence = Math.min(1, best.area / (src.rows * src.cols));

    return {
      blob,
      width: outputCanvas.width,
      height: outputCanvas.height,
      confidence,
    };
  } finally {
    src.delete();
    gray.delete();
    blurred.delete();
    edged.delete();
    contours.delete();
    hierarchy.delete();
  }
}
