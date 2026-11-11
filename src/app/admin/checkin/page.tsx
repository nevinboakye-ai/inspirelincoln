import type { Metadata } from "next";
import { requireAccess } from "@/lib/auth";
import { AdminHeader } from "@/components/admin/ui";
import { CheckInDesk } from "@/components/admin/checkin-desk";
import type { Recent } from "./actions";

export const metadata: Metadata = { title: "Check-in" };
export const dynamic = "force-dynamic";

/** Committee members with the check-in permission confirm attendance on the day. */
export default async function CheckInPage() {
  const { db } = await requireAccess(["check_in", "manage_people"], "/admin/checkin");
  const [{ data }, { data: recent }] = await Promise.all([db.rpc("checkin_counts"), db.rpc("recent_check_ins")]);
  const row = (Array.isArray(data) ? data[0] : data) as { confirmed: number; checked_in: number } | undefined;
  return (
    <div>
      <AdminHeader
        title="Check-in desk"
        description="Scan the QR code on the back of each Delegate Card to confirm they're here. The same code delegates use to connect with each other. Codes hold a private link, never personal details."
      />
      <CheckInDesk initial={{ expected: Number(row?.confirmed ?? 0), checkedIn: Number(row?.checked_in ?? 0), recent: (recent ?? []) as Recent[] }} />
    </div>
  );
}
