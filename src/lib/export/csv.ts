import type { ContactValue, ExtractedContact } from "@/lib/types";
import { toLabeledList } from "@/lib/extract/contact";

function escapeCsv(value: string) {
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

export function toCsv(contact: ExtractedContact): string {
  const headers = [
    "Name",
    "Company",
    "Title",
    "Email",
    "Phone",
    "Fax",
    "Website",
    "Address",
    "Notes",
  ];

  const addressValue = toLabeledList(contact.address as ContactValue[] | string)
    .map((item) => (item.label ? `${item.label}: ${item.value}` : item.value))
    .join(" | ");
  const phoneValue = toLabeledList(contact.phones as ContactValue[] | string)
    .map((item) => (item.label ? `${item.label}: ${item.value}` : item.value))
    .join(" | ");
  const faxValue = toLabeledList(contact.faxes as ContactValue[] | string)
    .map((item) => (item.label ? `${item.label}: ${item.value}` : item.value))
    .join(" | ");

  const row = [
    contact.name ?? "",
    contact.company ?? "",
    contact.title ?? "",
    contact.emails?.[0] ?? "",
    phoneValue,
    faxValue,
    contact.websites?.[0] ?? "",
    addressValue,
    contact.notes ?? "",
  ];

  return `${headers.map(escapeCsv).join(",")}
${row.map(escapeCsv).join(",")}`;
}
