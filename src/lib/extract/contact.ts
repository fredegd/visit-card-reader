import type { ExtractedContact, NormalizedContact } from "@/lib/types";

const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const phoneRegex = /\+?[0-9][0-9()\-\.\s]{6,}[0-9]/g;
const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[A-Z0-9.-]+\.[A-Z]{2,})(\/[^\s]*)?/gi;

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function normalizePhone(value: string) {
  const cleaned = value.replace(/[^0-9+]/g, "");
  return cleaned.length >= 7 ? cleaned : value.trim();
}

function isCandidateLine(line: string) {
  const lower = line.toLowerCase();
  return (
    line.length > 0 &&
    !emailRegex.test(line) &&
    !phoneRegex.test(line) &&
    !lower.includes("www") &&
    !lower.includes("http")
  );
}

export function extractContactFromText(text: string): ExtractedContact {
  const cleanedText = text.replace(/\s+$/g, "").trim();
  const lines = cleanedText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const emails = unique(cleanedText.match(emailRegex) ?? []);
  const phones = unique(
    (cleanedText.match(phoneRegex) ?? []).map(normalizePhone),
  );
  const websites = unique(
    (cleanedText.match(urlRegex) ?? []).map((value) =>
      value.replace(/^[^a-z0-9]+/i, ""),
    ),
  );

  const candidateLines = lines.filter(isCandidateLine);

  const nameLine = candidateLines.find((line) => {
    const words = line.split(/\s+/);
    return words.length >= 2 && words.length <= 4 && line.length <= 40;
  });

  const remaining = candidateLines.filter((line) => line !== nameLine);

  const titleLine = remaining.find((line) => line.length <= 60);
  const companyLine = remaining.find(
    (line) => line !== titleLine && line.length <= 60,
  );

  const addressLines = lines.filter((line) =>
    /\d+\s+|\b(st|street|ave|avenue|rd|road|blvd|lane|ln|suite|ste)\b/i.test(
      line,
    ),
  );

  return {
    name: nameLine,
    title: titleLine,
    company: companyLine,
    emails,
    phones,
    websites,
    address: addressLines.join(", ") || undefined,
    notes: cleanedText,
    raw_text: cleanedText,
  };
}

export function normalizeContact(
  extracted: ExtractedContact,
): NormalizedContact {
  return {
    full_name: extracted.name,
    company: extracted.company,
    title: extracted.title,
    primary_email: extracted.emails?.[0],
    primary_phone: extracted.phones?.[0],
    primary_website: extracted.websites?.[0],
  };
}
