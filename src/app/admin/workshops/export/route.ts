import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { toCsv } from "@/lib/admin/server";
import { loadAllocationBoard } from "@/lib/workshops/admin";
import { pairLabel } from "@/lib/workshops/choices";

export const dynamic = "force-dynamic";

export async function GET() {
  const current = await getCurrentUser();
  if (!current || !current.profile.access.can.allocate_workshops) return new NextResponse("Not authorised", { status: 403 });
  const b = await loadAllocationBoard(current.db, current.user.id);
  const title = (id: string | undefined) => {
    const w = b.workshops.find((x) => x.id === id);
    return w ? `${pairLabel(w) ? `${pairLabel(w)}: ` : ""}${w.title}` : "";
  };
  const ids = [...new Set(b.allPlaces.map((p) => p.userId))];
  const rows = ids
    .map((id) => {
      const person = b.people.find((p) => p.id === id);
      const at = (slot: number) => b.allPlaces.find((p) => p.userId === id && p.slot === slot);
      return {
        name: person?.name ?? "",
        email: person?.email ?? "",
        university: person?.institution ?? "",
        session_1: title(at(1)?.workshopId),
        session_1_choice: at(1)?.choice ?? "",
        session_2: title(at(2)?.workshopId),
        session_2_choice: at(2)?.choice ?? "",
        session_3: title(at(3)?.workshopId),
        session_3_choice: at(3)?.choice ?? "",
        ranking: person?.ranking ? person.ranking.map((w) => title(w)).join(" > ") : "Didn't rank",
      };
    })
    .sort((a, c) => a.name.localeCompare(c.name));
  const cols = ["name", "email", "university", "session_1", "session_1_choice", "session_2", "session_2_choice", "session_3", "session_3_choice", "ranking"];
  return new NextResponse("﻿" + toCsv(rows, cols), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="inspire-workshop-places-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
