import Link from "next/link";
import { ArrowRight, ClipboardCheck } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function ReviewHome() {
  const { db, user } = await requireRole(["reviewer"], "/review");
  const { data: rows } = await db
    .from("review_assignments")
    .select("id, created_at, abstracts(reference, title, category, status), reviews(status, updated_at)")
    .eq("reviewer_id", user.id)
    .order("created_at", { ascending: true });
  type Row = { id: string; abstracts: { reference: string; title: string; category: string; status: string } | null; reviews: { status: string } | { status: string }[] | null };
  const list = ((rows ?? []) as unknown as Row[]).filter((r) => r.abstracts && r.abstracts.status !== "withdrawn");
  const reviewStatus = (r: Row) => (Array.isArray(r.reviews) ? r.reviews[0]?.status : r.reviews?.status) ?? "not_started";
  const done = list.filter((r) => reviewStatus(r) === "submitted").length;

  return (
    <div className="space-y-6">
      <header className="rounded-xl bg-navy p-8 text-paper">
        <p className="eyebrow text-cyan">Reviewer dashboard</p>
        <h1 className="mt-3 font-display text-3xl font-semibold">Your assigned abstracts</h1>
        <p className="mt-3 text-paper/70">Abstracts are shown without author names or institutions to support fair, blind review.</p>
        {list.length > 0 && (
          <div className="mt-6 max-w-md">
            <div className="flex justify-between text-sm text-paper/70"><span>Progress</span><span>{done} of {list.length} submitted</span></div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={list.length} aria-valuenow={done} aria-label="Reviews submitted">
              <div className="h-full rounded-full bg-cyan" style={{ width: `${(done / list.length) * 100}%` }} />
            </div>
          </div>
        )}
      </header>
      {list.length === 0 ? (
        <div className="rounded-xl border border-navy/10 bg-white p-8 text-slate-700">
          <ClipboardCheck aria-hidden className="mb-3 size-6 text-electric-600" />
          No abstracts have been assigned to you yet. The conference team will let you know when reviews are ready.
        </div>
      ) : (
        <ul className="divide-y divide-navy/10 overflow-hidden rounded-xl border border-navy/10 bg-white">
          {list.map((r) => {
            const st = reviewStatus(r);
            return (
              <li key={r.id}>
                <Link href={`/review/${r.id}`} className="flex flex-wrap items-center justify-between gap-4 p-5 hover:bg-paper sm:px-7">
                  <span className="min-w-0">
                    <span className="block text-xs text-slate">{r.abstracts!.reference} · {r.abstracts!.category}</span>
                    <span className="mt-1 block font-medium text-ink">{r.abstracts!.title}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <Badge tone={st === "submitted" ? "success" : st === "draft" ? "warning" : "neutral"}>{st === "submitted" ? "Submitted" : st === "draft" ? "Draft saved" : "Not started"}</Badge>
                    <ArrowRight aria-hidden className="size-4 text-slate" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
