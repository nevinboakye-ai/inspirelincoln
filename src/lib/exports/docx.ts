import "server-only";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  Packer,
  PageNumber,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TabStopType,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import { cellText, groupRows, ukDateTime, PERSONAL_DATA_NOTE, type Column, type ExportMeta, type ExportTable } from "./table";

const NAVY = "1A3154";
const GOLD = "D4AF5A";
const PAPER = "F6F3EC";
const SLATE = "55607A";
const RULE = "DDD6C6";
/** A4 landscape with 12.7 mm margins leaves about 15,370 twips across. */
const PAGE_WIDTH = 15300;

const text = (t: string, o: { bold?: boolean; italics?: boolean; color?: string; size?: number } = {}) => new TextRun({ text: t, font: "Calibri", ...o });

/** Shares the page width out in the same proportions as the Excel column widths. */
function widths(cols: Column[], sign?: string) {
  const weights = [...cols.map((c) => c.width ?? Math.min(40, Math.max(12, c.label.length + 4))), ...(sign ? [16] : [])];
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  return weights.map((w) => Math.floor((w / total) * PAGE_WIDTH));
}

function table(t: ExportTable, rows: ExportTable["rows"]) {
  const cols = t.columns.filter((c) => !c.wordHidden);
  const w = widths(cols, t.signColumn);
  const size = cols.length > 8 ? 15 : cols.length > 5 ? 17 : 19;
  const border = { style: BorderStyle.SINGLE, size: 2, color: RULE };
  const borders = { top: border, bottom: border, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } };
  const cell = (value: string, width: number, o: { head?: boolean; shade?: boolean } = {}) =>
    new TableCell({
      width: { size: width, type: WidthType.DXA },
      verticalAlign: VerticalAlign.CENTER,
      margins: { top: 60, bottom: 60, left: 90, right: 90 },
      borders: o.head ? { ...borders, bottom: { style: BorderStyle.SINGLE, size: 12, color: GOLD } } : borders,
      shading: o.head ? { type: ShadingType.CLEAR, color: "auto", fill: NAVY } : o.shade ? { type: ShadingType.CLEAR, color: "auto", fill: PAPER } : undefined,
      children: [new Paragraph({ children: [text(value, o.head ? { bold: true, color: "FFFFFF", size } : { size })] })],
    });
  const labels = [...cols.map((c) => c.label), ...(t.signColumn ? [t.signColumn] : [])];
  return new Table({
    width: { size: PAGE_WIDTH, type: WidthType.DXA },
    columnWidths: w,
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true, children: labels.map((l, i) => cell(l, w[i]!, { head: true })) }),
      ...(rows.length
        ? rows.map(
            (r, k) =>
              new TableRow({
                cantSplit: true,
                children: [...cols.map((c, i) => cell(cellText(r[c.key]), w[i]!, { shade: k % 2 === 1 })), ...(t.signColumn ? [cell("", w[cols.length]!, { shade: k % 2 === 1 })] : [])],
              }),
          )
        : [new TableRow({ children: [new TableCell({ columnSpan: labels.length, children: [new Paragraph({ children: [text("Nothing to show yet.", { italics: true, color: SLATE, size })] })] })] })]),
    ],
  });
}

/**
 * A Word document to print or send on: a branded header, then each table
 * under its own heading, split into groups (one university, one coach or
 * one workshop room at a time) with the column headings repeated on every
 * page.
 */
export async function buildDocument(tables: ExportTable[], meta: ExportMeta, logo?: Buffer | null): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [
    new Paragraph({ heading: HeadingLevel.TITLE, spacing: { after: 80 }, children: [text(meta.title, { bold: true, color: NAVY, size: 48 })] }),
    new Paragraph({
      spacing: { after: 60 },
      children: [text([meta.filter, `Downloaded ${ukDateTime(meta.generatedAt.toISOString())} by ${meta.generatedBy}`].filter(Boolean).join(" · "), { color: SLATE, size: 20 })],
    }),
    new Paragraph({
      spacing: { after: 240 },
      border: { left: { style: BorderStyle.SINGLE, size: 18, color: GOLD, space: 8 } },
      children: [text(PERSONAL_DATA_NOTE, { italics: true, color: "7A5C14", size: 18 })],
    }),
  ];

  tables.forEach((t, ti) => {
    const groups = groupRows(t);
    const grouped = Boolean(t.groupBy) && groups.length > 0;
    children.push(
      new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: ti > 0, spacing: { before: 120, after: 60 }, keepNext: true, children: [text(t.title, { bold: true, color: NAVY, size: 32 })] }),
      new Paragraph({ spacing: { after: 60 }, keepNext: true, children: [text(t.description, { color: SLATE, size: 19 })] }),
      new Paragraph({ spacing: { after: 160 }, keepNext: true, children: [text(`${t.rows.length} ${t.rows.length === 1 ? "row" : "rows"}${grouped && groups.length > 1 ? ` in ${groups.length} groups` : ""}`, { bold: true, size: 19 })] }),
    );
    if (!grouped) {
      children.push(table(t, t.rows));
      return;
    }
    groups.forEach((g, gi) => {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          keepNext: true,
          pageBreakBefore: Boolean(t.pageBreakBetweenGroups) && gi > 0,
          spacing: { before: gi === 0 ? 0 : 280, after: 100 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: GOLD, space: 2 } },
          children: [text(g.name, { bold: true, color: NAVY, size: 24 }), text(`   ${g.rows.length}`, { color: SLATE, size: 20 })],
        }),
        table(t, g.rows),
      );
    });
  });

  const headerRuns = [
    ...(logo ? [new ImageRun({ type: "png", data: logo, transformation: { width: 125, height: 48 } })] : [text("INSPIRE", { bold: true, color: NAVY })]),
    new TextRun({ children: ["\t", meta.title], font: "Calibri", size: 16, color: SLATE }),
  ];

  const doc = new Document({
    creator: `INSPIRE committee (${meta.generatedBy})`,
    title: meta.title,
    description: PERSONAL_DATA_NOTE,
    styles: { default: { document: { run: { font: "Calibri", size: 20, color: "0F1B2E" } } } },
    sections: [
      {
        properties: { page: { size: { orientation: PageOrientation.LANDSCAPE }, margin: { top: 1000, bottom: 900, left: 720, right: 720, header: 400, footer: 400 } } },
        headers: { default: new Header({ children: [new Paragraph({ tabStops: [{ type: TabStopType.RIGHT, position: PAGE_WIDTH }], children: headerRuns })] }) },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ children: ["INSPIRE · confidential · page ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES], font: "Calibri", size: 16, color: SLATE })],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });
  return Packer.toBuffer(doc);
}
