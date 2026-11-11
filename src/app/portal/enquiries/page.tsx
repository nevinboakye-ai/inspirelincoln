import type { Metadata } from "next";
import { Clock, MessagesSquare, PenSquare } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { Notice } from "@/components/ui/notice";
import { NewEnquiry } from "@/components/enquiries/new-enquiry";
import { ThreadList } from "@/components/enquiries/thread-list";
import { previews } from "@/lib/enquiries-server";
import { REPLY_PROMISE, THREAD_COLUMNS, isTopic, type EnquiryThread } from "@/lib/enquiries";

export const metadata: Metadata = { title: "Enquiries" };
export const dynamic = "force-dynamic";

export default async function EnquiriesPage({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  const { topic } = await searchParams;
  const { db, user } = await requireUser("/portal/enquiries");
  const { data, error } = await db.from("enquiry_threads").select(THREAD_COLUMNS).eq("user_id", user.id).order("last_message_at", { ascending: false }).limit(100);
  const threads = (data ?? []) as EnquiryThread[];
  const last = await previews(db, threads);
  const rows = threads.map((t) => ({ ...t, preview: last.get(t.id)?.body ?? null, previewFromCommittee: Boolean(last.get(t.id)?.from_committee) }));

  return (
    <div className="space-y-5 sm:space-y-6">
      <header className="relative overflow-hidden rounded-xl bg-midnight p-6 text-paper sm:p-8">
        <img src="/brand/crest-white.png" alt="" aria-hidden className="pointer-events-none absolute -bottom-10 -right-6 h-48 w-auto opacity-[0.07]" />
        <div className="relative">
          <p className="eyebrow flex items-center gap-2 text-gold">
            <MessagesSquare aria-hidden className="size-4" /> Enquiries
          </p>
          <h1 className="mt-3 font-display text-3xl sm:text-4xl">Ask the committee</h1>
          <p className="mt-3 max-w-xl text-sm text-paper/75 sm:text-base">
            Questions, requests, technical help or anything else you need. Write to the committee here and the conversation stays in My Hub. Only you and the committee can see it.
          </p>
          <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-paper ring-1 ring-white/15">
            <Clock aria-hidden className="size-4 text-gold" /> {REPLY_PROMISE}
          </p>
        </div>
      </header>

      {error ? (
        <Notice tone="warning">Enquiries aren&apos;t available just now. Please try again later.</Notice>
      ) : (
        <>
          {rows.length > 0 && (
            <section aria-labelledby="yours" className="space-y-3">
              <div className="flex items-end justify-between gap-3">
                <h2 id="yours" className="font-display text-xl text-ink">
                  Your enquiries
                </h2>
                <a href="#new" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-electric-600 hover:underline">
                  <PenSquare aria-hidden className="size-4" /> New enquiry
                </a>
              </div>
              <ThreadList threads={rows} viewer="member" hrefBase="/portal/enquiries" />
            </section>
          )}
          <section id="new" aria-labelledby="new-title" className="scroll-mt-28 rounded-xl border border-navy/10 bg-white p-5 sm:p-8">
            <h2 id="new-title" className="font-display text-xl text-ink">
              {rows.length ? "Start a new enquiry" : "Send your first enquiry"}
            </h2>
            <p className="mb-6 mt-2 text-sm text-slate-700">
              {REPLY_PROMISE} You&apos;ll see the reply here, with a note on My Hub. Please don&apos;t include health details unless the committee needs them to help you.
            </p>
            <NewEnquiry initialTopic={isTopic(topic) ? topic : undefined} />
          </section>
        </>
      )}
    </div>
  );
}
