import { notFound } from "next/navigation";
import { FileDown } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { AdminHeader, Panel, Table } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { AssignReviewerForm, DecisionForm, ShowcaseForm, UnassignButton } from "@/components/admin/abstract-admin-forms";
import { ABSTRACT_SECTIONS, ABSTRACT_STATUS_LABEL } from "@/lib/validation/abstract";

export const dynamic = "force-dynamic";

type Review = { status: string; scores: Record<string, number>; comments: string; confidential_comments: string; recommendation: string | null; submitted_at: string | null };

export default async function AbstractAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db } = await requireRole(["admin"], `/admin/abstracts/${id}`);
  const { data: a } = await db.from("abstracts").select("*").eq("id", id).maybeSingle();
  if (!a) notFound();
  const [{ data: assignments }, { data: criteria }, { data: reviewers }, { data: edition }] = await Promise.all([
    db.from("review_assignments").select("id, reviewer_id, reviews(status, scores, comments, confidential_comments, recommendation, submitted_at)").eq("abstract_id", id),
    db.from("review_criteria").select("id, label, max_score, weight").eq("edition_id", a.edition_id).order("sort"),
    db.from("profiles").select("id, full_name, email, role").in("role", ["reviewer", "admin"]).order("full_name"),
    db.from("editions").select("abstract_config").eq("id", a.edition_id).maybeSingle(),
  ]);
  const names = new Map((reviewers ?? []).map((r) => [r.id, r.full_name || r.email]));
  const assigned = new Set((assignments ?? []).map((x) => x.reviewer_id));
  const eligibleReviewers = (reviewers ?? []).filter((r) => !assigned.has(r.id) && r.id !== a.submitter_id).map((r) => ({ id: r.id, label: `${r.full_name || r.email} (${r.role})` }));
  const totalW = (criteria ?? []).reduce((n, c) => n + Number(c.weight), 0);
  const weighted = (s: Record<string, number>) => (totalW ? ((criteria ?? []).reduce((n, c) => n + ((s[c.id] ?? 0) / c.max_score) * Number(c.weight), 0) / totalW) * 100 : 0);
  const rows = (assignments ?? []).map((x) => ({ id: x.id, reviewer: names.get(x.reviewer_id) ?? "Reviewer", review: (Array.isArray(x.reviews) ? x.reviews[0] : x.reviews) as Review | null }));
  const submitted = rows.filter((r) => r.review?.status === "submitted");
  const mean = submitted.length ? submitted.reduce((n, r) => n + weighted(r.review!.scores), 0) / submitted.length : null;
  const fileUrl = a.file_path ? (await db.storage.from("abstracts").createSignedUrl(a.file_path, 600, { download: true })).data?.signedUrl : null;
  const st = ABSTRACT_STATUS_LABEL[a.status];
  const types = ((edition?.abstract_config as { presentationTypes?: string[] })?.presentationTypes ?? []) as string[];

  return (
    <div className="space-y-6">
      <AdminHeader title={a.title} description={<><span className="mr-2">{a.reference}</span><Badge tone={st.tone}>{st.label}</Badge></>} back={{ href: "/admin/abstracts", label: "Abstracts" }} />
      <div className="grid gap-6 2xl:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          <Panel title="Submission">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              {[
                ["Presenting author", a.presenting_author], ["Email", a.email], ["University", a.university], ["Programme and year", a.programme_year],
                ["Co-authors", a.co_authors || "—"], ["Category", a.category], ["Preference", a.presentation_preference || "—"],
                ["Showcase consent", a.consent_showcase ? "Yes" : "No"],
                ["Submitted", a.submitted_at ? new Date(a.submitted_at).toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "medium", timeStyle: "short" }) : "—"],
              ].map(([k, v]) => (
                <div key={k}><dt className="font-semibold text-ink">{k}</dt><dd className="mt-0.5 whitespace-pre-line break-words text-slate-700">{v}</dd></div>
              ))}
            </dl>
            {fileUrl && <a href={fileUrl} className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-electric-600"><FileDown aria-hidden className="size-4" /> Download supporting file (link valid 10 minutes)</a>}
            <div className="mt-6 space-y-5 border-t border-navy/10 pt-6">
              {ABSTRACT_SECTIONS.map((k) => (
                <section key={k}><h3 className="font-semibold capitalize text-ink">{k}</h3><p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-700">{a[k] || "—"}</p></section>
              ))}
            </div>
          </Panel>
          <Panel title="Reviews" actions={mean !== null && <span className="text-sm text-slate-700">Mean weighted score <strong className="text-ink">{mean.toFixed(0)} / 100</strong> from {submitted.length}</span>}>
            {rows.length === 0 ? <p className="mb-4 text-sm text-slate-700">No reviewers assigned yet.</p> : (
              <Table head={["Reviewer", ...(criteria ?? []).map((c) => `${c.label} /${c.max_score}`), "Score", "Recommendation", ""]}>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 font-medium text-ink">{r.reviewer}<span className="block text-xs font-normal text-slate">{r.review ? (r.review.status === "submitted" ? "Submitted" : "Draft") : "Not started"}</span></td>
                    {(criteria ?? []).map((c) => <td key={c.id} className="px-4 py-3 text-slate-700">{r.review?.status === "submitted" ? r.review.scores[c.id] ?? "—" : "—"}</td>)}
                    <td className="px-4 py-3 font-semibold">{r.review?.status === "submitted" ? weighted(r.review.scores).toFixed(0) : "—"}</td>
                    <td className="px-4 py-3 capitalize text-slate-700">{r.review?.status === "submitted" ? r.review.recommendation ?? "—" : "—"}</td>
                    <td className="px-2 py-3"><UnassignButton abstractId={a.id} assignmentId={r.id} name={r.reviewer} /></td>
                  </tr>
                ))}
              </Table>
            )}
            {submitted.some((r) => r.review!.comments || r.review!.confidential_comments) && (
              <div className="mt-5 space-y-4">
                {submitted.map((r) => (r.review!.comments || r.review!.confidential_comments) && (
                  <div key={r.id} className="rounded-md bg-paper p-4 text-sm">
                    <p className="font-semibold text-ink">{r.reviewer}</p>
                    {r.review!.comments && <p className="mt-1 whitespace-pre-line text-slate-700"><span className="font-medium">For the author: </span>{r.review!.comments}</p>}
                    {r.review!.confidential_comments && <p className="mt-1 whitespace-pre-line text-slate-700"><span className="font-medium">Confidential: </span>{r.review!.confidential_comments}</p>}
                  </div>
                ))}
              </div>
            )}
            <div className="mt-6 border-t border-navy/10 pt-5">
              <AssignReviewerForm abstractId={a.id} reviewers={eligibleReviewers} />
            </div>
          </Panel>
        </div>
        <div className="space-y-6">
          {a.status === "withdrawn" ? (
            <Panel title="Decision"><p className="text-sm text-slate-700">The author withdrew this abstract.</p></Panel>
          ) : (
            <Panel title="Decision"><DecisionForm abstractId={a.id} status={a.status} note={a.decision_note ?? ""} type={a.presentation_type ?? ""} types={types} /></Panel>
          )}
          <Panel title="Research showcase">
            <ShowcaseForm abstractId={a.id} published={a.showcase_published} summary={a.showcase_summary ?? ""} eligible={a.consent_showcase && a.status === "accepted"} />
          </Panel>
        </div>
      </div>
    </div>
  );
}
