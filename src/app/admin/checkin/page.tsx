import type { Metadata } from "next";
import { requireAccess } from "@/lib/auth";
import { AdminHeader } from "@/components/admin/ui";
import { CheckInDesk } from "@/components/admin/people-forms";

export const metadata: Metadata = { title: "Check-in" };
export const dynamic = "force-dynamic";

export default async function CheckInPage() {
  const { db } = await requireAccess(["check_in", "manage_people"], "/admin/checkin");
  const { data } = await db.rpc("checkin_counts");
  const row = (Array.isArray(data) ? data[0] : data) as { confirmed: number; checked_in: number } | undefined;
  const confirmed = Number(row?.confirmed ?? 0);
  const checked = Number(row?.checked_in ?? 0);
  return (
    <div>
      <AdminHeader title="Check-in desk" description={<>Scan delegates&apos; QR codes from their portal. Codes contain a reference only. <strong>{checked ?? 0}</strong> of <strong>{confirmed ?? 0}</strong> confirmed delegates checked in (refresh to update).</>} />
      <CheckInDesk />
    </div>
  );
}
