import { describe, expect, it } from "vitest";
import { zonedTimeToUtc, toZonedInputValue, fromZonedInputValue, findConflicts } from "@/lib/time";
import { abstractSchema, countWords } from "@/lib/validation/abstract";
import { buildIcs } from "@/lib/ics";
import { seedEdition } from "@/content/seed";

describe("UK time handling", () => {
  it("converts GMT wall-clock times (November) to UTC", () => {
    expect(zonedTimeToUtc("2026-11-21", "09:00").toISOString()).toBe("2026-11-21T09:00:00.000Z");
  });
  it("converts BST wall-clock times (summer) to UTC", () => {
    expect(zonedTimeToUtc("2026-07-01", "09:00").toISOString()).toBe("2026-07-01T08:00:00.000Z");
  });
  it("round-trips admin datetime inputs", () => {
    const iso = fromZonedInputValue("2026-11-21T09:15")!;
    expect(toZonedInputValue(iso)).toBe("2026-11-21T09:15");
    expect(fromZonedInputValue("not a date")).toBeNull();
  });
  it("detects agenda conflicts and ignores untimed sessions", () => {
    const s = (id: string, a: string | null, b: string | null) => ({ id, startsAt: a, endsAt: b });
    const ids = findConflicts([
      s("a", "2026-11-21T10:00:00Z", "2026-11-21T11:00:00Z"),
      s("b", "2026-11-21T10:30:00Z", "2026-11-21T11:30:00Z"),
      s("c", "2026-11-21T11:30:00Z", "2026-11-21T12:00:00Z"),
      s("d", null, null),
    ]);
    expect([...ids].sort()).toEqual(["a", "b"]);
  });
});

describe("abstract validation", () => {
  const cfg = seedEdition.abstractConfig;
  const base = {
    presentingAuthor: "Ada Lovelace", email: "ada@example.test", university: "University of Lincoln", programmeYear: "MBChB Year 3",
    title: "A valid title", coAuthors: "", category: cfg.categories[0], presentationPreference: "",
    background: "Some words.", aim: "Some words.", methods: "Some words.", results: "Some words.", conclusion: "Some words.",
    consentData: true, declarationOriginal: true, consentShowcase: false,
  };
  it("counts words", () => {
    expect(countWords("  one two\nthree  ")).toBe(3);
    expect(countWords("   ")).toBe(0);
  });
  it("accepts a complete submission", () => {
    expect(abstractSchema(cfg, "submit").safeParse(base).success).toBe(true);
  });
  it("requires consents to submit but not to save a draft", () => {
    const v = { ...base, consentData: false, background: "" };
    expect(abstractSchema(cfg, "submit").safeParse(v).success).toBe(false);
    expect(abstractSchema(cfg, "draft").safeParse(v).success).toBe(true);
  });
  it("enforces per-section and total word limits", () => {
    const long = Array(cfg.sectionWordLimit + 1).fill("word").join(" ");
    expect(abstractSchema(cfg, "draft").safeParse({ ...base, methods: long }).success).toBe(false);
    const near = Array(cfg.sectionWordLimit).fill("word").join(" ");
    const r = abstractSchema(cfg, "submit").safeParse({ ...base, background: near, aim: near, methods: near });
    expect(r.success).toBe(cfg.sectionWordLimit * 3 + 2 <= cfg.totalWordLimit);
  });
  it("rejects categories that are not configured", () => {
    expect(abstractSchema(cfg, "submit").safeParse({ ...base, category: "Made up" }).success).toBe(false);
  });
});

describe("calendar export", () => {
  it("builds a valid, escaped iCalendar file", () => {
    const ics = buildIcs([{ uid: "x@inspire", title: "Keynote; opening, day", start: new Date("2026-11-21T09:00:00Z"), end: new Date("2026-11-21T10:00:00Z"), location: "Lincoln" }]);
    expect(ics.startsWith("BEGIN:VCALENDAR")).toBe(true);
    expect(ics).toContain("DTSTART:20261121T090000Z");
    expect(ics).toContain("Keynote\; opening\\, day");
    expect(ics.trim().endsWith("END:VCALENDAR")).toBe(true);
  });
});
