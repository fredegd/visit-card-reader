import { describe, expect, it } from "vitest";
import { toVCard } from "./vcard";
import { toCsv } from "./csv";
import { toJson } from "./json";

const contact = {
  name: "Ada Lovelace",
  company: "Analytical Engines",
  title: "Engineer",
  emails: ["ada@example.com"],
  phones: ["+12025550123"],
  websites: ["https://adalovelace.org"],
  address: "12 St James Sq, London",
  notes: "Met at compute meetup",
};

describe("exports", () => {
  it("creates a vCard", () => {
    const vcard = toVCard(contact);
    expect(vcard).toContain("BEGIN:VCARD");
    expect(vcard).toContain("FN:Ada Lovelace");
    expect(vcard).toContain("EMAIL;TYPE=INTERNET:ada@example.com");
  });

  it("creates a CSV", () => {
    const csv = toCsv(contact);
    expect(csv.split("\n").length).toBe(2);
    expect(csv).toContain("Ada Lovelace");
  });

  it("creates JSON", () => {
    const json = toJson(contact);
    expect(json).toContain("\"Ada Lovelace\"");
  });
});
