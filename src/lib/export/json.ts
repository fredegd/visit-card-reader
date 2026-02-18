import type { ExtractedContact } from "@/lib/types";

export function toJson(contact: ExtractedContact): string {
  return JSON.stringify(contact, null, 2);
}
