import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { csvCell } from "@/lib/admin/server";
import { DATASETS, canDownload, datasetByKey, type Dataset } from "@/lib/exports/datasets";
import { buildDocument } from "@/lib/exports/docx";
import { buildWorkbook } from "@/lib/exports/xlsx";
import { cellText, slug, withoutContact, type ExportTable } from "@/lib/exports/table";
import { universityName, uniKey } from "@/lib/university-logos";
import { serviceClient } from "@/lib/view-as";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FORMATS = {
  xlsx: { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ext: "xlsx" },
  docx: { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ext: "docx" },
  csv: { type: "text/csv; charset=utf-8", ext: "csv" },
} as const;
type Format = keyof typeof FORMATS;

let logo: Promise<Buffer | null> | null = null;
const loadLogo = () => (logo ??= readFile(path.join(process.cwd(), "public/brand/conference-logo-navy.png")).catch(() => null));

/**
 * Downloads one data set (set=attendees) or, with set=pack, every set this
 * person can see that has a University column, as Excel, Word or CSV.
 * uni=<name> keeps one university; contact=hide leaves out email addresses.
 */
export async function GET(req: NextRequest) {
  const current = await getCurrentUser();
  if (!current) return new NextResponse("Please sign in", { status: 401 });
  const { access } = current.profile;
  if (!access.committee && !access.owner) return new NextResponse("Not authorised", { status: 403 });

  const sp = req.nextUrl.searchParams;
  const format = (sp.get("format") ?? "xlsx") as Format;
  if (!(format in FORMATS)) return new NextResponse("Unknown format", { status: 400 });
  const setKey = sp.get("set") ?? "";
  const pack = setKey === "pack";
  const university = sp.get("uni")?.trim() ? universityName(sp.get("uni")) : null;
  const hideContact = sp.get("contact") === "hide";

  let sets: Dataset[];
  if (pack) {
    sets = DATASETS.filter((d) => d.byUniversity && canDownload(d, access));
    if (!sets.length) return new NextResponse("Not authorised", { status: 403 });
    if (format === "csv") return new NextResponse("A CSV file holds one table. Choose Excel or Word for the pack.", { status: 400 });
  } else {
    const d = datasetByKey(setKey);
    if (!d) return new NextResponse("Unknown download", { status: 404 });
    if (!canDownload(d, access)) return new NextResponse("Not authorised", { status: 403 });
    sets = [d];
  }

  const ctx = { db: current.db, userId: current.user.id, cache: new Map<string, Promise<unknown>>() };
  let tables: ExportTable[];
  try {
    tables = await Promise.all(sets.map((d) => d.load(ctx)));
  } catch (e) {
    console.error("download failed", e);
    return new NextResponse("Couldn't gather that data. Please try again.", { status: 500 });
  }

  const want = university ? uniKey(university) : null;
  tables = tables.map((t, i) => {
    let out = t;
    if (want && sets[i]!.byUniversity) {
      out = { ...out, rows: out.rows.filter((r) => uniKey(cellText(r.university)) === want) };
      // Grouping by university says nothing when there's only one.
      if (out.groupBy === "university") out = { ...out, groupBy: undefined };
    }
    return hideContact ? withoutContact(out) : out;
  });
  // In a pack for one university, leave out sets with nobody from there.
  if (pack && want) tables = tables.filter((t) => t.rows.length);

  const title = pack ? (university ? `INSPIRE: ${university}` : "INSPIRE data pack") : tables[0]!.title;
  const meta = {
    title,
    filter: [university && `${university} only`, hideContact && "email addresses left out"].filter(Boolean).join(" · ") || null,
    generatedBy: current.profile.fullName || current.profile.email,
    generatedAt: new Date(),
  };

  let body: Buffer | string;
  if (format === "csv") {
    const t = tables[0]!;
    // Byte-order mark so Excel reads accents and curly quotes correctly.
    body = "\ufeff" + [t.columns.map((c) => csvCell(c.label)).join(","), ...t.rows.map((r) => t.columns.map((c) => csvCell(r[c.key])).join(","))].join("\r\n");
  } else {
    const image = await loadLogo();
    body = format === "xlsx" ? await buildWorkbook(tables, meta, image) : await buildDocument(tables, meta, image);
  }

  // Who downloaded what, for the audit log. Never blocks the download.
  try {
    await serviceClient()
      ?.from("audit_events")
      .insert({
        actor_id: current.user.id,
        action: "download",
        entity: "downloads",
        entity_id: pack ? "pack" : sets[0]!.key,
        details: { summary: [title, !pack && university, FORMATS[format].ext.toUpperCase(), hideContact && "no emails"].filter(Boolean).join(" · "), format, university, hideContact },
      });
  } catch {}

  const date = new Date().toISOString().slice(0, 10);
  const name = ["inspire", pack ? "pack" : slug(sets[0]!.title), university ? slug(university) : null, date].filter(Boolean).join("-");
  return new NextResponse(typeof body === "string" ? body : new Uint8Array(body), {
    headers: {
      "Content-Type": FORMATS[format].type,
      "Content-Disposition": `attachment; filename="${name}.${FORMATS[format].ext}"`,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
