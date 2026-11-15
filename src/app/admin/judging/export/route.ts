import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { toCsv } from "@/lib/admin/server";
import { loadJudging, loadMarks } from "@/lib/judging-server";
import { JUDGING_KINDS, KIND_LABEL, rankResults } from "@/lib/judging";

export const dynamic = "force-dynamic";

/**
 * Judging results as a spreadsheet (CSV, which Excel and Google Sheets open).
 * ?type=ranking gives one row per presenter with their rank and averages;
 * otherwise one row per judge's mark, with every score and comment.
 */
export async function GET(req: NextRequest) {
  const current = await getCurrentUser();
  if (!current || !(current.profile.access.can.manage_judging || current.profile.access.owner)) return new NextResponse("Not authorised", { status: 403 });
  const j = await loadJudging(current.db, current.profile.id);
  const marks = await loadMarks(current.db, j.settings.editionId);
  const entry = new Map(j.entries.map((e) => [`${e.presenterId}:${e.kind}`, e]));
  const ranking = req.nextUrl.searchParams.get("type") === "ranking";
  let rows: Record<string, string | number>[];
  let cols: string[];

  if (ranking) {
    cols = ["type", "rank", "presenter", "university", "title", "where", "average_percent", "marks_submitted", "spread_points"];
    const critCols = new Set<string>();
    rows = JUDGING_KINDS.flatMap((k) =>
      rankResults(j.entries, marks, j.criteria, k).map((r) => {
        const e = entry.get(`${r.presenterId}:${k}`);
        const row: Record<string, string | number> = {
          type: KIND_LABEL[k].one,
          rank: r.rank ?? "",
          presenter: e?.name ?? "",
          university: e?.institution ?? "",
          title: e?.title ?? "",
          where: e?.label ?? "",
          average_percent: r.average === null ? "" : r.average.toFixed(1),
          marks_submitted: r.submitted,
          spread_points: r.spread === null ? "" : r.spread.toFixed(1),
        };
        for (const c of j.criteria.filter((c) => c.kind === k)) {
          const col = `${KIND_LABEL[k].short}: ${c.label} (avg of ${c.maxScore})`;
          critCols.add(col);
          row[col] = r.perCriterion[c.id] === undefined ? "" : r.perCriterion[c.id].toFixed(2);
        }
        return row;
      }),
    );
    cols.push(...critCols);
  } else {
    cols = ["type", "presenter", "university", "title", "where", "judge", "status", "total", "out_of", "percent", "what_went_well", "what_to_improve", "note_for_committee", "submitted_at"];
    const critCols = new Set<string>();
    rows = marks
      .slice()
      .sort((a, b) => a.kind.localeCompare(b.kind) || (entry.get(`${a.presenterId}:${a.kind}`)?.name ?? "").localeCompare(entry.get(`${b.presenterId}:${b.kind}`)?.name ?? ""))
      .map((m) => {
        const e = entry.get(`${m.presenterId}:${m.kind}`);
        const row: Record<string, string | number> = {
          type: KIND_LABEL[m.kind].one,
          presenter: e?.name ?? "",
          university: e?.institution ?? "",
          title: e?.title ?? "",
          where: e?.label ?? "",
          judge: m.judgeName,
          status: m.status === "submitted" ? "Submitted" : "Draft",
          total: m.total,
          out_of: m.maxTotal,
          percent: m.maxTotal ? ((m.total / m.maxTotal) * 100).toFixed(1) : "",
          what_went_well: m.strengths,
          what_to_improve: m.improvements,
          note_for_committee: m.committeeNote,
          submitted_at: m.submittedAt ?? "",
        };
        for (const c of j.criteria.filter((c) => c.kind === m.kind)) {
          const col = `${KIND_LABEL[m.kind].short}: ${c.label} (/${c.maxScore})`;
          critCols.add(col);
          row[col] = m.scores[c.id] ?? "";
        }
        return row;
      });
    cols.splice(9, 0, ...critCols);
  }

  const name = ranking ? "ranking" : "marks";
  return new NextResponse("﻿" + toCsv(rows, cols), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="inspire-judging-${name}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
