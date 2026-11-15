import "server-only";
import ExcelJS from "exceljs";
import { cellText, groupRows, ukDateTime, PERSONAL_DATA_NOTE, type ExportMeta, type ExportTable } from "./table";

const NAVY = "FF1A3154";
const GOLD = "FFD4AF5A";
const PAPER = "FFF6F3EC";
const SLATE = "FF55607A";
const HEADER_ROW = 5;

/** Excel sheet names: at most 31 characters, none of []:*?/\ and unique in the workbook. */
export function sheetName(title: string, taken: Set<string>) {
  const base = title.replace(/[[\]:*?/\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 31).trim() || "Sheet";
  let name = base;
  for (let i = 2; taken.has(name.toLowerCase()); i++) name = `${base.slice(0, 31 - String(i).length - 1).trim()} ${i}`;
  taken.add(name.toLowerCase());
  return name;
}

/** A value as Excel should hold it: numbers stay numbers, everything else is text (never a formula). */
const excelValue = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : cellText(v as string));

/**
 * One workbook: a cover sheet saying what's inside, then one sheet per table
 * with a branded title, a filterable header row that stays in view, and
 * print settings for A4 landscape.
 */
export async function buildWorkbook(tables: ExportTable[], meta: ExportMeta, logo?: Buffer | null): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = `INSPIRE committee (${meta.generatedBy})`;
  wb.created = meta.generatedAt;
  wb.title = meta.title;

  const taken = new Set<string>();
  const cover = wb.addWorksheet(sheetName("About this file", taken), {
    properties: { tabColor: { argb: GOLD } },
    views: [{ showGridLines: false }],
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  const names = tables.map((t) => sheetName(t.title, taken));

  // Cover sheet ---------------------------------------------------------
  cover.columns = [{ width: 4 }, { width: 38 }, { width: 16 }, { width: 70 }];
  let r = 2;
  if (logo) {
    const id = wb.addImage({ buffer: logo as unknown as ExcelJS.Buffer, extension: "png" });
    cover.addImage(id, { tl: { col: 1, row: 1 }, ext: { width: 235, height: 90 } });
    r = 8;
  }
  const put = (row: number, col: number, value: string, font: Partial<ExcelJS.Font> = {}) => {
    const c = cover.getCell(row, col);
    c.value = value;
    c.font = { name: "Calibri", size: 11, color: { argb: "FF0F1B2E" }, ...font };
    c.alignment = { vertical: "top", wrapText: col === 4 };
    return c;
  };
  put(r, 2, meta.title, { size: 20, bold: true, color: { argb: NAVY } });
  r += 1;
  put(r, 2, "INSPIRE National Medical Research Conference", { size: 12, color: { argb: SLATE } });
  r += 2;
  if (meta.filter) put(r++, 2, `Showing: ${meta.filter}`, { bold: true });
  put(r++, 2, `Downloaded ${ukDateTime(meta.generatedAt.toISOString())} by ${meta.generatedBy}`, { color: { argb: SLATE } });
  r += 1;
  const note = put(r, 2, PERSONAL_DATA_NOTE, { italic: true, color: { argb: "FF7A5C14" } });
  cover.mergeCells(r, 2, r, 4);
  note.alignment = { wrapText: true, vertical: "top" };
  cover.getRow(r).height = 32;
  r += 2;

  const head = (row: number, labels: string[]) => {
    labels.forEach((l, i) => {
      const c = cover.getCell(row, i + 2);
      c.value = l;
      c.font = { name: "Calibri", bold: true, color: { argb: "FFFFFFFF" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    });
  };
  head(r++, ["Sheet", "Rows", "What it is"]);
  tables.forEach((t, i) => {
    const c = cover.getCell(r, 2);
    c.value = { text: names[i]!, hyperlink: `#'${names[i]!.replace(/'/g, "''")}'!A1` };
    c.font = { color: { argb: "FF2A4B7C" }, underline: true };
    cover.getCell(r, 3).value = t.rows.length;
    put(r, 4, t.description, { color: { argb: SLATE } });
    r++;
  });

  // Counts by group (usually university) for each grouped table.
  for (const t of tables) {
    const groups = t.groupBy ? groupRows(t) : [];
    if (groups.length < 2) continue;
    const groupLabel = t.columns.find((c) => c.key === t.groupBy)?.label ?? "Group";
    r += 1;
    put(r++, 2, `${t.title}: by ${groupLabel.toLowerCase()}`, { bold: true, size: 12, color: { argb: NAVY } });
    head(r++, [groupLabel, "Rows"]);
    for (const g of groups) {
      put(r, 2, g.name);
      cover.getCell(r, 3).value = g.rows.length;
      r++;
    }
    put(r, 2, "Total", { bold: true });
    cover.getCell(r, 3).value = t.rows.length;
    cover.getCell(r, 3).font = { bold: true };
    r++;
  }

  // One sheet per table ---------------------------------------------------
  tables.forEach((t, i) => {
    const ws = wb.addWorksheet(names[i]!, {
      properties: { tabColor: { argb: NAVY } },
      views: [{ state: "frozen", ySplit: HEADER_ROW, showGridLines: false }],
      pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } },
      headerFooter: { oddFooter: `&L${meta.title}&CPage &P of &N&RINSPIRE · confidential` },
    });
    ws.pageSetup.printTitlesRow = `${HEADER_ROW}:${HEADER_ROW}`;
    const cols = t.columns;
    ws.columns = cols.map((c) => ({ key: c.key, width: c.width ?? Math.min(40, Math.max(12, c.label.length + 4)) }));

    const title = ws.getCell(1, 1);
    title.value = t.title;
    title.font = { name: "Calibri", size: 16, bold: true, color: { argb: NAVY } };
    const desc = ws.getCell(2, 1);
    desc.value = t.description;
    desc.font = { italic: true, color: { argb: SLATE } };
    const info = ws.getCell(3, 1);
    info.value = [`${t.rows.length} ${t.rows.length === 1 ? "row" : "rows"}`, meta.filter, `downloaded ${ukDateTime(meta.generatedAt.toISOString())}`].filter(Boolean).join(" · ");
    info.font = { size: 10, color: { argb: SLATE } };

    const header = ws.getRow(HEADER_ROW);
    cols.forEach((c, j) => {
      const cell = header.getCell(j + 1);
      cell.value = c.label;
      cell.font = { name: "Calibri", bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
      cell.alignment = { vertical: "middle", wrapText: true };
      cell.border = { bottom: { style: "medium", color: { argb: GOLD } } };
    });
    header.height = 24;

    // Rows in group order so each university (or coach, or room) sits together.
    const ordered = groupRows(t).flatMap((g) => g.rows);
    ordered.forEach((row, k) => {
      const xr = ws.getRow(HEADER_ROW + 1 + k);
      cols.forEach((c, j) => {
        const cell = xr.getCell(j + 1);
        cell.value = excelValue(row[c.key]);
        cell.alignment = { vertical: "top", wrapText: (c.width ?? 0) >= 40 };
        if (k % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PAPER } };
        cell.border = { bottom: { style: "hair", color: { argb: "FFDDD6C6" } } };
      });
    });
    if (cols.length) {
      ws.autoFilter = { from: { row: HEADER_ROW, column: 1 }, to: { row: HEADER_ROW + Math.max(ordered.length, 1), column: cols.length } };
    }
    if (!ordered.length) {
      const c = ws.getCell(HEADER_ROW + 1, 1);
      c.value = "Nothing to show yet.";
      c.font = { italic: true, color: { argb: SLATE } };
    }
  });

  wb.views = [{ x: 0, y: 0, width: 20000, height: 12000, firstSheet: 0, activeTab: tables.length ? 1 : 0, visibility: "visible" }];
  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
}
