import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, CheckCircle2, FileText, Megaphone, Presentation } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getEdition } from "@/lib/data/content";
import { formatEventDate } from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/notice";
import { PosterUploadForm } from "@/components/portal/presenter-forms";
import { ABSTRACT_STATUS_LABEL, FILE_RULES } from "@/lib/validation/abstract";

export const metadata: Metadata = { title: "Presenter portal" };
export const dynamic = "force-dynamic";

const UPLOAD_STATUS: Record<string, { label: string; tone: "neutral" | "success" | "warning" }> = {
  received: { label: "Received", tone: "neutral" },
  approved: { label: "Approved", tone: "success" },
  needs_changes: { label: "Changes requested", tone: "warning" },
};

export default async function PresenterPage() {
  const { db, user } = await requireUser("/portal/presenter");
  const edition = await getEdition();
  const { data: abstracts } = await db
    .from("abstracts")
    .select("id, reference, title, status, decision_note, presentation_type, poster_uploads(id, orientation, status, admin_note, created_at)")
    .eq("submitter_id", user.id)
    .neq("status", "draft")
    .order("created_at", { ascending: false });
  const accepted = (abstracts ?? []).filter((a) => a.status === "accepted");
  const { data: announcements } = accepted.length
    ? await db.from("announcements").select("id, title, body").eq("published", true).eq("audience", "presenters").order("published_at", { ascending: false })
    : { data: [] };

  return (
    <div className="space-y-6">
      <header className="rounded-xl bg-navy p-8 text-paper">
        <p className="eyebrow text-cyan">Presenter portal</p>
        <h1 className="mt-3 font-display text-3xl font-semibold">Your presentations</h1>
        <p className="mt-3 max-w-2xl text-paper/70">Track your submissions, read decisions and upload your poster once your abstract is accepted.</p>
      </header>

      {!abstracts?.length && (
        <div className="rounded-xl border border-navy/10 bg-white p-6 sm:p-8">
          <p className="text-slate-700">You haven&apos;t submitted an abstract yet.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            {edition.abstractConfig.submissionsOpen && <Link href="/portal/abstracts/new" className="inline-flex min-h-11 items-center rounded-full bg-navy px-5 text-sm font-semibold text-paper">Submit an abstract</Link>}
            <Link href="/research" className="inline-flex min-h-11 items-center rounded-full border border-navy/15 px-5 text-sm font-semibold text-ink">About research at INSPIRE</Link>
          </div>
        </div>
      )}

      {accepted.length > 0 && (
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-navy/10 bg-white p-6 sm:p-7">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink"><CalendarClock aria-hidden className="size-5 text-electric-600" /> Key dates</h2>
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              {edition.posterDeadline && <li><strong className="text-ink">Poster upload deadline:</strong> {formatEventDate(edition.posterDeadline)}</li>}
              <li><strong className="text-ink">Conference:</strong> {formatEventDate(edition.date)}, {edition.venueName}</li>
            </ul>
          </div>
          <div className="rounded-xl border border-navy/10 bg-white p-6 sm:p-7">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink"><Presentation aria-hidden className="size-5 text-electric-600" /> Poster requirements</h2>
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              {edition.posterRequirements.map((r) => (
                <li key={r} className="flex gap-2"><CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-success" /> {r}</li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {(announcements?.length ?? 0) > 0 && (
        <section className="rounded-xl border border-navy/10 bg-white p-6 sm:p-7">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink"><Megaphone aria-hidden className="size-5 text-electric-600" /> Messages for presenters</h2>
          <ul className="mt-4 space-y-3">
            {announcements!.map((a) => (
              <li key={a.id} className="rounded-md bg-paper p-4"><p className="font-medium text-ink">{a.title}</p><p className="mt-1 text-sm text-slate-700">{a.body}</p></li>
            ))}
          </ul>
        </section>
      )}

      {(abstracts ?? []).map((a) => {
        const s = ABSTRACT_STATUS_LABEL[a.status];
        const uploads = [...(a.poster_uploads ?? [])].sort((x, y) => y.created_at.localeCompare(x.created_at));
        return (
          <article key={a.id} className="rounded-xl border border-navy/10 bg-white p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-slate">{a.reference}</span>
              <Badge tone={s.tone}>{s.label}</Badge>
              {a.presentation_type && <Badge tone="violet">{a.presentation_type}</Badge>}
            </div>
            <h2 className="mt-2 font-display text-xl font-semibold text-ink">
              <Link href={`/portal/abstracts/${a.id}`} className="hover:underline"><FileText aria-hidden className="mr-2 inline size-5 text-slate" />{a.title}</Link>
            </h2>
            {a.decision_note && <p className="mt-3 text-sm text-slate-700">{a.decision_note}</p>}
            {a.status === "accepted" && (
              <div className="mt-6 grid gap-8 border-t border-navy/10 pt-6 lg:grid-cols-2">
                <div>
                  <h3 className="font-semibold text-ink">Upload your poster</h3>
                  <p className="mb-4 mt-1 text-sm text-slate-700">Remember to bring a printed copy on the day as well.</p>
                  <PosterUploadForm abstractId={a.id} maxMb={FILE_RULES.poster.maxMb} />
                </div>
                <div>
                  <h3 className="font-semibold text-ink">Uploads</h3>
                  {uploads.length ? (
                    <ul className="mt-3 divide-y divide-navy/10 text-sm">
                      {uploads.map((u) => (
                        <li key={u.id} className="py-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-slate-700">{new Date(u.created_at).toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "medium", timeStyle: "short" })}{u.orientation ? ` · ${u.orientation}` : ""}</span>
                            <Badge tone={UPLOAD_STATUS[u.status]?.tone ?? "neutral"}>{UPLOAD_STATUS[u.status]?.label ?? u.status}</Badge>
                          </div>
                          {u.admin_note && <p className="mt-1 text-slate-700">{u.admin_note}</p>}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-slate-700">No poster uploaded yet.</p>
                  )}
                </div>
              </div>
            )}
          </article>
        );
      })}

      {abstracts?.length && !accepted.length ? <Notice>Poster upload opens here once an abstract is accepted.</Notice> : null}
    </div>
  );
}
