import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { toCsv } from "@/lib/admin/server";
import { HIGHLIGHTS, IMPROVEMENTS, PARTS, groupOf, labelOf, type FeedbackRow } from "@/lib/post-conference/feedback";

export const dynamic = "force-dynamic";

/** Every feedback answer as a spreadsheet, one row each, without names or account ids. */
export async function GET() {
  const current = await getCurrentUser();
  const can = current?.profile.access;
  if (!current || !can || !(can.owner || can.can.view_feedback)) return new NextResponse("Not authorised", { status: 403 });
  const { data, error } = await current.db.rpc("conference_feedback_summary");
  if (error || !data) return new NextResponse("Feedback isn't set up yet", { status: 404 });
  const rows = ((data as { rows?: FeedbackRow[] }).rows ?? []).map((r) => ({
    group: groupOf(r.roles ?? []),
    overall_1_to_5: r.overall,
    recommend_0_to_10: r.recommend,
    ...Object.fromEntries(PARTS.map((p) => [`part_${p.id}`, r.parts?.[p.id] ?? ""])),
    stood_out: (r.highlights ?? []).map((h) => labelOf(HIGHLIGHTS, h)).join("; "),
    stood_out_comment: r.highlight_note ?? "",
    to_change: (r.improvements ?? []).map((h) => labelOf(IMPROVEMENTS, h)).join("; "),
    to_change_comment: r.improve_note ?? "",
    anything_else: r.comments ?? "",
    can_quote_without_name: r.quote_ok ? "yes" : "no",
    answered_on: r.day,
  }));
  const cols = [
    "group",
    "overall_1_to_5",
    "recommend_0_to_10",
    ...PARTS.map((p) => `part_${p.id}`),
    "stood_out",
    "stood_out_comment",
    "to_change",
    "to_change_comment",
    "anything_else",
    "can_quote_without_name",
    "answered_on",
  ];
  return new NextResponse("﻿" + toCsv(rows, cols), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="inspire-feedback-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
