import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { AdminHeader, Table } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Audit log" };
export const dynamic = "force-dynamic";

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ entity?: string }> }) {
  const sp = await searchParams;
  const { db } = await requireRole(["admin"], "/admin/audit");
  let q = db.from("audit_events").select("*").order("created_at", { ascending: false }).limit(300);
  if (sp.entity) q = q.eq("entity", sp.entity);
  const { data } = await q;
  const actors = [...new Set((data ?? []).map((e) => e.actor_id).filter(Boolean))] as string[];
  const { data: profiles } = actors.length ? await db.from("profiles").select("id, full_name, email").in("id", actors) : { data: [] };
  const name = new Map((profiles ?? []).map((p) => [p.id, p.full_name || p.email]));
  return (
    <div>
      <AdminHeader title="Audit log" description="Every change to content, abstracts, reviews, registrations and roles. Records which fields changed, not the personal data itself. Latest 300 shown." />
      <Table head={["When", "Who", "Action", "Record", "Fields changed"]} empty={(data ?? []).length ? null : <p className="p-6 text-sm text-slate-700">No events yet.</p>}>
        {(data ?? []).map((e) => (
          <tr key={e.id}>
            <td className="whitespace-nowrap px-4 py-3 text-slate-700">{new Date(e.created_at).toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "short", timeStyle: "medium" })}</td>
            <td className="px-4 py-3 text-slate-700">{e.actor_id ? name.get(e.actor_id) ?? "Deleted user" : "System"}</td>
            <td className="px-4 py-3 capitalize text-ink">{e.action}</td>
            <td className="px-4 py-3 text-slate-700"><a className="underline" href={`?entity=${e.entity}`}>{e.entity}</a><span className="block font-mono text-[0.7rem] text-slate">{e.entity_id}</span></td>
            <td className="px-4 py-3 text-slate-700">{Object.keys((e.details as { changed?: object })?.changed ?? {}).join(", ") || "—"}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
