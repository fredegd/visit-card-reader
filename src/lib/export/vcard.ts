import type { ContactValue, ExtractedContact } from "@/lib/types";
import { toLabeledList } from "@/lib/extract/contact";

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

  const phones = toLabeledList(contact.phones as ContactValue[] | string);
  phones.forEach((phone) => {
    const label = phone.label?.toLowerCase() ?? "";
    const type = label.includes("mobile") ? "CELL" : label.includes("home") ? "HOME" : "WORK";
    lines.push(`TEL;TYPE=${type}:${escapeValue(phone.value)}`);
  });

  const faxes = toLabeledList(contact.faxes as ContactValue[] | string);
  faxes.forEach((fax) => {
    lines.push(`TEL;TYPE=FAX:${escapeValue(fax.value)}`);
  });

  contact.websites?.forEach((website) => {
    lines.push(`URL:${escapeValue(website)}`);
  });

  const addresses = toLabeledList(contact.address as ContactValue[] | string);
  if (addresses.length > 0) {
    addresses.forEach((address) => {
      lines.push(`ADR;TYPE=WORK:;;${escapeValue(address.value)};;;;`);
    });
  }

  if (contact.notes) {
    lines.push(`NOTE:${escapeValue(contact.notes)}`);
  }

  lines.push("END:VCARD");

  return lines.join("\n");
}
