import type { ExtractedContact } from "@/lib/types";
import { extractContactFromText } from "@/lib/extract/contact";

function parseVCard(payload: string): ExtractedContact {
  const rawLines = payload.split(/\r?\n/);
  const lines: string[] = [];

  rawLines.forEach((line) => {
    if (!line) return;
    if (/^[ \t]/.test(line) && lines.length > 0) {
      lines[lines.length - 1] += line.trim();
    } else {
      lines.push(line.trim());
    }
  });

  const contact: ExtractedContact = {
    emails: [],
    phones: [],
    websites: [],
  };

  for (const line of lines) {
    const [keyPart, valuePart] = line.split(/:(.+)/);
    if (!valuePart) continue;
    const key = keyPart.split(";")[0].toUpperCase();
    const value = valuePart.trim();

    switch (key) {
      case "FN":
        contact.name = value;
        break;
      case "N": {
        const parts = value.split(";");
        const last = parts[0] ?? "";
        const first = parts[1] ?? "";
        const full = `${first} ${last}`.trim();
        if (!contact.name && full) {
          contact.name = full;
        }
        break;
      }
      case "ORG":
        contact.company = value;
        break;
      case "TITLE":
        contact.title = value;
        break;
      case "EMAIL":
        contact.emails?.push(value);
        break;
      case "TEL":
        contact.phones?.push(value);
        break;
      case "URL":
        contact.websites?.push(value);
        break;
      case "ADR": {
        const parts = value.split(";").filter(Boolean);
        contact.address = parts.join(", ");
        break;
      }
      case "NOTE":
        contact.notes = value;
        break;
      default:
        break;
    }
  }

  contact.raw_text = payload;
  return contact;
}

export function extractContactFromQrPayload(payload: string): ExtractedContact {
  const trimmed = payload.trim();
  if (!trimmed) return { raw_text: "" };

  const upper = trimmed.toUpperCase();
  if (upper.startsWith("BEGIN:VCARD")) {
    return parseVCard(trimmed);
  }

  if (upper.startsWith("MAILTO:")) {
    const email = trimmed.replace(/^mailto:/i, "").trim();
    return { emails: [email], raw_text: trimmed };
  }

  if (upper.startsWith("TEL:")) {
    const phone = trimmed.replace(/^tel:/i, "").trim();
    return { phones: [phone], raw_text: trimmed };
  }

  if (upper.startsWith("HTTP") || upper.startsWith("WWW.")) {
    return { websites: [trimmed], raw_text: trimmed };
  }

  return extractContactFromText(trimmed);
}
