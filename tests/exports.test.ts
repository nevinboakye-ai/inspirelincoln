import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { readFile } from "node:fs/promises";
import { buildWorkbook, sheetName } from "@/lib/exports/xlsx";
import { buildDocument } from "@/lib/exports/docx";
import { groupRows, slug, ukDateTime, withoutContact, type ExportTable } from "@/lib/exports/table";
import { universityName } from "@/lib/university-logos";

const table: ExportTable = {
  title: "Delegate list",
  description: "Everyone attending.",
  groupBy: "university",
  signColumn: "Attended",
  columns: [
    { key: "name", label: "Name", width: 24 },
    { key: "email", label: "Email", width: 30, personal: true },
    { key: "university", label: "University", width: 28 },
    { key: "note", label: "Note", width: 40, wordHidden: true },
  ],
  rows: [
    { name: "Ada Okafor", email: "ada@example.com", university: "University of Leeds", note: "=HYPERLINK(\"x\")" },
    { name: "Ben Smith", email: "ben@example.com", university: "Keele University", note: "" },
    { name: "Cara Jones", email: "cara@example.com", university: "", note: "" },
    { name: "Dev Patel", email: "dev@example.com", university: "University of Leeds", note: "" },
  ],
};
const meta = { title: "Delegate list", filter: null, generatedBy: "Test Person", generatedAt: new Date("2026-11-14T18:05:00Z") };

describe("download helpers", () => {
  it("groups rows A to Z with blanks last", () => {
    expect(groupRows(table).map((g) => [g.name, g.rows.length])).toEqual([
      ["Keele University", 1],
      ["University of Leeds", 2],
      ["Not given", 1],
    ]);
  });
  it("leaves out contact columns on request", () => {
    expect(withoutContact(table).columns.map((c) => c.key)).toEqual(["name", "university", "note"]);
  });
  it("gives one spelling per university", () => {
    expect(universityName("  UEA ")).toBe("University of East Anglia");
    expect(universityName("kcl")).toBe("King's College London");
    expect(universityName("Anglia  Ruskin University")).toBe("Anglia Ruskin University");
    expect(universityName(null)).toBe("");
  });
  it("makes safe names", () => {
    expect(slug("King's College London")).toBe("kings-college-london");
    const taken = new Set<string>();
    expect(sheetName("Oral presentation waiting list: 2026 [final]", taken)).toBe("Oral presentation waiting list");
    expect(sheetName("Oral presentation waiting list", taken)).toBe("Oral presentation waiting lis 2");
  });
  it("formats times in UK time", () => {
    expect(ukDateTime("2026-07-01T09:30:00Z")).toBe("1 Jul 2026, 10:30");
    expect(ukDateTime(null)).toBe("");
  });
});

describe("Excel download", () => {
  it("has a cover sheet and a filterable sheet with text kept as text", async () => {
    const logo = await readFile("public/brand/conference-logo-navy.png");
    const buf = await buildWorkbook([table], meta, logo);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["About this file", "Delegate list"]);
    const ws = wb.getWorksheet("Delegate list")!;
    expect(ws.getRow(5).values).toEqual([, "Name", "Email", "University", "Note"]);
    // Grouped order: Keele, Leeds, Leeds, then no university.
    expect([6, 7, 8, 9].map((r) => ws.getCell(r, 1).value)).toEqual(["Ben Smith", "Ada Okafor", "Dev Patel", "Cara Jones"]);
    // A formula-looking value stays plain text.
    const note = ws.getCell(7, 4);
    expect(note.value).toBe('=HYPERLINK("x")');
    expect(note.formula).toBeUndefined();
    expect(ws.autoFilter).toBeTruthy();
  });
});

describe("Word download", () => {
  it("writes every group and row, and skips Word-hidden columns", async () => {
    const buf = await buildDocument([table], meta, null);
    const xml = await (await JSZip.loadAsync(buf)).file("word/document.xml")!.async("string");
    for (const s of ["Delegate list", "Keele University", "University of Leeds", "Not given", "Ada Okafor", "dev@example.com", "Attended"]) expect(xml).toContain(s);
    expect(xml).not.toContain("HYPERLINK");
    expect(xml).toContain('w:orient="landscape"');
  });
});
