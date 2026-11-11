import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { signAvatar } from "@/lib/avatar";
import { EnquiryChat } from "@/components/enquiries/enquiry-chat";
import { MESSAGE_COLUMNS, THREAD_COLUMNS, type EnquiryMessage, type EnquiryThread } from "@/lib/enquiries";

export const metadata: Metadata = { title: "Enquiry" };
export const dynamic = "force-dynamic";

export default async function EnquiryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db, user, profile } = await requireUser(`/portal/enquiries/${id}`);
  const [{ data: thread }, { data: messages }, photo] = await Promise.all([
    db.from("enquiry_threads").select(THREAD_COLUMNS).eq("id", id).eq("user_id", user.id).maybeSingle(),
    db.from("enquiry_messages").select(MESSAGE_COLUMNS).eq("thread_id", id).order("created_at").limit(500),
    signAvatar(db, profile.avatarPath),
  ]);
  if (!thread) notFound();
  const t = thread as EnquiryThread;

  return (
    <div className="space-y-4">
      <Link href="/portal/enquiries" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-slate-700 hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" /> All enquiries
      </Link>
      <EnquiryChat
        thread={t}
        messages={(messages ?? []) as EnquiryMessage[]}
        viewer="member"
        me={user.id}
        memberName={profile.fullName ?? "You"}
        memberPhoto={photo}
        header={
          <>
            <h1 id="chat-subject" className="line-clamp-2 break-words font-display text-xl leading-tight text-ink sm:text-2xl">
              {t.subject}
            </h1>
          </>
        }
      />
    </div>
  );
}
