import { describe, expect, it } from "vitest";
import { extractContactFromText } from "./contact";

describe("extractContactFromText", () => {
  it("extracts emails and phones", () => {
    const text = `Ada Lovelace\nEngineer\nada@example.com\n+1 (202) 555-0123`;
    const contact = extractContactFromText(text);
    expect(contact.emails?.[0]).toBe("ada@example.com");
    expect(contact.phones?.[0]).toContain("202");
  });
});
