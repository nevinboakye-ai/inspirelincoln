import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { currentEditionId } from "@/lib/admin/server";
import { AdminHeader, Table, btn } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { ABSTRACT_STATUS_LABEL } from "@/lib/validation/abstract";

export const metadata: Metadata = { title: "Abstracts" };
export const dynamic = "force-dynamic";

type Row = { id: string; reference: string; title: string; category: string; presenting_author: string; university: string; status: string; submitted_at: string | null; review_assignments: { id: string; reviews: { status: string; scores: Record<string, number> } | { status: string; scores: Record<string, number> }[] | null }[] };

export default async function AbstractsAdmin({ searchParams }: { searchParams: Promise<{ status?: string; category?: string; q?: string }> }) {
  const sp = await searchParams;
  const { db } = await requireRole(["admin"], "/admin/abstracts");
  const ed = await currentEditionId(db);
  let q = db
    .from("abstracts")
    .select("id, reference, title, category, presenting_author, university, status, submitted_at, review_assignments(id, reviews(status, scores))")
    .eq("edition_id", ed ?? "")
    .neq("status", "draft")
    .order("submitted_at", { ascending: false });
  if (sp.status) q = q.eq("status", sp.status);
  if (sp.category) q = q.eq("category", sp.category);
  const [{ data }, { data: edition }, { data: criteria }] = await Promise.all([
    q,
    db.from("editions").select("abstract_config").eq("id", ed ?? "").maybeSingle(),
    db.from("review_criteria").select("id, max_score, weight").eq("edition_id", ed ?? ""),
  ]);
  const term = sp.q?.toLowerCase().trim();
  const rows = ((data ?? []) as unknown as Row[]).filter((r) => !term || [r.title, r.reference, r.presenting_author, r.university].some((v) => v.toLowerCase().includes(term)));
  const categories = ((edition?.abstract_config as { categories?: string[] })?.categories ?? []) as string[];
  const totalW = (criteria ?? []).reduce((n, c) => n + Number(c.weight), 0);
  const scoreOf = (scores: Record<string, number>) =>
    totalW ? ((criteria ?? []).reduce((n, c) => n + ((scores[c.id] ?? 0) / c.max_score) * Number(c.weight), 0) / totalW) * 100 : 0;
  const summary = (r: Row) => {
    const reviews = r.review_assignments.map((a) => (Array.isArray(a.reviews) ? a.reviews[0] : a.reviews)).filter((x) => x?.status === "submitted") as { scores: Record<string, number> }[];
    const avg = reviews.length ? reviews.reduce((n, x) => n + scoreOf(x.scores), 0) / reviews.length : null;
    return { assigned: r.review_assignments.length, done: reviews.length, avg };
  };
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <div>
      <AdminHeader
        title="Abstracts"
        description="Submitted abstracts for the current edition. Drafts are private to their authors and not listed."
        actions={<a href={`/admin/abstracts/export${qs ? `?${qs}` : ""}`} className={btn.secondary}><Download aria-hidden className="size-4" /> Export CSV</a>}
      />
      <form className="mb-4 flex flex-wrap gap-2" role="search">
        <label className="sr-only" htmlFor="q">Search</label>
        <input id="q" name="q" defaultValue={sp.q} placeholder="Search title, reference, author…" className="min-h-11 min-w-56 flex-1 rounded-full border border-navy/15 bg-white px-4 text-sm" />
        <label className="sr-only" htmlFor="status">Status</label>
        <select id="status" name="status" defaultValue={sp.status ?? ""} className="min-h-11 rounded-full border border-navy/15 bg-white px-4 text-sm">
          <option value="">All statuses</option>
          {Object.entries(ABSTRACT_STATUS_LABEL).filter(([k]) => k !== "draft").map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <label className="sr-only" htmlFor="category">Category</label>
        <select id="category" name="category" defaultValue={sp.category ?? ""} className="min-h-11 rounded-full border border-navy/15 bg-white px-4 text-sm">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <button className={btn.secondary}>Filter</button>
      </form>
      <p className="mb-3 text-sm text-slate">{rows.length} abstract{rows.length === 1 ? "" : "s"}</p>
      <Table head={["Abstract", "Author", "Status", "Reviews", "Mean score"]} empty={rows.length === 0 ? <p className="p-6 text-sm text-slate-700">No submitted abstracts match.</p> : null}>
        {rows.map((r) => {
          const s = summary(r);
          const st = ABSTRACT_STATUS_LABEL[r.status];
          return (
            <tr key={r.id} className="hover:bg-paper">
              <td className="max-w-md px-4 py-3">
                <Link href={`/admin/abstracts/${r.id}`} className="font-medium text-ink hover:underline">{r.title}</Link>
                <span className="block text-xs text-slate">{r.reference} · {r.category}</span>
              </td>
              <td className="px-4 py-3 text-slate-700">{r.presenting_author}<span className="block text-xs text-slate">{r.university}</span></td>
              <td className="px-4 py-3"><Badge tone={st.tone}>{st.label}</Badge></td>
              <td className="px-4 py-3 text-slate-700">{s.done} / {s.assigned}</td>
              <td className="px-4 py-3 font-semibold text-ink">{s.avg === null ? <span className="font-normal text-slate">Not set</span> : s.avg.toFixed(0)}</td>
            </tr>
          );
        })}
      </Table>
    </div>
  );
}
