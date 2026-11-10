import type { Metadata } from "next";
import { Download } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { currentEditionId } from "@/lib/admin/server";
import { AdminHeader, Panel, Table, btn } from "@/components/admin/ui";
import { AddRegistrationForm, RegistrationStatus } from "@/components/admin/people-forms";

export const metadata: Metadata = { title: "Registrations" };
export const dynamic = "force-dynamic";

export default async function Registrations({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const sp = await searchParams;
  const { db } = await requireRole(["admin"], "/admin/registrations");
  const ed = await currentEditionId(db);
  let q = db.from("registrations").select("id, user_id, status, source, external_reference, checked_in_at, created_at").eq("edition_id", ed ?? "").order("created_at", { ascending: false });
  if (sp.status) q = q.eq("status", sp.status);
  const { data: regs } = await q;
  const ids = (regs ?? []).map((r) => r.user_id);
  const { data: profiles } = ids.length ? await db.from("profiles").select("id, full_name, email, institution").in("id", ids) : { data: [] };
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  const term = sp.q?.toLowerCase().trim();
  const rows = (regs ?? []).map((r) => ({ ...r, p: byId.get(r.user_id) })).filter((r) => !term || [r.p?.full_name, r.p?.email, r.external_reference].some((v) => v?.toLowerCase().includes(term)));
  const checked = rows.filter((r) => r.checked_in_at).length;

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Registrations"
        description="Registration records link a delegate's account to this year's conference. Confirmed delegates get a check-in QR code in their portal."
        actions={<a href="/admin/registrations/export" className={btn.secondary}><Download aria-hidden className="size-4" /> Export CSV</a>}
      />
      <Panel title="Add a registration"><AddRegistrationForm /></Panel>
      <form className="flex flex-wrap gap-2" role="search">
        <label htmlFor="q" className="sr-only">Search</label>
        <input id="q" name="q" defaultValue={sp.q} placeholder="Search name, email, reference…" className="min-h-11 min-w-56 flex-1 rounded-full border border-navy/15 bg-white px-4 text-sm" />
        <label htmlFor="status" className="sr-only">Status</label>
        <select id="status" name="status" defaultValue={sp.status ?? ""} className="min-h-11 rounded-full border border-navy/15 bg-white px-4 text-sm">
          <option value="">All statuses</option><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="waitlisted">Waitlisted</option><option value="cancelled">Cancelled</option>
        </select>
        <button className={btn.secondary}>Filter</button>
      </form>
      <p className="text-sm text-slate">{rows.length} registration{rows.length === 1 ? "" : "s"} · {checked} checked in</p>
      <Table head={["Delegate", "Status", "Reference", "Checked in", "Added"]} empty={rows.length ? null : <p className="p-6 text-sm text-slate-700">No registrations yet.</p>}>
        {rows.map((r) => (
          <tr key={r.id}>
            <td className="px-4 py-3"><span className="font-medium text-ink">{r.p?.full_name || "—"}</span><span className="block text-xs text-slate">{r.p?.email}{r.p?.institution ? ` · ${r.p.institution}` : ""}</span></td>
            <td className="px-4 py-3"><RegistrationStatus id={r.id} status={r.status} /></td>
            <td className="px-4 py-3 text-slate-700">{r.external_reference || "—"}</td>
            <td className="px-4 py-3 text-slate-700">{r.checked_in_at ? new Date(r.checked_in_at).toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" }) : "—"}</td>
            <td className="px-4 py-3 text-slate-700">{new Date(r.created_at).toLocaleDateString("en-GB", { timeZone: "Europe/London" })}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
