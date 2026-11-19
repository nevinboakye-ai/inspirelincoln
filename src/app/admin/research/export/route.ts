import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { buildCodebook, buildLong, buildWide, toAnalysisCsv, type ExportRow } from "@/lib/research/export";
import { settingsFromRow } from "@/lib/research/schedule";

export const dynamic = "force-dynamic";

/**
 * The de-identified research dataset as CSV: "wide" (one row per
 * participant), "long" (one row per participant per questionnaire, for
 * mixed models) or the "codebook". Rows carry the random study code only.
 * Every data export is written to the audit log by the database.
 */
export async function GET(req: NextRequest) {
  const current = await getCurrentUser();
  if (!current || !(current.profile.access.owner || current.profile.access.can.research_data)) return new NextResponse("Not authorised", { status: 403 });
  const file = req.nextUrl.searchParams.get("file") ?? "wide";
  if (!["wide", "long", "codebook"].includes(file)) return new NextResponse("Unknown file", { status: 400 });
  const date = new Date().toISOString().slice(0, 10);

  let table: { columns: string[]; rows: Record<string, unknown>[] };
  if (file === "codebook") table = buildCodebook();
  else {
    const { db } = current;
    const [{ data: st }, { data, error }] = await Promise.all([db.from("research_study").select("*").eq("id", 1).maybeSingle(), db.rpc("research_export")]);
    if (error) return new NextResponse("The research data couldn't be exported.", { status: error.code === "42501" ? 403 : 500 });
    const rows = (data ?? []) as ExportRow[];
    const eventDate = settingsFromRow(st).eventDate;
    table = file === "wide" ? buildWide(rows, eventDate) : buildLong(rows, eventDate);
  }
  return new NextResponse("﻿" + toAnalysisCsv(table), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="inspire-research-${file}-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
