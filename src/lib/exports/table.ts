import { UK_TZ } from "@/lib/time";

/** One column in a download. */
export type Column = {
  key: string;
  label: string;
  /** Width in Excel characters. Word shares the page out in the same proportions. */
  width?: number;
  /** Contact details: left out when "leave out email addresses" is ticked. */
  personal?: boolean;
  /** Left out of the Word version, where space is tight (long free text, ids). */
  wordHidden?: boolean;
};

export type Cell = string | number | null | undefined;
export type Row = Record<string, Cell>;

/** A ready-to-write table: what goes on one Excel sheet or one Word section. */
export type ExportTable = {
  title: string;
  description: string;
  columns: Column[];
  rows: Row[];
  /** Rows are grouped under this column's value (Word headings, Excel summary). */
  groupBy?: string;
  /** In Word, start each group on a new page (registers to print and hand out). */
  pageBreakBetweenGroups?: boolean;
  /** In Word, add an empty column on the right for ticks or signatures. */
  signColumn?: string;
};

export type ExportMeta = {
  /** Shown as the document title, e.g. "Delegate list". */
  title: string;
  /** e.g. "University of Leeds only" */
  filter?: string | null;
  generatedBy: string;
  generatedAt: Date;
};

export const cellText = (v: Cell) => (v == null ? "" : String(v));

/** "14 Nov 2026, 18:05" in UK time, or "" */
export function ukDateTime(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", { timeZone: UK_TZ, day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
}

/** "18:05" in UK time, or "" */
export function ukTime(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", { timeZone: UK_TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
}

/** Drops contact columns when asked to. */
export function withoutContact(t: ExportTable): ExportTable {
  return { ...t, columns: t.columns.filter((c) => !c.personal) };
}

/** The table's rows in group order (groups A to Z, "Not given" last), with each group's rows. */
export function groupRows(t: ExportTable): { name: string; rows: Row[] }[] {
  if (!t.groupBy) return [{ name: "", rows: t.rows }];
  const groups = new Map<string, Row[]>();
  for (const r of t.rows) {
    const g = cellText(r[t.groupBy]) || "Not given";
    groups.set(g, [...(groups.get(g) ?? []), r]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === "Not given" ? 1 : b === "Not given" ? -1 : a.localeCompare(b, "en-GB", { numeric: true })))
    .map(([name, rows]) => ({ name, rows }));
}

/** A filename-safe slug: "University of Leeds" -> "university-of-leeds". */
export const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

export const PERSONAL_DATA_NOTE =
  "Contains personal data. Share only with the people who need it for INSPIRE, keep it secure and delete it after the conference.";
