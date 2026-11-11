import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAccess } from "@/lib/auth";
import { Avatar } from "@/components/ui/avatar";
import { EnquiryChat } from "@/components/enquiries/enquiry-chat";
import { DeleteThread } from "@/components/enquiries/delete-thread";
import { enquiryPeople } from "@/lib/enquiries-inbox";
import { MESSAGE_COLUMNS, THREAD_COLUMNS, type EnquiryMessage, type EnquiryThread } from "@/lib/enquiries";

export const metadata: Metadata = { title: "Enquiry" };
export const dynamic = "force-dynamic";

export default async function CommitteeEnquiryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db, user, profile } = await requireAccess("answer_enquiries", `/admin/enquiries/${id}`);
  const [{ data: thread }, { data: messages }] = await Promise.all([
    db.from("enquiry_threads").select(THREAD_COLUMNS).eq("id", id).maybeSingle(),
    db.from("enquiry_messages").select(MESSAGE_COLUMNS).eq("thread_id", id).order("created_at").limit(500),
  ]);
  if (!thread) notFound();
  const t = thread as EnquiryThread;
  const person = (await enquiryPeople(db, [t.user_id])).get(t.user_id);
  const name = person?.name ?? "Account holder";
  const canAccounts = profile.access.owner || profile.access.can.review_accounts;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/admin/enquiries" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-slate-700 hover:text-ink">
          <ArrowLeft aria-hidden className="size-4" /> All enquiries
        </Link>
        <DeleteThread id={t.id} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_17rem]">
        <EnquiryChat
          thread={t}
          messages={(messages ?? []) as EnquiryMessage[]}
          viewer="committee"
          me={user.id}
          memberName={name}
          memberPhoto={person?.photo ?? null}
          header={
            <h1 id="chat-subject" className="line-clamp-2 break-words font-display text-xl leading-tight text-ink sm:text-2xl">
              {t.subject}
            </h1>
          }
        />
        <aside aria-label="About them" className="h-fit rounded-xl border border-navy/10 bg-white p-5">
          <div className="flex items-center gap-3">
            <Avatar url={person?.photo} name={name} className="size-12" fallbackClassName="bg-navy text-sm text-cyan" />
            <div className="min-w-0">
              <p className="truncate font-semibold text-ink">{name}</p>
              {person?.roles && <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gold-700">{person.roles}</p>}
            </div>
          </div>
          {person?.meta && <p className="mt-3 text-sm text-slate-700">{person.meta}</p>}
          <p className="mt-3 text-xs text-slate">
            Started {new Date(t.created_at).toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "medium", timeStyle: "short" })}
          </p>
          {canAccounts && person && (
            <Link href={`/admin/accounts?q=${encodeURIComponent(name)}`} className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-electric-600 hover:underline">
              Open their account
            </Link>
          )}
        </aside>
      </div>
    </div>
  );
}
