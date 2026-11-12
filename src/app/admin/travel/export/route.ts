import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { toCsv } from "@/lib/admin/server";
import { loadTravel } from "@/lib/admin/travel";
import { TRAVEL_LABEL } from "@/lib/travel";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const current = await getCurrentUser();
  const can = current?.profile.access;
  if (!current || !can || !(can.owner || can.can.review_accounts || can.can.manage_people)) return new NextResponse("Not authorised", { status: 403 });
  const { rows } = await loadTravel(current.db);
  const carsOnly = new URL(req.url).searchParams.get("mode") === "car";
  const out = rows
    .filter((r) => !carsOnly || r.mode === "car")
    .map((r) => ({
      name: r.name,
      email: r.email,
      university: r.institution ?? "",
      travelling_by: r.mode ? TRAVEL_LABEL[r.mode].label : "No answer yet",
      car_registration: r.carRegistration ?? "",
      answered_at: r.updatedAt ?? "",
    }));
  const cols = ["name", "email", "university", "travelling_by", "car_registration", "answered_at"];
  return new NextResponse("﻿" + toCsv(out, cols), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="inspire-${carsOnly ? "car-registrations" : "travel"}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
