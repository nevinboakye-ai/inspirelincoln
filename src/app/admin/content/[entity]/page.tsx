import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { getEntity } from "@/lib/admin/entities";
import { currentEditionId, requireEntityAccess } from "@/lib/admin/server";
import { AdminHeader, Flash, Table, btn } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

function cell(v: unknown, col: string) {
  if (typeof v === "boolean") return v ? <Badge tone={col === "published" || col === "verified" ? "success" : "electric"}>Yes</Badge> : <span className="text-slate">No</span>;
  if (v == null || v === "") return <span className="text-slate">Not set</span>;
  if (col.endsWith("_at") && typeof v === "string") return new Date(v).toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "medium", timeStyle: "short" });
  return String(v);
}

export default async function EntityList({ params, searchParams }: { params: Promise<{ entity: string }>; searchParams: Promise<{ deleted?: string; q?: string }> }) {
  const [{ entity: key }, sp] = await Promise.all([params, searchParams]);
  const entity = getEntity(key);
  if (!entity) notFound();
  const { db } = await requireEntityAccess(entity);
  let q = db.from(entity.table).select("*");
  if (entity.editionScoped) {
    const ed = await currentEditionId(db);
    if (ed) q = q.eq("edition_id", ed);
  }
  for (const o of entity.orderBy) q = q.order(o.column, { ascending: o.ascending ?? true, nullsFirst: false });
  const { data, error } = await q.limit(500);
  const term = sp.q?.toLowerCase().trim();
  const rows = (data ?? []).filter((r) => !term || String(r[entity.titleField] ?? "").toLowerCase().includes(term));
  const label = (c: string) => entity.fields.find((f) => f.name === c)?.label.replace(/\s*\(.*\)$/, "") ?? c.replace(/_/g, " ");

  return (
    <div>
      <AdminHeader
        title={entity.label}
        description={entity.description}
        actions={<Link href={`/admin/content/${entity.key}/new`} className={btn.primary}><Plus aria-hidden className="size-4" /> Add {entity.singular}</Link>}
      />
      {sp.deleted && <Flash>Deleted.</Flash>}
      {error && <p role="alert" className="mb-4 text-sm text-danger">Could not load records. Check that the database migration has been applied.</p>}
      <form role="search" className="mb-4 flex max-w-md gap-2">
        <label htmlFor="q" className="sr-only">Search {entity.label}</label>
        <input id="q" name="q" defaultValue={sp.q} placeholder={`Search ${entity.label.toLowerCase()}…`} className="min-h-11 flex-1 rounded-full border border-navy/15 bg-white px-4 text-sm" />
        <button className={btn.secondary}>Search</button>
      </form>
      <Table
        head={[label(entity.titleField), ...entity.listColumns.map(label)]}
        empty={rows.length === 0 ? <p className="p-6 text-sm text-slate-700">Nothing here yet.</p> : null}
      >
        {rows.map((r) => (
          <tr key={r.id} className="hover:bg-paper">
            <td className="px-4 py-3 font-medium">
              <Link href={`/admin/content/${entity.key}/${r.id}`} className="text-ink underline-offset-4 hover:underline">{String(r[entity.titleField] || "(untitled)")}</Link>
            </td>
            {entity.listColumns.map((c) => <td key={c} className="px-4 py-3 text-slate-700">{cell(r[c], c)}</td>)}
          </tr>
        ))}
      </Table>
    </div>
  );
}
