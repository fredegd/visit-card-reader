/* eslint-disable no-restricted-globals */
let cvPromise = null;

function emit(event, detail) {
  try {
    self.postMessage({ type: "telemetry", event, detail });
  } catch {
    // ignore
  }
}

function now() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

async function waitForMat(cv, timeoutMs, detail) {
  const startedAt = now();
  while (now() - startedAt < timeoutMs) {
    if (cv && cv.Mat) {
      emit("opencv:mat_ready", {
        ...detail,
        duration_ms: Math.round(now() - startedAt),
      });
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  emit("opencv:mat_timeout", {
    ...detail,
    duration_ms: Math.round(now() - startedAt),
  });
  return false;
}

async function loadOpenCv(url) {
  if (cvPromise) return cvPromise;
  cvPromise = (async () => {
    emit("opencv:load_start", { url });
    const startedAt = now();
    let runtimeResolved = false;
    let runtimeResolve = null;

    try {
      const resolved = new URL(url, self.location.href);
      const base = resolved.href.slice(0, resolved.href.lastIndexOf("/") + 1);
      const moduleRef = self.Module || {};
      const prevLocate = moduleRef.locateFile;
      moduleRef.locateFile = (path, prefix) => {
        const resolvedPath =
          typeof prevLocate === "function"
            ? prevLocate(path, prefix)
            : `${prefix || base}${path}`;
        emit("opencv:locateFile", { path, prefix, resolved: resolvedPath });
        return resolvedPath;
      };
      const prevRuntime = moduleRef.onRuntimeInitialized;
      moduleRef.onRuntimeInitialized = () => {
        if (typeof prevRuntime === "function") prevRuntime();
        runtimeResolved = true;
        emit("opencv:runtime_initialized", { url });
        if (runtimeResolve) runtimeResolve();
      };
      const prevAbort = moduleRef.onAbort;
      moduleRef.onAbort = (reason) => {
        if (typeof prevAbort === "function") prevAbort(reason);
        emit("opencv:abort", {
          url,
          reason:
            reason instanceof Error
              ? reason.message
              : typeof reason === "string"
                ? reason
                : "unknown",
        });
      };
      const prevPrintErr = moduleRef.printErr;
      moduleRef.printErr = (text) => {
        if (typeof prevPrintErr === "function") prevPrintErr(text);
        emit("opencv:printErr", { url, text });
      };
      self.Module = moduleRef;
      emit("opencv:module_configured", { url, base });
    } catch (error) {
      emit("opencv:module_config_error", {
        url,
        message: error instanceof Error ? error.message : "unknown error",
      });
    }

    try {
      importScripts(url);
    } catch (error) {
      emit("opencv:load_error", {
        url,
        message: error instanceof Error ? error.message : "load failed",
      });
      return null;
    }

    const cv = self.cv;
    if (!cv) {
      emit("opencv:load_error", { url, message: "cv missing after script load" });
      return null;
    }
    emit("opencv:cv_present", { url });

    await Promise.race([
      new Promise((resolve) => {
        runtimeResolve = resolve;
      }),
      new Promise((resolve) => {
        setTimeout(() => {
          if (!runtimeResolved) emit("opencv:runtime_timeout", { url });
          resolve();
        }, 3000);
      }),
    ]);

    const matReady = await waitForMat(cv, 3000, { url });
    if (!matReady) {
      emit("opencv:load_incomplete", { url });
      return null;
    }

    emit("opencv:load_success", {
      url,
      duration_ms: Math.round(now() - startedAt),
      mat_ready: Boolean(cv.Mat),
      runtime_resolved: runtimeResolved,
    });
    return cv;
  })();

  return cvPromise;
}

async function fileToCanvas(buffer, mime, maxSize) {
  if (typeof OffscreenCanvas === "undefined") {
    throw new Error("OffscreenCanvas unavailable");
  }

  const blob = new Blob([buffer], { type: mime || "image/jpeg" });
  let bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const targetWidth = Math.round(bitmap.width * scale);
  const targetHeight = Math.round(bitmap.height * scale);

  let usedBitmap = bitmap;
  let needsScale = scale < 1;

  if (needsScale) {
    try {
      usedBitmap = await createImageBitmap(blob, {
        resizeWidth: targetWidth,
        resizeHeight: targetHeight,
        resizeQuality: "high",
      });
      bitmap.close();
      needsScale = false;
    } catch {
      // fall back to manual scaling
    }
  }

  const canvas = new OffscreenCanvas(
    needsScale ? targetWidth : usedBitmap.width,
    needsScale ? targetHeight : usedBitmap.height,
  );
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    usedBitmap.close();
    throw new Error("Canvas context not available");
  }
  if (needsScale) {
    ctx.drawImage(usedBitmap, 0, 0, canvas.width, canvas.height);
  } else {
    ctx.drawImage(usedBitmap, 0, 0);
  }

  usedBitmap.close();
  return { canvas, ctx };
}

function orderPoints(points) {
  const sum = points.map((p) => p.x + p.y);
  const diff = points.map((p) => p.y - p.x);
  const tl = points[sum.indexOf(Math.min(...sum))];
  const br = points[sum.indexOf(Math.max(...sum))];
  const tr = points[diff.indexOf(Math.min(...diff))];
  const bl = points[diff.indexOf(Math.max(...diff))];
  return [tl, tr, br, bl];
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

async function cropVisitCard(buffer, mime, context) {
  emit("crop:start", { ...context, size: buffer.byteLength, mime });
  const cv = await loadOpenCv(context.opencvUrl || "/opencv/opencv.js");
  if (!cv) {
    emit("crop:opencv_unavailable", context);
    return { blob: null, width: null, height: null, confidence: null };
  }

  emit("crop:opencv_ready", context);
  const requiredFns = [
    "Mat",
    "Size",
    "matFromImageData",
    "cvtColor",
    "GaussianBlur",
    "Canny",
    "findContours",
    "arcLength",
    "approxPolyDP",
    "contourArea",
    "matFromArray",
    "getPerspectiveTransform",
    "warpPerspective",
  ];
  const missing = requiredFns.filter((name) => typeof cv[name] !== "function");
  if (missing.length > 0) {
    emit("opencv:smoke_failed", { ...context, missing });
    return { blob: null, width: null, height: null, confidence: null };
  }
  emit("opencv:smoke_ok", context);
  let step = "file_to_canvas";
  emit("crop:step", { step, ...context });
  const { canvas, ctx } = await fileToCanvas(buffer, mime, 1400);

  step = "image_data";
  emit("crop:step", { step, ...context });
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const src = cv.matFromImageData(imageData);
  const gray = new cv.Mat();
  const blurred = new cv.Mat();
  const edged = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();

  try {
    step = "cvtcolor";
    emit("crop:step", { step, ...context });
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    step = "blur";
    emit("crop:step", { step, ...context });
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
    step = "canny";
    emit("crop:step", { step, ...context });
    cv.Canny(blurred, edged, 75, 200);
    step = "find_contours";
    emit("crop:step", { step, ...context });
    cv.findContours(edged, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    let best = null;
    for (let i = 0; i < contours.size(); i += 1) {
      const contour = contours.get(i);
      const perimeter = cv.arcLength(contour, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(contour, approx, 0.02 * perimeter, true);
      if (approx.rows === 4) {
        const area = cv.contourArea(approx);
        if (!best || area > best.area) {
          if (best) best.approx.delete();
          best = { contour, area, approx };
        } else {
          approx.delete();
        }
      } else {
        approx.delete();
      }
    }

    if (!best) {
      emit("crop:no_contour", context);
      return { blob: null, width: null, height: null, confidence: null };
    }

    const points = [];
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
    step = "warp";
    emit("crop:step", { step, ...context });
    cv.warpPerspective(src, warped, transform, dsize, cv.INTER_LINEAR, cv.BORDER_REPLICATE);

    let output = warped;
    if (warped.channels() === 1) {
      output = new cv.Mat();
      cv.cvtColor(warped, output, cv.COLOR_GRAY2RGBA);
    } else if (warped.channels() === 3) {
      output = new cv.Mat();
      cv.cvtColor(warped, output, cv.COLOR_RGB2RGBA);
    }

    const outputCanvas = new OffscreenCanvas(output.cols, output.rows);
    const outputCtx = outputCanvas.getContext("2d");
    if (!outputCtx) throw new Error("Output canvas context not available");
    const outImageData = new ImageData(
      new Uint8ClampedArray(output.data),
      output.cols,
      output.rows,
    );
    outputCtx.putImageData(outImageData, 0, 0);
    step = "to_blob";
    emit("crop:step", { step, ...context });
    const blob = await outputCanvas.convertToBlob({
      type: "image/jpeg",
      quality: 0.92,
    });

    if (output !== warped) {
      output.delete();
    }
    best.approx.delete();
    srcTri.delete();
    dstTri.delete();
    transform.delete();
    warped.delete();

    const confidence = Math.min(1, best.area / (src.rows * src.cols));
    emit("crop:done", {
      ...context,
      width: outputCanvas.width,
      height: outputCanvas.height,
      confidence,
    });
    return {
      blob,
      width: outputCanvas.width,
      height: outputCanvas.height,
      confidence,
    };
  } catch (error) {
    emit("crop:error", {
      ...context,
      step,
      message: error instanceof Error ? error.message : "unknown error",
    });
    throw error;
  } finally {
    src.delete();
    gray.delete();
    blurred.delete();
    edged.delete();
    contours.delete();
    hierarchy.delete();
  }
}

self.onmessage = async (event) => {
  const data = event.data || {};
  if (data.type !== "crop") return;
  const { id, buffer, mime, side, opencvUrl } = data;
  const context = { side, opencvUrl };
  try {
    const result = await cropVisitCard(buffer, mime, context);
    self.postMessage({ type: "result", id, ok: true, ...result });
  } catch (error) {
    self.postMessage({
      type: "result",
      id,
      ok: false,
      error: error instanceof Error ? error.message : "unknown error",
    });
  }
};
