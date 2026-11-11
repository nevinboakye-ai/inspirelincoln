import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";
import { ENQUIRY_TOPICS, memberStatus, needsReply, shortWhen, unreadForMember, type EnquiryThread } from "@/lib/enquiries";

export type ThreadRow = EnquiryThread & { preview: string | null; previewFromCommittee: boolean; memberName?: string; memberPhoto?: string | null; memberMeta?: string };

/** Conversations, newest activity first, as a member or the committee sees them. */
export function ThreadList({ threads, viewer, hrefBase }: { threads: ThreadRow[]; viewer: "member" | "committee"; hrefBase: string }) {
  return (
    <ul className="divide-y divide-navy/10 overflow-hidden rounded-xl border border-navy/10 bg-white">
      {threads.map((t) => {
        const unread = viewer === "member" ? unreadForMember(t) : needsReply(t) && (!t.committee_read_at || t.committee_read_at < t.last_message_at);
        const waiting = viewer === "committee" && needsReply(t);
        const status = memberStatus(t);
        return (
          <li key={t.id}>
            <Link href={`${hrefBase}/${t.id}`} className="group flex items-start gap-3.5 px-4 py-4 transition-colors hover:bg-paper/70 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-electric-600 sm:px-5">
              {viewer === "committee" ? (
                <Avatar url={t.memberPhoto} name={t.memberName ?? null} className="mt-0.5 size-10" fallbackClassName="bg-navy text-xs text-cyan" />
              ) : (
                <span aria-hidden className={cn("mt-2 size-2.5 shrink-0 rounded-full", unread ? "bg-electric-600" : "bg-transparent")} />
              )}
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-3">
                  <span className={cn("truncate text-ink", unread ? "font-bold" : "font-semibold")}>
                    {viewer === "committee" ? t.memberName : t.subject}
                  </span>
                  <time dateTime={t.last_message_at} className={cn("shrink-0 text-xs", unread ? "font-semibold text-electric-600" : "text-slate")}>
                    {shortWhen(t.last_message_at)}
                  </time>
                </span>
                {viewer === "committee" && <span className="block truncate text-sm font-medium text-ink">{t.subject}</span>}
                {t.preview && (
                  <span className={cn("mt-0.5 line-clamp-1 text-sm", unread ? "text-ink" : "text-slate-700")}>
                    {t.previewFromCommittee ? (viewer === "member" ? "Committee: " : "Committee: ") : viewer === "member" ? "You: " : ""}
                    {t.preview}
                  </span>
                )}
                <span className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Badge tone="neutral">{ENQUIRY_TOPICS[t.topic]?.label ?? t.topic}</Badge>
                  {viewer === "member" ? (
                    <Badge tone={status.tone}>{status.label}</Badge>
                  ) : t.status === "closed" ? (
                    <Badge tone="neutral">Resolved</Badge>
                  ) : waiting ? (
                    <Badge tone="warning">Needs a reply</Badge>
                  ) : (
                    <Badge tone="success">Replied</Badge>
                  )}
                  {unread && <span className="sr-only">{viewer === "member" ? "New reply" : "Unread"}</span>}
                  {viewer === "committee" && t.memberMeta && <span className="truncate text-xs text-slate">{t.memberMeta}</span>}
                </span>
              </span>
              <ChevronRight aria-hidden className="mt-1 size-4 shrink-0 text-slate transition-transform group-hover:translate-x-0.5" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
