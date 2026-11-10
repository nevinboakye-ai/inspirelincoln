import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getEdition } from "@/lib/data/content";
import { AbstractForm } from "@/components/portal/abstract-form";
import { WithdrawForm } from "@/components/portal/presenter-forms";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/notice";
import { ABSTRACT_SECTIONS, ABSTRACT_STATUS_LABEL } from "@/lib/validation/abstract";

export const metadata: Metadata = { title: "My abstract" };
export const dynamic = "force-dynamic";

export default async function AbstractPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ submitted?: string; saved?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const { db, user } = await requireUser(`/portal/abstracts/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: a } = await db.from("abstracts").select("*").eq("id", id).eq("submitter_id", user.id).maybeSingle();
  if (!a) notFound();
  const edition = await getEdition();
  const status = ABSTRACT_STATUS_LABEL[a.status];
  const decided = ["accepted", "rejected", "waitlisted"].includes(a.status);

  return (
    <div className="space-y-6">
      <Link href="/portal" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-slate-700 hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" /> Back to dashboard
      </Link>
      {sp.submitted && <p role="status" className="rounded-md border border-success/25 bg-success/[0.06] p-4 text-sm font-medium text-success">Thank you. Your abstract has been submitted. Your reference is {a.reference}.</p>}
      {sp.saved && <p role="status" className="rounded-md border border-success/25 bg-success/[0.06] p-4 text-sm font-medium text-success">Draft saved. You can come back to it at any time.</p>}

      <div className="rounded-xl border border-navy/10 bg-white p-6 sm:p-10">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-slate">{a.reference}</span>
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
        <h1 className="mt-3 font-display text-3xl font-semibold text-ink">{a.title}</h1>

        {decided && (
          <div className="mt-6">
            <Notice title="Decision" tone={a.status === "rejected" ? "warning" : "info"}>
              {a.status === "accepted" && <>Congratulations, your abstract has been accepted{a.presentation_type ? ` as a ${a.presentation_type.toLowerCase()}` : ""}. Visit the <Link href="/portal/presenter" className="underline">presenter portal</Link> for next steps.</>}
              {a.status === "waitlisted" && "Your abstract has been placed on the waiting list. We'll be in touch if a place becomes available."}
              {a.status === "rejected" && "Thank you for submitting. On this occasion your abstract was not selected for presentation."}
              {a.decision_note && <span className="mt-2 block">{a.decision_note}</span>}
            </Notice>
          </div>
        )}

        {a.status === "draft" ? (
          <div className="mt-10">
            <AbstractForm
              config={edition.abstractConfig}
              initial={{
                id: a.id,
                presentingAuthor: a.presenting_author, email: a.email, university: a.university, programmeYear: a.programme_year,
                title: a.title, coAuthors: a.co_authors, category: a.category, presentationPreference: a.presentation_preference ?? "",
                background: a.background, aim: a.aim, methods: a.methods, results: a.results, conclusion: a.conclusion,
                consentData: a.consent_data, declarationOriginal: a.declaration_original, consentShowcase: a.consent_showcase,
                hasFile: Boolean(a.file_path),
              }}
            />
          </div>
        ) : (
          <div className="mt-8 space-y-8">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              {[
                ["Presenting author", a.presenting_author],
                ["University", a.university],
                ["Programme and year", a.programme_year],
                ["Category", a.category],
                ["Co-authors", a.co_authors || "None listed"],
                ["Submitted", a.submitted_at ? new Date(a.submitted_at).toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "medium", timeStyle: "short" }) : "Not submitted"],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="font-semibold text-ink">{k}</dt>
                  <dd className="mt-1 whitespace-pre-line text-slate-700">{v}</dd>
                </div>
              ))}
            </dl>
            {ABSTRACT_SECTIONS.map((k) => (
              <section key={k}>
                <h2 className="font-display text-lg font-semibold capitalize text-ink">{k}</h2>
                <p className="mt-2 whitespace-pre-line leading-relaxed text-slate-700">{a[k] || "—"}</p>
              </section>
            ))}
          </div>
        )}

        {["submitted", "under_review"].includes(a.status) && (
          <div className="mt-10 border-t border-navy/10 pt-6">
            <WithdrawForm id={a.id} />
          </div>
        )}
      </div>
    </div>
  );
}
