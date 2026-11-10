import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { currentEditionId, toCsv } from "@/lib/admin/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const current = await getCurrentUser();
  if (!current || current.profile.role !== "admin") return new NextResponse("Not authorised", { status: 403 });
  const { db } = current;
  const ed = await currentEditionId(db);
  const { data: regs } = await db.from("registrations").select("user_id, status, source, external_reference, checked_in_at, created_at").eq("edition_id", ed ?? "");
  const ids = (regs ?? []).map((r) => r.user_id);
  const { data: profiles } = ids.length ? await db.from("profiles").select("id, full_name, email, institution, programme, year_of_study").in("id", ids) : { data: [] };
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  const rows = (regs ?? []).map((r) => ({ ...byId.get(r.user_id), ...r }));
  const cols = ["full_name", "email", "institution", "programme", "year_of_study", "status", "source", "external_reference", "checked_in_at", "created_at"];
  return new NextResponse("﻿" + toCsv(rows, cols), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="inspire-registrations-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" },
  });
}
