import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { toCsv } from "@/lib/admin/server";
import { loadAttendance } from "@/lib/admin/attendance";

export const dynamic = "force-dynamic";

const ANSWER = { confirmed: "Confirmed", unavailable: "Can't make it", none: "No reply yet" } as const;
const TYPE = { oral_presenter: "Oral", poster_presenter: "Poster" } as const;

export async function GET() {
  const current = await getCurrentUser();
  if (!current || !current.profile.access.can.review_accounts) return new NextResponse("Not authorised", { status: 403 });
  const { presenters } = await loadAttendance(current.db);
  const rows = presenters.map((p) => ({
    name: p.name,
    email: p.email,
    university: p.institution ?? "",
    type: TYPE[p.type],
    title: p.title ?? "",
    answer: ANSWER[p.answer],
    note: p.note ?? "",
    answered_at: p.respondedAt ?? "",
    logged_in: p.source === "account" ? "Yes" : "Not yet",
  }));
  const cols = ["name", "email", "university", "type", "title", "answer", "note", "answered_at", "logged_in"];
  return new NextResponse("﻿" + toCsv(rows, cols), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="inspire-presenter-attendance-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
