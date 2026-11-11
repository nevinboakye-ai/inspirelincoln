import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { requireAccess } from "@/lib/auth";
import { AdminHeader, btn } from "@/components/admin/ui";
import { DeleteEnquiry, EnquiryStatus } from "@/components/admin/people-forms";
import { ThreadList, type ThreadRow } from "@/components/enquiries/thread-list";
import { previews } from "@/lib/enquiries-server";
import { enquiryPeople } from "@/lib/enquiries-inbox";
import { THREAD_COLUMNS, type EnquiryThread } from "@/lib/enquiries";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Enquiries" };
export const dynamic = "force-dynamic";

const CATEGORY: Record<string, string> = { general: "General", speakers_workshops: "Speakers & workshops", research_abstracts: "Research & abstracts", partnerships: "Partnerships", accessibility: "Accessibility" };

const VIEWS = {
  waiting: { label: "Needs a reply", status: ["open"] },
  replied: { label: "Replied", status: ["answered"] },
  resolved: { label: "Resolved", status: ["closed"] },
  all: { label: "All", status: ["open", "answered", "closed"] },
} as const;
type View = keyof typeof VIEWS;

export default async function EnquiriesPage({ searchParams }: { searchParams: Promise<{ view?: string; q?: string }> }) {
  const sp = await searchParams;
  const { db, profile } = await requireAccess(["answer_enquiries", "manage_people"], "/admin/enquiries");
  const canAnswer = profile.access.owner || profile.access.can.answer_enquiries;
  const canRecords = profile.access.owner || profile.access.can.manage_people;
  const view: View = sp.view && sp.view in VIEWS ? (sp.view as View) : "waiting";
  const q = (sp.q ?? "").trim().toLowerCase().slice(0, 80);

  let rows: ThreadRow[] = [];
  const counts: Record<View, number> = { waiting: 0, replied: 0, resolved: 0, all: 0 };
  if (canAnswer) {
    const { data } = await db.from("enquiry_threads").select(THREAD_COLUMNS).order("last_message_at", { ascending: false }).limit(500);
    const all = (data ?? []) as EnquiryThread[];
    for (const t of all) {
      counts.all++;
      if (t.status === "open") counts.waiting++;
      else if (t.status === "answered") counts.replied++;
      else counts.resolved++;
    }
    const people = await enquiryPeople(db, all.map((t) => t.user_id));
    const shown = all
      .filter((t) => (VIEWS[view].status as readonly string[]).includes(t.status))
      .filter((t) => !q || t.subject.toLowerCase().includes(q) || (people.get(t.user_id)?.name ?? "").toLowerCase().includes(q));
    const last = await previews(db, shown);
    rows = shown.map((t) => {
      const p = people.get(t.user_id);
      return { ...t, preview: last.get(t.id)?.body ?? null, previewFromCommittee: Boolean(last.get(t.id)?.from_committee), memberName: p?.name ?? "Account holder", memberPhoto: p?.photo ?? null, memberMeta: p?.roles };
    });
    // Oldest waiting first, so nobody is left past 48 hours.
    if (view === "waiting") rows.reverse();
  }

  const { data: legacy } = canRecords ? await db.from("contact_enquiries").select("*").order("created_at", { ascending: false }).limit(300) : { data: null };

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Enquiries"
        description="Questions and requests delegates send from My Hub. Replies appear in their Enquiries page straight away. Please reply within 48 hours, as members are promised."
      />

      {canAnswer && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <nav aria-label="Filter enquiries" className="-mx-1 flex gap-1 overflow-x-auto px-1">
              {(Object.keys(VIEWS) as View[]).map((v) => (
                <Link
                  key={v}
                  href={`/admin/enquiries?view=${v}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                  aria-current={view === v ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors",
                    view === v ? "bg-navy text-paper" : "border border-navy/12 bg-white text-slate-700 hover:border-navy/35",
                  )}
                >
                  {VIEWS[v].label}
                  <span className={cn("rounded-full px-1.5 text-xs tabular-nums", view === v ? "bg-white/15" : v === "waiting" && counts.waiting ? "bg-warning/15 text-[#7a4a00]" : "bg-paper-200")}>{counts[v]}</span>
                </Link>
              ))}
            </nav>
            <form role="search" className="flex w-full gap-2 sm:w-auto">
              <input type="hidden" name="view" value={view} />
              <label htmlFor="q" className="sr-only">Search by name or subject</label>
              <div className="relative flex-1 sm:w-64">
                <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate" />
                <input id="q" name="q" defaultValue={sp.q ?? ""} placeholder="Name or subject" className="min-h-11 w-full rounded-[3px] border border-navy/15 bg-white pl-9 pr-3 text-sm" />
              </div>
              <button className={btn.secondary}>Search</button>
            </form>
          </div>

          {rows.length ? (
            <ThreadList threads={rows} viewer="committee" hrefBase="/admin/enquiries" />
          ) : (
            <p className="rounded-xl border border-dashed border-navy/15 bg-white px-6 py-10 text-center text-sm text-slate-700">
              {q ? "No enquiries match that search." : view === "waiting" ? "All caught up. Nobody is waiting for a reply." : "No enquiries here yet."}
            </p>
          )}
        </>
      )}

      {canRecords && (legacy?.length ?? 0) > 0 && (
        <details className="rounded-xl border border-navy/10 bg-white p-5 sm:p-6" open={!canAnswer}>
          <summary className="min-h-11 cursor-pointer py-2 font-semibold text-ink">Earlier contact form messages ({legacy!.length})</summary>
          <p className="mt-1 text-sm text-slate-700">Sent through the old contact form, which has been replaced by Enquiries. Delete them once resolved; the privacy notice says they are kept for no longer than 12 months.</p>
          <ul className="mt-4 space-y-4">
            {legacy!.map((e) => (
              <li key={e.id} className="rounded-lg border border-navy/10 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">{e.subject}</p>
                    <p className="text-sm text-slate-700">
                      {e.name} · <a className="underline" href={`mailto:${e.email}?subject=${encodeURIComponent(`Re: ${e.subject}`)}`}>{e.email}</a> · {CATEGORY[e.category] ?? e.category}
                    </p>
                    <p className="text-xs text-slate">{new Date(e.created_at).toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "medium", timeStyle: "short" })}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <EnquiryStatus id={e.id} status={e.status} />
                    <DeleteEnquiry id={e.id} />
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-700">{e.message}</p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
