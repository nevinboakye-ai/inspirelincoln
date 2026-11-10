import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { AdminHeader, Table, btn } from "@/components/admin/ui";
import { RoleSelect } from "@/components/admin/people-forms";

export const metadata: Metadata = { title: "Users and roles" };
export const dynamic = "force-dynamic";

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; role?: string }> }) {
  const sp = await searchParams;
  const { db, user } = await requireRole(["admin"], "/admin/users");
  let q = db.from("profiles").select("id, full_name, email, institution, role, created_at").order("created_at", { ascending: false }).limit(1000);
  if (sp.role) q = q.eq("role", sp.role);
  const { data } = await q;
  const term = sp.q?.toLowerCase().trim();
  const rows = (data ?? []).filter((p) => !term || [p.full_name, p.email, p.institution].some((v) => v?.toLowerCase().includes(term)));
  return (
    <div className="space-y-6">
      <AdminHeader title="Users and roles" description="Delegate: portal only. Reviewer: plus assigned abstract reviews. Editor: plus public content. Admin: everything, including personal data. Give the least access needed." />
      <form className="flex flex-wrap gap-2" role="search">
        <label htmlFor="q" className="sr-only">Search</label>
        <input id="q" name="q" defaultValue={sp.q} placeholder="Search name, email, institution…" className="min-h-11 min-w-56 flex-1 rounded-[3px] border border-navy/15 bg-white px-4 text-sm" />
        <label htmlFor="role" className="sr-only">Role</label>
        <select id="role" name="role" defaultValue={sp.role ?? ""} className="min-h-11 rounded-[3px] border border-navy/15 bg-white px-4 text-sm">
          <option value="">All roles</option><option value="delegate">Delegates</option><option value="reviewer">Reviewers</option><option value="editor">Editors</option><option value="admin">Admins</option>
        </select>
        <button className={btn.secondary}>Filter</button>
      </form>
      <Table head={["Name", "Institution", "Role", "Joined"]} empty={rows.length ? null : <p className="p-6 text-sm text-slate-700">No users match.</p>}>
        {rows.map((p) => (
          <tr key={p.id}>
            <td className="px-4 py-3"><span className="font-medium text-ink">{p.full_name || "Not set"}{p.id === user.id && " (you)"}</span><span className="block text-xs text-slate">{p.email}</span></td>
            <td className="px-4 py-3 text-slate-700">{p.institution || "Not set"}</td>
            <td className="px-4 py-3">{p.id === user.id ? <span className="text-sm capitalize">{p.role}</span> : <RoleSelect id={p.id} role={p.role} />}</td>
            <td className="px-4 py-3 text-slate-700">{new Date(p.created_at).toLocaleDateString("en-GB", { timeZone: "Europe/London" })}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
