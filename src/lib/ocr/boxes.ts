export type OcrBoxLevel = "line" | "word" | "block" | "unknown";

export type OcrBox = {
  id: string;
  text: string;
  level: OcrBoxLevel;
  bbox: { x: number; y: number; width: number; height: number };
};

export type OcrDimensions = { width: number; height: number };

type BoxCandidate = {
  text: string;
  level: OcrBoxLevel;
  bbox: { x: number; y: number; width: number; height: number };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseArrayBox(values: number[]) {
  if (values.length < 4) return null;
  const [a, b, c, d] = values;
  if ([a, b, c, d].some((v) => !Number.isFinite(v))) return null;
  if (c > a && d > b) {
    return { x: a, y: b, width: c - a, height: d - b };
  }
  if (c >= 0 && d >= 0) {
    return { x: a, y: b, width: c, height: d };
  }
  return null;
}

function parseBoxFromValue(value: unknown) {
  if (!value) return null;
  if (Array.isArray(value)) {
    const nums = value.map((v) => (typeof v === "number" ? v : NaN));
    if (nums.every((v) => Number.isFinite(v))) {
      return parseArrayBox(nums);
    }
    if (value.length >= 4 && typeof value[0] === "number") {
      const flat = value
        .flatMap((item) =>
          Array.isArray(item)
            ? item
            : typeof item === "number"
              ? item
              : [],
        )
        .filter((v) => typeof v === "number") as number[];
      if (flat.length >= 4) {
        return parseArrayBox(flat);
      }
    }
    if (value.length >= 2 && isRecord(value[0])) {
      const points = value as Array<Record<string, unknown>>;
      const xs = points.map((p) => toNumber(p.x)).filter((v): v is number => v !== null);
      const ys = points.map((p) => toNumber(p.y)).filter((v): v is number => v !== null);
      if (xs.length && ys.length) {
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const maxX = Math.max(...xs);
        const maxY = Math.max(...ys);
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
      }
    }
  }

  if (isRecord(value)) {
    const x = toNumber(value.x ?? value.left ?? value.x0 ?? value.minX);
    const y = toNumber(value.y ?? value.top ?? value.y0 ?? value.minY);
    const w = toNumber(value.width);
    const h = toNumber(value.height);
    const right = toNumber(value.right ?? value.x1 ?? value.maxX);
    const bottom = toNumber(value.bottom ?? value.y1 ?? value.maxY);
    if (x !== null && y !== null && w !== null && h !== null) {
      return { x, y, width: w, height: h };
    }
    if (x !== null && y !== null && right !== null && bottom !== null) {
      return { x, y, width: right - x, height: bottom - y };
    }
    if (Array.isArray(value.vertices) || Array.isArray(value.polygon)) {
      return parseBoxFromValue(value.vertices ?? value.polygon);
    }
  }

  return null;
}

function extractText(node: Record<string, unknown>) {
  const textCandidate =
    (typeof node.text === "string" && node.text) ||
    (typeof node.content === "string" && node.content) ||
    (typeof node.value === "string" && node.value) ||
    (typeof node.utf8 === "string" && node.utf8) ||
    (typeof node.word === "string" && node.word) ||
    (typeof node.line === "string" && node.line);
  if (!textCandidate) return null;
  const trimmed = textCandidate.trim();
  if (!trimmed) return null;
  if (trimmed.length > 240) return null;
  return trimmed;
}

function guessLevel(path: string[]) {
  const joined = path.join(".").toLowerCase();
  if (joined.includes("word")) return "word";
  if (joined.includes("line")) return "line";
  if (joined.includes("block")) return "block";
  return "unknown";
}

export function extractOcrBoxes(raw: unknown): OcrBox[] {
  const boxes: BoxCandidate[] = [];
  const visited = new Set<object>();

  const walk = (node: unknown, path: string[]) => {
    if (!node || typeof node !== "object") return;
    if (visited.has(node as object)) return;
    visited.add(node as object);

    if (Array.isArray(node)) {
      node.forEach((item, index) => walk(item, [...path, String(index)]));
      return;
    }

    const record = node as Record<string, unknown>;
    const text = extractText(record);
    if (text) {
      const bbox =
        parseBoxFromValue(record.bbox) ||
        parseBoxFromValue(record.bounding_box) ||
        parseBoxFromValue(record.boundingBox) ||
        parseBoxFromValue(record.box) ||
        parseBoxFromValue(record.bounds) ||
        parseBoxFromValue(record.rect) ||
        parseBoxFromValue(record.rectangle) ||
        parseBoxFromValue(record.polygon);
      if (bbox && bbox.width > 0 && bbox.height > 0) {
        boxes.push({
          text,
          level: guessLevel(path),
          bbox,
        });
      }
    }

    for (const [key, value] of Object.entries(record)) {
      if (value && typeof value === "object") {
        walk(value, [...path, key]);
      }
    }
  };

  walk(raw, []);

  const deduped = new Map<string, OcrBox>();
  boxes.forEach((box, index) => {
    const key = `${box.text}:${box.bbox.x}:${box.bbox.y}:${box.bbox.width}:${box.bbox.height}`;
    if (!deduped.has(key)) {
      deduped.set(key, { ...box, id: `box-${index}` });
    }
  });

  return Array.from(deduped.values());
}

export function extractOcrDimensions(raw: unknown): OcrDimensions | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const pages = Array.isArray(record.pages) ? record.pages : null;
  if (!pages || pages.length === 0) return null;
  const page = pages[0] as Record<string, unknown> | null;
  if (!page) return null;
  const dims = page.dimensions as Record<string, unknown> | null;
  if (!dims) return null;
  const width = typeof dims.width === "number" ? dims.width : null;
  const height = typeof dims.height === "number" ? dims.height : null;
  if (!width || !height) return null;
  return { width, height };
}
