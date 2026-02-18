import type { ExtractedContact } from "@/lib/types";

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
    "Website",
    "Address",
    "Notes",
  ];

  const row = [
    contact.name ?? "",
    contact.company ?? "",
    contact.title ?? "",
    contact.emails?.[0] ?? "",
    contact.phones?.[0] ?? "",
    contact.websites?.[0] ?? "",
    contact.address ?? "",
    contact.notes ?? "",
  ];

  return `${headers.map(escapeCsv).join(",")}
${row.map(escapeCsv).join(",")}`;
}
