import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { AdminHeader, Panel } from "@/components/admin/ui";
import { CurrentEditionForm, SettingsForm } from "@/components/admin/settings-form";
import { Notice } from "@/components/ui/notice";

export const metadata: Metadata = { title: "Conference settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { db, profile } = await requireRole(["editor"], "/admin/settings");
  const [{ data: row }, { data: editions }] = await Promise.all([
    db.from("editions").select("*").eq("is_current", true).maybeSingle(),
    db.from("editions").select("id, name, is_current").order("year", { ascending: false }),
  ]);
  return (
    <div className="max-w-4xl space-y-6">
      <AdminHeader title="Conference settings" description="Everything that changes how this year's conference appears on the site. Changes go live straight away." />
      {profile.role === "admin" && (editions?.length ?? 0) > 1 && (
        <Panel title="Edition">
          <CurrentEditionForm editions={editions ?? []} current={row?.id ?? ""} />
        </Panel>
      )}
      {row ? <SettingsForm row={row} /> : <Notice tone="warning">No current edition found. Apply the database migration and seed, or create an edition under Editions &amp; archive.</Notice>}
    </div>
  );
}
