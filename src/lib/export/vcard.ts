import type { ExtractedContact } from "@/lib/types";

function escapeValue(value: string) {
  return value.replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export function toVCard(contact: ExtractedContact): string {
  const fullName = contact.name?.trim() ?? "";
  const nameParts = fullName.split(/\s+/).filter(Boolean);
  const lastName = nameParts.length > 0 ? nameParts[nameParts.length - 1] : "";
  const firstName = nameParts.slice(0, -1).join(" ");

  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${escapeValue(lastName)};${escapeValue(firstName)};;;`,
    `FN:${escapeValue(fullName || contact.company || "")}`,
  ];

  if (contact.company) {
    lines.push(`ORG:${escapeValue(contact.company)}`);
  }

  if (contact.title) {
    lines.push(`TITLE:${escapeValue(contact.title)}`);
  }

  contact.emails?.forEach((email) => {
    lines.push(`EMAIL;TYPE=INTERNET:${escapeValue(email)}`);
  });

  contact.phones?.forEach((phone) => {
    lines.push(`TEL;TYPE=CELL:${escapeValue(phone)}`);
  });

  contact.websites?.forEach((website) => {
    lines.push(`URL:${escapeValue(website)}`);
  });

  if (contact.address) {
    lines.push(`ADR;TYPE=WORK:;;${escapeValue(contact.address)};;;;`);
  }

  if (contact.notes) {
    lines.push(`NOTE:${escapeValue(contact.notes)}`);
  }

  lines.push("END:VCARD");

  return lines.join("\n");
}
