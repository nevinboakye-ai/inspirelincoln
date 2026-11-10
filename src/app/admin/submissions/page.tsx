import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { AdminHeader } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { SUBMISSION_LABEL, SUBMISSION_STATUS_LABEL } from "@/lib/accounts";
import type { SubmissionKind, SubmissionStatus } from "@/lib/types";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Slides and posters" };
export const dynamic = "force-dynamic";

const when = (d: string) => new Date(d).toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "medium", timeStyle: "short" });

export default async function SubmissionsPage({ searchParams }: { searchParams: Promise<{ kind?: string; status?: string }> }) {
  const sp = await searchParams;
  const { db } = await requireRole(["editor"], "/admin/submissions");
  const kind = sp.kind === "slides" || sp.kind === "poster" ? (sp.kind as SubmissionKind) : null;
  const status = (["submitted", "changes_requested", "approved"] as const).find((s) => s === sp.status) ?? null;

  const { data } = await db
    .from("presentation_submissions")
    .select("id, user_id, presenter_name, kind, version, title, status, created_at, submission_feedback(count)")
    .order("created_at", { ascending: false })
    .limit(1000);
  // Show only each presenter's latest version; earlier ones are on the detail page.
  const latest = new Map<string, NonNullable<typeof data>[number]>();
  for (const s of data ?? []) {
    const key = `${s.user_id}:${s.kind}`;
    if (!latest.has(key)) latest.set(key, s);
  }
  const all = [...latest.values()];
  const rows = all.filter((s) => (!kind || s.kind === kind) && (!status || s.status === status));
  const waiting = all.filter((s) => s.status === "submitted").length;

  const chip = (label: string, href: string, active: boolean) => (
    <Link href={href} aria-current={active ? "page" : undefined} className={cn("flex min-h-11 shrink-0 items-center rounded-[3px] px-4 text-sm font-semibold", active ? "bg-navy text-paper" : "border border-navy/15 bg-white text-ink")}>
      {label}
    </Link>
  );
  const q = (k: string | null, s: string | null) => `/admin/submissions?${new URLSearchParams({ ...(k ? { kind: k } : {}), ...(s ? { status: s } : {}) })}`;

  return (
    <div className="space-y-6">
      <AdminHeader title="Slides and posters" description={`Review what presenters have uploaded and send them feedback. ${waiting} waiting for a first look.`} />
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
        {chip("Everything", q(null, status), !kind)}
        {chip("Slides", q("slides", status), kind === "slides")}
        {chip("Posters", q("poster", status), kind === "poster")}
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
        {chip("Any status", q(kind, null), !status)}
        {(["submitted", "changes_requested", "approved"] as const).map((s) => chip(SUBMISSION_STATUS_LABEL[s].label, q(kind, s), status === s))}
      </div>
      {!rows.length && <p className="rounded-xl border border-dashed border-navy/20 bg-white p-8 text-center text-slate-700">Nothing to review here yet.</p>}
      <ul className="divide-y divide-navy/10 overflow-hidden rounded-xl border border-navy/10 bg-white">
        {rows.map((s) => {
          const st = SUBMISSION_STATUS_LABEL[s.status as SubmissionStatus];
          const fb = (s.submission_feedback as unknown as { count: number }[])?.[0]?.count ?? 0;
          return (
            <li key={s.id}>
              <Link href={`/admin/submissions/${s.id}`} className="flex items-center gap-4 p-5 hover:bg-paper">
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <Badge tone="violet">{SUBMISSION_LABEL[s.kind as SubmissionKind].title}</Badge>
                    <Badge tone={st.tone}>{st.label}</Badge>
                    {s.version > 1 && <span className="text-xs text-slate">Version {s.version}</span>}
                  </span>
                  <span className="mt-2 block font-medium text-ink">{s.title}</span>
                  <span className="block text-sm text-slate-700">{s.presenter_name || "Presenter"} · {when(s.created_at)} · {fb} {fb === 1 ? "comment" : "comments"}</span>
                </span>
                <ArrowRight aria-hidden className="size-4 shrink-0 text-slate" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
