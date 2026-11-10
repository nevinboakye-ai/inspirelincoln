import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { currentEditionId, toCsv } from "@/lib/admin/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const current = await getCurrentUser();
  if (!current || !current.profile.access.can.manage_people) return new NextResponse("Not authorised", { status: 403 });
  const { db } = current;
  const ed = await currentEditionId(db);
  const sp = req.nextUrl.searchParams;
  let q = db.from("abstracts").select("*, review_assignments(reviews(status, scores, recommendation))").eq("edition_id", ed ?? "").neq("status", "draft").order("reference");
  if (sp.get("status")) q = q.eq("status", sp.get("status")!);
  if (sp.get("category")) q = q.eq("category", sp.get("category")!);
  const { data } = await q;
  const rows = (data ?? []).map((a) => {
    const reviews = ((a.review_assignments ?? []) as { reviews: { status: string; recommendation: string | null } | { status: string; recommendation: string | null }[] | null }[])
      .map((x) => (Array.isArray(x.reviews) ? x.reviews[0] : x.reviews))
      .filter((r) => r?.status === "submitted");
    return { ...a, reviews_submitted: reviews.length, recommendations: reviews.map((r) => r!.recommendation).join("; ") };
  });
  const cols = ["reference", "status", "title", "presenting_author", "email", "university", "programme_year", "co_authors", "category", "presentation_preference", "background", "aim", "methods", "results", "conclusion", "consent_showcase", "presentation_type", "decision_note", "submitted_at", "reviews_submitted", "recommendations"];
  return new NextResponse("﻿" + toCsv(rows, cols), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="inspire-abstracts-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" },
  });
}
