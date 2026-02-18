import type { ExtractedContact } from "@/lib/types";

function unique(values: Array<string | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => (value ?? "").trim())
        .filter(Boolean),
    ),
  );
}

export function mergeContacts(
  base: ExtractedContact,
  extra: ExtractedContact,
): ExtractedContact {
  return {
    name: base.name || extra.name,
    company: base.company || extra.company,
    title: base.title || extra.title,
    emails: unique([...(base.emails ?? []), ...(extra.emails ?? [])]),
    phones: unique([...(base.phones ?? []), ...(extra.phones ?? [])]),
    websites: unique([...(base.websites ?? []), ...(extra.websites ?? [])]),
    address: base.address || extra.address,
    notes: unique([base.notes, extra.notes]).join("\n") || undefined,
    raw_text: unique([base.raw_text, extra.raw_text]).join("\n") || undefined,
  };
}
