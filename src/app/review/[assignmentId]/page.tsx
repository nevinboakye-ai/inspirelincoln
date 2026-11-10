import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { ReviewForm } from "@/components/review/review-form";
import { ABSTRACT_SECTIONS } from "@/lib/validation/abstract";

export const dynamic = "force-dynamic";

export default async function ReviewPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(assignmentId)) notFound();
  const { db, user } = await requireRole(["reviewer"], `/review/${assignmentId}`);
  const { data: asg } = await db
    .from("review_assignments")
    .select("id, abstract_id, reviewer_id, abstracts(id, edition_id, reference, title, category, presentation_preference, background, aim, methods, results, conclusion, status)")
    .eq("id", assignmentId)
    .eq("reviewer_id", user.id)
    .maybeSingle();
  const a = asg?.abstracts as unknown as Record<string, string> | null;
  if (!asg || !a) notFound();
  const [{ data: criteria }, { data: review }] = await Promise.all([
    db.from("review_criteria").select("id, label, description, max_score, weight").eq("edition_id", a.edition_id).order("sort"),
    db.from("reviews").select("*").eq("assignment_id", assignmentId).maybeSingle(),
  ]);

  return (
    <div className="space-y-6">
      <Link href="/review" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-slate-700 hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" /> All assigned abstracts
      </Link>
      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <article className="rounded-xl border border-navy/10 bg-white p-6 sm:p-10">
          <p className="text-sm text-slate">{a.reference} · {a.category}{a.presentation_preference ? ` · Prefers ${a.presentation_preference.toLowerCase()}` : ""}</p>
          <h1 className="mt-2 font-display text-2xl font-semibold text-ink sm:text-3xl">{a.title}</h1>
          <p className="mt-2 text-xs uppercase tracking-wide text-slate">Blind review: author details hidden</p>
          {a.status === "withdrawn" && <p className="mt-4 rounded-md bg-warning/10 p-3 text-sm text-slate-700">This abstract has been withdrawn by its author. No review is needed.</p>}
          <div className="mt-8 space-y-6">
            {ABSTRACT_SECTIONS.map((k) => (
              <section key={k}>
                <h2 className="font-display text-lg font-semibold capitalize text-ink">{k}</h2>
                <p className="mt-2 whitespace-pre-line leading-relaxed text-slate-700">{a[k] || "Not provided"}</p>
              </section>
            ))}
          </div>
        </article>
        <aside className="rounded-xl border border-navy/10 bg-white p-6 sm:p-8 xl:sticky xl:top-28 xl:self-start">
          <h2 className="mb-6 font-display text-xl font-semibold text-ink">Your review</h2>
          {(criteria ?? []).length === 0 ? (
            <p className="text-sm text-slate-700">Review criteria haven&apos;t been set up yet. Please check back later.</p>
          ) : (
            <ReviewForm
              assignmentId={assignmentId}
              criteria={(criteria ?? []).map((c) => ({ id: c.id, label: c.label, description: c.description, maxScore: c.max_score, weight: Number(c.weight) }))}
              initial={{
                scores: (review?.scores as Record<string, number>) ?? {},
                comments: review?.comments ?? "",
                confidentialComments: review?.confidential_comments ?? "",
                recommendation: review?.recommendation ?? "",
              }}
              locked={review?.status === "submitted" || a.status === "withdrawn"}
            />
          )}
        </aside>
      </div>
    </div>
  );
}
