import type { ContactValue, ExtractedContact, LabeledValue } from "@/lib/types";

function unique(values: Array<string | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => (value ?? "").trim())
        .filter(Boolean),
    ),
  );
}

function toLabeled(values: ContactValue[] | undefined) {
  const result: LabeledValue[] = [];
  (values ?? []).forEach((entry) => {
    if (typeof entry === "string") {
      result.push({ value: entry });
    } else {
      result.push({ label: entry.label, value: entry.value });
    }
  });
  return result;
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

export function mergeContacts(
  base: ExtractedContact,
  extra: ExtractedContact,
): ExtractedContact {
  const addressValues = [
    ...(Array.isArray(base.address)
      ? base.address
      : base.address
        ? [base.address]
        : []),
    ...(Array.isArray(extra.address)
      ? extra.address
      : extra.address
        ? [extra.address]
        : []),
  ] as ContactValue[];

  const addressLabeled = uniqueLabeled(toLabeled(addressValues));

  return {
    name: base.name || extra.name,
    company: base.company || extra.company,
    title: base.title || extra.title,
    emails: unique([...(base.emails ?? []), ...(extra.emails ?? [])]),
    phones: uniqueLabeled([...toLabeled(base.phones), ...toLabeled(extra.phones)]),
    faxes: uniqueLabeled([...toLabeled(base.faxes), ...toLabeled(extra.faxes)]),
    websites: unique([...(base.websites ?? []), ...(extra.websites ?? [])]),
    address: addressLabeled.length > 0 ? addressLabeled : undefined,
    notes: unique([base.notes, extra.notes]).join("\n") || undefined,
    raw_text: unique([base.raw_text, extra.raw_text]).join("\n") || undefined,
  };
}
