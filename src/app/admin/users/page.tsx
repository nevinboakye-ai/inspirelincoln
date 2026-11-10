import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { AdminHeader, Table, btn } from "@/components/admin/ui";
import { RoleSelect } from "@/components/admin/people-forms";
import { redirect } from "next/navigation";
import { ACCOUNT_TYPE_LABEL } from "@/lib/accounts";
import type { AccountType } from "@/lib/types";

export const metadata: Metadata = { title: "Site roles" };
export const dynamic = "force-dynamic";

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; role?: string }> }) {
  const sp = await searchParams;
  const { db, user, profile } = await requireRole(["admin"], "/admin/users");
  if (!profile.access.owner) redirect("/admin");
  let q = db.from("profiles").select("id, full_name, email, institution, role, account_type, created_at").order("created_at", { ascending: false }).limit(1000);
  if (sp.role) q = q.eq("role", sp.role);
  const { data } = await q;
  const term = sp.q?.toLowerCase().trim();
  const rows = (data ?? []).filter((p) => !term || [p.full_name, p.email, p.institution].some((v) => v?.toLowerCase().includes(term)));
  return (
    <div className="space-y-6">
      <AdminHeader title="Site roles" description="Most access comes from someone's approved account type (committee members can edit the website, executive members can review accounts). Use these roles only for people outside the committee who need access, such as an abstract reviewer. Site owners have full control, above the president, and only a site owner can change these roles. Give the least access needed." />
      <form className="flex flex-wrap gap-2" role="search">
        <label htmlFor="q" className="sr-only">Search</label>
        <input id="q" name="q" defaultValue={sp.q} placeholder="Search name, email, institution…" className="min-h-11 min-w-56 flex-1 rounded-[3px] border border-navy/15 bg-white px-4 text-sm" />
        <label htmlFor="role" className="sr-only">Role</label>
        <select id="role" name="role" defaultValue={sp.role ?? ""} className="min-h-11 rounded-[3px] border border-navy/15 bg-white px-4 text-sm">
          <option value="">All roles</option><option value="delegate">Delegates</option><option value="reviewer">Reviewers</option><option value="editor">Editors</option><option value="admin">Site owners</option>
        </select>
        <button className={btn.secondary}>Filter</button>
      </form>
      <Table head={["Name", "Account type", "Site role", "Joined"]} empty={rows.length ? null : <p className="p-6 text-sm text-slate-700">No users match.</p>}>
        {rows.map((p) => (
          <tr key={p.id}>
            <td className="px-4 py-3"><span className="font-medium text-ink">{p.full_name || "Not set"}{p.id === user.id && " (you)"}</span><span className="block text-xs text-slate">{p.email}</span></td>
            <td className="px-4 py-3 text-slate-700">{ACCOUNT_TYPE_LABEL[p.account_type as AccountType]}</td>
            <td className="px-4 py-3">{p.id === user.id ? <span className="text-sm">{p.role === "admin" ? "Site owner" : p.role}</span> : <RoleSelect id={p.id} role={p.role} />}</td>
            <td className="px-4 py-3 text-slate-700">{new Date(p.created_at).toLocaleDateString("en-GB", { timeZone: "Europe/London" })}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
