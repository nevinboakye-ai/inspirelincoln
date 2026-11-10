import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { currentEditionId } from "@/lib/admin/server";
import { AdminHeader } from "@/components/admin/ui";
import { CheckInDesk } from "@/components/admin/people-forms";

export const metadata: Metadata = { title: "Check-in" };
export const dynamic = "force-dynamic";

export default async function CheckInPage() {
  const { db } = await requireRole(["admin"], "/admin/checkin");
  const ed = await currentEditionId(db);
  const [{ count: confirmed }, { count: checked }] = await Promise.all([
    db.from("registrations").select("*", { count: "exact", head: true }).eq("edition_id", ed ?? "").eq("status", "confirmed"),
    db.from("registrations").select("*", { count: "exact", head: true }).eq("edition_id", ed ?? "").not("checked_in_at", "is", null),
  ]);
  return (
    <div>
      <AdminHeader title="Check-in desk" description={<>Scan delegates&apos; QR codes from their portal. Codes contain a reference only. <strong>{checked ?? 0}</strong> of <strong>{confirmed ?? 0}</strong> confirmed delegates checked in (refresh to update).</>} />
      <CheckInDesk />
    </div>
  );
}
