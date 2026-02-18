import type { ContactValue, ExtractedContact, LabeledValue, NormalizedContact } from "@/lib/types";

const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const phoneRegex = /\+?[0-9][0-9()\-\.\s]{6,}[0-9]/g;
const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[A-Z0-9.-]+\.[A-Z]{2,})(\/[^\s]*)?/gi;
const imageArtifactRegex = /!\[[^\]]*\]\([^)]*\)|img-\d+\.(png|jpe?g|gif)/gi;
const bulletRegex = /^[\s#•*\-–—·>]+/;
const arrowRegex = /[🢐🡆➔➤➜]+/g;

const labelRegex = {
  phone: /^(tel|telephone|telefon|phone|mob|mobile|đt|điện thoại)\s*[:：]/i,
  fax: /^(fax)\s*[:：]/i,
  email: /^(e-?mail)\s*[:：]/i,
  web: /^(web|website|site|url)\s*[:：]/i,
  office: /^(văn phòng|vp|office)\s*[:：]/i,
  branch: /^(cn|chi nhánh|branch)\s*[:：]/i,
};

const companyHintRegex = /(co\.?\s*ltd|ltd|inc\.?|corp\.?|gmbh|s\.a\.?|company|tnhh|jsc|công ty|praxis|clinic|studio|atelier|zentrum|büro|office)/i;
const titleHintRegex = /(phòng\s+(kinh doanh|marketing|sales|nhân sự|kỹ thuật|kỹ thuật)|department|sales|marketing|business|manager|director|lead|vice president|president|engineer|research|entwicklung|entwicklung|development)/i;
const addressLineRegex = /^(văn phòng|vp|office|cn|chi nhánh|branch)\s*[:：]/i;
const personHintRegex = /^(dr\.?|prof\.?|mr\.?|ms\.?|mrs\.?|herr|frau)\b/i;
const addressStreetRegex = /(straße|strasse|str\.|street|st\.|road|rd\.|platz|allee)/i;
const postalRegex = /\b\d{4,6}\b/;
const hoursHeaderRegex = /(öffnungszeiten|opening hours)/i;
const hoursLineRegex = /(mo|di|mi|do|fr|sa|so)\b/i;
const timeRegex = /\b\d{1,2}:\d{2}\b/;
const marketingRegex = /(wir helfen|we help|call us|reach us|kontaktieren)/i;
const contactInlineRegex = /(telefon|tel\.?|phone|fax|e-?mail|web(site)?|www\.|http)/i;

function stripContactFromAddressLine(line: string) {
  const idx = line.search(contactInlineRegex);
  if (idx === -1) return line.trim();
  return line.slice(0, idx).trim();
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function uniqueLabeled(values: LabeledValue[]) {
  const seen = new Set<string>();
  const result: LabeledValue[] = [];
  values.forEach((value) => {
    const key = `${value.label ?? ""}:${value.value}`.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(value);
    }
  });
  return result;
}

function stripArtifacts(text: string) {
  return text
    .replace(imageArtifactRegex, "")
    .replace(arrowRegex, "")
    .split(/\r?\n/)
    .map((line) => line.replace(bulletRegex, "").trim())
    .filter(Boolean)
    .join("\n");
}

function decodeEntities(text: string) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function cleanUrls(values: string[]) {
  const tlds = new Set([
    "com",
    "net",
    "org",
    "de",
    "at",
    "ch",
    "eu",
    "io",
    "co",
    "us",
    "uk",
    "fr",
    "it",
    "es",
    "nl",
    "be",
    "jp",
    "cn",
    "ru",
    "pl",
    "se",
    "no",
    "fi",
    "dk",
    "pt",
    "br",
    "mx",
    "ca",
    "au",
    "nz",
  ]);

  const isLikelyUrl = (value: string) => {
    const cleaned = value.replace(/^[^a-z0-9]+/i, "");
    if (/^https?:\/\//i.test(cleaned) || /^www\./i.test(cleaned)) return true;
    const host = cleaned.split("/")[0];
    if (!host.includes(".")) return false;
    const tld = host.split(".").pop()?.toLowerCase();
    return tld ? tlds.has(tld) : false;
  };

  return unique(
    values.filter(
      (value) =>
        !/\.(png|jpe?g|gif)$/i.test(value) && isLikelyUrl(value),
    ),
  );
}

function parseLabelValue(line: string) {
  const parts = line.split(/[:：]/);
  if (parts.length < 2) return "";
  return parts.slice(1).join(":").trim();
}

function parseNumbers(line: string) {
  const matches = line.match(phoneRegex) ?? [];
  return unique(matches);
}

function extractLabeledNumbers(line: string) {
  const results: LabeledValue[] = [];
  const parts = line.split(/[•·|]/);
  parts.forEach((part) => {
    const trimmed = part.trim();
    if (!trimmed) return;
    const match = trimmed.match(/^(t|m|f|tel|telefon|mobile)\\b\\s*[:：]?\\s*(.+)$/i);
    if (!match) return;
    const labelRaw = match[1].toUpperCase();
    const label = labelRaw === "TEL" || labelRaw === "TELEFON" ? "T" : labelRaw === "MOBILE" ? "M" : labelRaw;
    const numbers = parseNumbers(match[2] ?? "");
    numbers.forEach((value) => results.push({ label, value }));
  });
  return results;
}

function isMostlyUppercase(line: string) {
  const letters = line.replace(/[^\p{L}]/gu, "");
  if (!letters) return false;
  const upper = letters.toUpperCase();
  return letters === upper && letters.length >= 6;
}

function isLikelyPersonName(line: string) {
  if (companyHintRegex.test(line)) return false;
  if (personHintRegex.test(line)) return true;
  if (/\d/.test(line)) return false;
  const words = line.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 4) return false;
  const caps = words.filter((word) => /^[A-ZÄÖÜ][a-zäöüß-]+$/.test(word));
  return caps.length >= 2;
}

function deriveLabel(line: string) {
  const lower = line.toLowerCase();
  let base = "";
  if (labelRegex.office.test(line)) base = "office";
  if (labelRegex.branch.test(line)) base = "branch";
  if (!base && /office|văn phòng/.test(lower)) base = "office";
  if (!base && /branch|chi nhánh|cn/.test(lower)) base = "branch";

  let loc = "";
  if (/hcm|ho chi minh|sai gon/.test(lower)) loc = "hcm";
  if (/ha noi|hà nội/.test(lower)) loc = "hanoi";
  if (/china|trung quoc|trung quốc/.test(lower)) loc = "china";
  if (/viet nam|vietnam/.test(lower)) loc = "vietnam";

  if (base && loc) return `${base}-${loc}`;
  if (base) return base;
  if (loc) return loc;
  return "";
}

function toLabeled(values: ContactValue[] | undefined, fallbackLabel?: string) {
  const result: LabeledValue[] = [];
  (values ?? []).forEach((entry) => {
    if (typeof entry === "string") {
      result.push({ label: fallbackLabel, value: entry });
      return;
    }
    result.push({ label: entry.label ?? fallbackLabel, value: entry.value });
  });
  return result;
}

function extractAddresses(lines: string[]) {
  const addresses: LabeledValue[] = [];
  let current: { label?: string; parts: string[] } | null = null;

  const flush = () => {
    if (current && current.parts.length > 0) {
      addresses.push({ label: current.label, value: current.parts.join(" ").trim() });
    }
    current = null;
  };

  for (const line of lines) {
    if (
      labelRegex.phone.test(line) ||
      labelRegex.fax.test(line) ||
      labelRegex.email.test(line) ||
      labelRegex.web.test(line) ||
      phoneRegex.test(line) ||
      contactInlineRegex.test(line)
    ) {
      flush();
      continue;
    }

    if (labelRegex.office.test(line) || labelRegex.branch.test(line)) {
      flush();
      const label = deriveLabel(line) || undefined;
      current = { label, parts: [line.replace(/\s+/g, " ")] };
      continue;
    }

    if (current) {
      const cleaned = stripContactFromAddressLine(line);
      if (cleaned) {
        current.parts.push(cleaned.replace(/\s+/g, " "));
      }
    }
  }

  flush();
  return addresses;
}

function inferAddress(lines: string[]) {
  const addresses: LabeledValue[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (addressLineRegex.test(line)) continue;
    if (
      labelRegex.phone.test(line) ||
      labelRegex.fax.test(line) ||
      labelRegex.email.test(line) ||
      labelRegex.web.test(line) ||
      phoneRegex.test(line) ||
      contactInlineRegex.test(line)
    ) {
      continue;
    }
    if (hoursHeaderRegex.test(line) || hoursLineRegex.test(line) || timeRegex.test(line)) {
      continue;
    }
    if (postalRegex.test(line) && /[A-Za-zÄÖÜäöüß]/.test(line)) {
      const prev = lines[i - 1];
      const parts = [];
      if (prev && (addressStreetRegex.test(prev) || /\d/.test(prev))) {
        const cleanedPrev = stripContactFromAddressLine(prev);
        if (cleanedPrev) {
          parts.push(cleanedPrev);
        }
      }
      const cleanedLine = stripContactFromAddressLine(line);
      if (cleanedLine) {
        parts.push(cleanedLine);
      }
      if (parts.length > 0) {
        addresses.push({ label: "office", value: parts.join(" ") });
      }
    }
  }
  return addresses;
}

export function extractContactFromText(text: string): ExtractedContact {
  const cleanedText = decodeEntities(stripArtifacts(text));
  const lines = cleanedText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const emails = unique(cleanedText.match(emailRegex) ?? []);
  const emailDomains = emails
    .map((email) => email.split("@")[1])
    .filter(Boolean);
  const websites = cleanUrls(cleanedText.match(urlRegex) ?? []).filter(
    (value) => !emailDomains.includes(value.replace(/^www\./i, "")),
  );

  const phones: LabeledValue[] = [];
  const faxes: LabeledValue[] = [];
  const remaining: string[] = [];
  let contextLabel = "";

  for (const line of lines) {
    if (labelRegex.office.test(line) || labelRegex.branch.test(line)) {
      contextLabel = deriveLabel(line);
      continue;
    }
    if (labelRegex.email.test(line)) {
      const value = parseLabelValue(line);
      emails.push(...(value.match(emailRegex) ?? []));
      continue;
    }
    if (labelRegex.web.test(line)) {
      const value = parseLabelValue(line);
      websites.push(...(value.match(urlRegex) ?? []));
      continue;
    }
    if (labelRegex.phone.test(line)) {
      const value = parseLabelValue(line);
      const numbers = parseNumbers(value || line);
      numbers.forEach((phone) =>
        phones.push({ label: contextLabel || undefined, value: phone }),
      );
      continue;
    }
    if (line.includes("T ") || line.includes(" M ") || /\\bT\\b|\\bM\\b/.test(line)) {
      const labeled = extractLabeledNumbers(line);
      if (labeled.length > 0) {
        labeled.forEach((entry) => phones.push(entry));
        continue;
      }
    }
    if (labelRegex.fax.test(line)) {
      const value = parseLabelValue(line);
      const numbers = parseNumbers(value || line);
      numbers.forEach((fax) => faxes.push({ label: contextLabel || undefined, value: fax }));
      continue;
    }
    remaining.push(line);
  }

  let addresses = extractAddresses(lines);
  if (addresses.length === 0) {
    addresses = inferAddress(lines);
  }

  const defaultLabel = addresses[0]?.label;
  const normalizeLabel = (value: LabeledValue) => ({
    label: value.label || defaultLabel,
    value: value.value,
  });

  const companyLine =
    remaining.find((line) => companyHintRegex.test(line)) ??
    remaining.find((line) => /group|se|ag|gmbh/i.test(line));
  const firstLine = lines[0];

  const inferredName =
    firstLine && isLikelyPersonName(firstLine) ? firstLine : undefined;
  const nameLine =
    inferredName ||
    remaining.find(
      (line) =>
        line !== companyLine &&
        (isMostlyUppercase(line) || /công ty/i.test(line)),
    );

  const personLines = remaining.filter(
    (line) => personHintRegex.test(line),
  );

  const nameFinal =
    personLines.length > 0 ? personLines.join(" / ") : nameLine;
  const titleLine = remaining.find(
    (line) =>
      line !== companyLine && line !== nameFinal && titleHintRegex.test(line),
  );

  const extraPhones = remaining.flatMap((line) => line.match(phoneRegex) ?? []);
  const rawPhones = uniqueLabeled(
    phones.concat(extraPhones.map((value) => ({ value }))).map(normalizeLabel),
  );
  const rawFaxes = uniqueLabeled(faxes.map(normalizeLabel));

  const hoursIndex = lines.findIndex((line) => hoursHeaderRegex.test(line));
  const noteSource = hoursIndex >= 0 ? lines.slice(hoursIndex) : remaining;
  const notes = noteSource
    .filter((line) => {
      if (
        line === companyLine ||
        line === nameFinal ||
        line === titleLine ||
        addressLineRegex.test(line)
      ) {
        return false;
      }
      if (
        labelRegex.phone.test(line) ||
        labelRegex.fax.test(line) ||
        labelRegex.email.test(line) ||
        labelRegex.web.test(line)
      ) {
        return false;
      }
      if (marketingRegex.test(line)) return false;
      if (hoursIndex >= 0) {
        return hoursHeaderRegex.test(line) || hoursLineRegex.test(line) || timeRegex.test(line);
      }
      return true;
    })
    .join("\n");

  return {
    name: nameFinal,
    company: companyLine,
    title: titleLine,
    emails: unique(emails),
    phones: rawPhones,
    faxes: rawFaxes,
    websites: cleanUrls(unique(websites)),
    address: addresses.length > 0 ? addresses : undefined,
    notes: notes || undefined,
    raw_text: cleanedText,
  };
}

export function normalizeContact(
  extracted: ExtractedContact,
): NormalizedContact {
  const phones = toLabeled(extracted.phones);
  const websites = extracted.websites ?? [];

  return {
    full_name: extracted.name,
    company: extracted.company,
    title: extracted.title,
    primary_email: extracted.emails?.[0],
    primary_phone: phones[0]?.value,
    primary_website: websites[0],
  };
}

export function toLabeledList(values?: ContactValue[] | string) {
  if (!values) return [] as LabeledValue[];
  if (typeof values === "string") {
    return [{ value: values }];
  }
  return toLabeled(values as ContactValue[]);
}
