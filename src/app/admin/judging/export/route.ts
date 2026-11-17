import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { loadJudging, loadMarks } from "@/lib/judging-server";
import { JUDGING_KINDS, KIND_LABEL, MIN_JUDGES, judgesLabel, rankResults } from "@/lib/judging";
import { buildWorkbook } from "@/lib/exports/xlsx";
import { buildDocument } from "@/lib/exports/docx";
import { ukDateTime, type Column, type ExportTable, type Row } from "@/lib/exports/table";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FORMATS = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
} as const;

/**
 * Judging results as Excel (default) or Word: a ranking sheet per kind of
 * presentation, then every judge's mark with scores and comments. Only for
 * people with the Judging results permission.
 */
export async function GET(req: NextRequest) {
  const current = await getCurrentUser();
  if (!current || !(current.profile.access.can.manage_judging || current.profile.access.owner)) return new NextResponse("Not authorised", { status: 403 });
  const format = req.nextUrl.searchParams.get("format") === "docx" ? "docx" : "xlsx";
  const j = await loadJudging(current.db, current.profile.id);
  const marks = await loadMarks(current.db, j.settings.editionId);
  const entry = new Map(j.entries.map((e) => [`${e.presenterId}:${e.kind}`, e]));

  const tables: ExportTable[] = [];
  for (const k of JUDGING_KINDS) {
    const crit = j.criteria.filter((c) => c.kind === k);
    const results = rankResults(j.entries, marks, j.criteria, k);
    if (!results.length) continue;
    const columns: Column[] = [
      { key: "rank", label: "Rank", width: 7 },
      { key: "presenter", label: "Presenter", width: 24 },
      { key: "university", label: "University", width: 24 },
      { key: "title", label: "Title", width: 44, wordHidden: true },
      { key: "where", label: "Where", width: 14 },
      { key: "average", label: "Average %", width: 11 },
      { key: "marks", label: "Judges", width: 12 },
      { key: "complete", label: "Marking complete", width: 10 },
      { key: "spread", label: "Spread (points)", width: 10, wordHidden: true },
      ...crit.map((c) => ({ key: `c_${c.id}`, label: `${c.label} (avg /${c.maxScore})`, width: 14, wordHidden: true })),
    ];
    const rows: Row[] = results.map((r) => {
      const e = entry.get(`${r.presenterId}:${k}`);
      const row: Row = {
        rank: r.rank ?? "",
        presenter: e?.name ?? "",
        university: e?.institution ?? "",
        title: e?.title ?? "",
        where: e?.label ?? "",
        average: r.average === null ? "" : Math.round(r.average * 10) / 10,
        marks: judgesLabel(r.submitted),
        complete: r.complete ? "Yes" : "No",
        spread: r.spread === null ? "" : Math.round(r.spread * 10) / 10,
      };
      for (const c of crit) row[`c_${c.id}`] = r.perCriterion[c.id] === undefined ? "" : Math.round(r.perCriterion[c.id] * 100) / 100;
      return row;
    });
    tables.push({
      title: `${KIND_LABEL[k].many}: ranking`,
      description: `Ranked by each presenter's average submitted mark across judges, as a percentage. Only presenters with complete marking (at least ${MIN_JUDGES} judges) are ranked; the rest follow, unranked, with a provisional average. Drafts aren't counted. A large spread means judges disagreed.`,
      columns,
      rows,
    });
  }

  const allCrit = j.criteria;
  tables.push({
    title: "Every mark",
    description: "Each judge's mark with every score and comment. Notes for the committee are never shown to presenters.",
    groupBy: "type",
    columns: [
      { key: "type", label: "Type", width: 14 },
      { key: "presenter", label: "Presenter", width: 22 },
      { key: "university", label: "University", width: 22, wordHidden: true },
      { key: "judge", label: "Judge", width: 20 },
      { key: "status", label: "Status", width: 10 },
      { key: "total", label: "Total", width: 8 },
      { key: "out_of", label: "Out of", width: 8 },
      ...allCrit.map((c) => ({ key: `c_${c.id}`, label: `${KIND_LABEL[c.kind].short}: ${c.label} (/${c.maxScore})`, width: 12, wordHidden: true })),
      { key: "strengths", label: "What went well", width: 44 },
      { key: "improvements", label: "What to improve", width: 44 },
      { key: "note", label: "Note for the committee", width: 34 },
      { key: "submitted", label: "Submitted", width: 18, wordHidden: true },
    ],
    rows: marks
      .slice()
      .sort((a, b) => (entry.get(`${a.presenterId}:${a.kind}`)?.name ?? "").localeCompare(entry.get(`${b.presenterId}:${b.kind}`)?.name ?? ""))
      .map((m) => {
        const e = entry.get(`${m.presenterId}:${m.kind}`);
        const row: Row = {
          type: KIND_LABEL[m.kind].many,
          presenter: e?.name ?? "",
          university: e?.institution ?? "",
          judge: m.judgeName,
          status: m.status === "submitted" ? "Submitted" : "Draft",
          total: m.total,
          out_of: m.maxTotal,
          strengths: m.strengths,
          improvements: m.improvements,
          note: m.committeeNote,
          submitted: ukDateTime(m.submittedAt),
        };
        for (const c of allCrit) row[`c_${c.id}`] = c.kind === m.kind ? (m.scores[c.id] ?? "") : "";
        return row;
      }),
  });

  const meta = { title: "Judging results", generatedBy: current.profile.fullName || current.profile.email, generatedAt: new Date() };
  const logo = await readFile(path.join(process.cwd(), "public/brand/conference-logo-navy.png")).catch(() => null);
  const body = format === "xlsx" ? await buildWorkbook(tables, meta, logo) : await buildDocument(tables, meta, logo);
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": FORMATS[format],
      "Content-Disposition": `attachment; filename="inspire-judging-results-${new Date().toISOString().slice(0, 10)}.${format}"`,
      "Cache-Control": "no-store",
    },
  });
}
