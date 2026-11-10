import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "@/lib/admin/server";

describe("CSV export", () => {
  it("quotes values and neutralises spreadsheet formulas", () => {
    expect(csvCell('He said "hi"')).toBe('"He said ""hi"""');
    expect(csvCell("=HYPERLINK(1)")).toBe(`"'=HYPERLINK(1)"`);
    expect(csvCell(["a", "b"])).toBe('"a; b"');
    expect(csvCell(null)).toBe('""');
  });
  it("builds rows in column order", () => {
    expect(toCsv([{ b: 2, a: 1 }], ["a", "b"])).toBe('"a","b"\r\n"1","2"');
  });
});
