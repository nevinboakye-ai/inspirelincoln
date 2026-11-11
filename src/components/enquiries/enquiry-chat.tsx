"use client";
import { ArrowDown, CheckCheck, Clock, Loader2, Lock, RotateCcw, SendHorizontal, ShieldCheck } from "lucide-react";
import { Fragment, useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { sendEnquiryMessage, setEnquiryClosed } from "@/app/portal/enquiry-actions";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";
import { BODY_MAX, ENQUIRY_TOPICS, REPLY_PROMISE, dayLabel, memberStatus, needsReply, sameDay, timeOf, type EnquiryMessage, type EnquiryThread } from "@/lib/enquiries";
import { Badge } from "@/components/ui/badge";
import { viewingAs } from "@/lib/view-as-client";

type Viewer = "member" | "committee";
type Local = EnquiryMessage & { state?: "sending" | "failed" };

const POLL_VISIBLE = 4000;
const POLL_HIDDEN = 30000;

/** Turns web addresses in a message into links. Everything else stays plain text. */
function linkify(text: string): ReactNode[] {
  const parts = text.split(/(https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]])/g);
  return parts.map((p, i) =>
    i % 2 ? (
      <a key={i} href={p} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-2 [overflow-wrap:anywhere]">
        {p}
      </a>
    ) : (
      p
    ),
  );
}

/**
 * A live conversation between a member and the committee. New messages
 * arrive every few seconds while the page is open, sends show straight
 * away, and screen readers hear each new reply.
 */
export function EnquiryChat({
  thread: initialThread,
  messages: initialMessages,
  viewer,
  me,
  memberName,
  memberPhoto,
  header,
}: {
  thread: EnquiryThread;
  messages: EnquiryMessage[];
  viewer: Viewer;
  me: string;
  memberName: string;
  memberPhoto?: string | null;
  header?: ReactNode;
}) {
  const [thread, setThread] = useState(initialThread);
  const [messages, setMessages] = useState<Local[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const [unseenBelow, setUnseenBelow] = useState(0);
  const [statusPending, startStatus] = useTransition();
  const list = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const atBottom = useRef(true);
  const fineRef = useRef(false);
  const inputId = useId();
  const hintId = useId();
  const closed = thread.status === "closed";
  const otherReadAt = viewer === "member" ? thread.committee_read_at : thread.member_read_at;
  const mine = (m: EnquiryMessage) => (viewer === "member" ? !m.from_committee : m.from_committee);

  useEffect(() => {
    fineRef.current = window.matchMedia("(pointer: fine)").matches;
  }, []);

  const scrollToEnd = useCallback((smooth = false) => {
    const el = list.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    setUnseenBelow(0);
  }, []);

  useLayoutEffect(() => scrollToEnd(), [scrollToEnd]);

  // Keep following the conversation if they're already at the end of it.
  const count = messages.length;
  useLayoutEffect(() => {
    if (atBottom.current) scrollToEnd(true);
  }, [count, scrollToEnd]);

  const onScroll = () => {
    const el = list.current;
    if (!el) return;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (atBottom.current) setUnseenBelow(0);
  };

  // Poll for new messages: often while the page is in front, rarely when it isn't.
  const lastAt = messages.filter((m) => !m.state).at(-1)?.created_at ?? null;
  const lastAtRef = useRef(lastAt);
  lastAtRef.current = lastAt;
  useEffect(() => {
    let timer: number | undefined;
    let stopped = false;
    let failures = 0;
    const poll = async () => {
      const visible = document.visibilityState === "visible";
      try {
        const qs = new URLSearchParams();
        if (lastAtRef.current) qs.set("after", lastAtRef.current);
        if (visible && !viewingAs()) qs.set("seen", "1");
        const res = await fetch(`/api/enquiries/${thread.id}?${qs}`, { cache: "no-store" });
        if (res.ok) {
          failures = 0;
          const data = (await res.json()) as { thread: EnquiryThread; messages: EnquiryMessage[] };
          setThread(data.thread);
          if (data.messages.length) {
            setMessages((prev) => {
              const known = new Set(prev.map((m) => m.id));
              const fresh = data.messages.filter((m) => !known.has(m.id));
              if (!fresh.length) return prev;
              const theirs = fresh.filter((m) => !mine(m));
              if (theirs.length) {
                const last = theirs.at(-1)!;
                const who = viewer === "member" ? `${last.author_name} from the committee` : last.author_name;
                setAnnounce(`New message from ${who}: ${last.body.slice(0, 140)}`);
                if (!atBottom.current) setUnseenBelow((n) => n + theirs.length);
              }
              return [...prev, ...fresh].sort((a, b) => a.created_at.localeCompare(b.created_at));
            });
          }
        } else failures++;
      } catch {
        failures++;
      }
      if (stopped) return;
      const base = document.visibilityState === "visible" ? POLL_VISIBLE : POLL_HIDDEN;
      timer = window.setTimeout(poll, Math.min(base * 2 ** failures, 60000));
    };
    timer = window.setTimeout(poll, 600);
    const wake = () => {
      if (document.visibilityState !== "visible") return;
      window.clearTimeout(timer);
      timer = window.setTimeout(poll, 50);
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread.id, viewer]);

  const deliver = async (temp: Local) => {
    setMessages((prev) => prev.map((m) => (m.id === temp.id ? { ...m, state: "sending" } : m)));
    const res = await sendEnquiryMessage(thread.id, temp.body).catch(() => ({ ok: false as const, error: "That didn't send. Check your connection and try again." }));
    if (res.ok) {
      setMessages((prev) => {
        const without = prev.filter((m) => m.id !== temp.id && m.id !== res.message.id);
        return [...without, res.message].sort((a, b) => a.created_at.localeCompare(b.created_at));
      });
      setThread((t) => ({
        ...t,
        status: viewer === "committee" ? "answered" : "open",
        last_from: viewer,
        last_message_at: res.message.created_at,
      }));
    } else {
      setMessages((prev) => prev.map((m) => (m.id === temp.id ? { ...m, state: "failed" } : m)));
      setError(res.error);
    }
  };

  const send = () => {
    const body = draft.trim();
    if (!body) return;
    setError(null);
    if (viewingAs()) return setError("You're viewing as someone else, so sending is switched off.");
    if (body.length > BODY_MAX) return setError(`Keep your message to ${BODY_MAX} characters.`);
    const temp: Local = {
      id: `tmp-${crypto.randomUUID()}`,
      thread_id: thread.id,
      author_id: me,
      author_name: "You",
      from_committee: viewer === "committee",
      body,
      created_at: new Date().toISOString(),
      state: "sending",
    };
    setDraft("");
    atBottom.current = true;
    setMessages((prev) => [...prev, temp]);
    void deliver(temp);
    box.current?.focus();
  };

  const toggleClosed = () =>
    startStatus(async () => {
      setError(null);
      if (viewingAs()) return setError("You're viewing as someone else, so changes are switched off.");
      const res = await setEnquiryClosed(thread.id, !closed);
      if (!res.ok) return setError(res.error);
      setThread((t) => ({ ...t, status: !closed ? "closed" : t.last_from === "committee" ? "answered" : "open" }));
      setAnnounce(!closed ? "Enquiry closed." : "Enquiry reopened.");
    });

  // The last of my sent messages, which carries the "Seen" note.
  const lastMine = [...messages].reverse().find((m) => mine(m) && !m.state);
  const remaining = BODY_MAX - draft.length;

  return (
    <section aria-labelledby="chat-subject" className="flex h-[calc(100dvh-13rem)] min-h-[28rem] flex-col overflow-hidden rounded-2xl border border-navy/10 bg-white shadow-[0_24px_60px_-40px_rgba(12,24,44,0.5)] sm:h-[min(78dvh,46rem)]">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-navy/10 px-4 py-3 sm:px-6 sm:py-4">
        <div className="min-w-0 flex-1">
          {header}
          <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge tone="neutral">{ENQUIRY_TOPICS[thread.topic]?.label ?? thread.topic}</Badge>
            {viewer === "member" ? (
              <Badge tone={memberStatus(thread).tone}>{memberStatus(thread).label}</Badge>
            ) : closed ? (
              <Badge tone="neutral">Resolved</Badge>
            ) : needsReply(thread) ? (
              <Badge tone="warning">Needs a reply</Badge>
            ) : (
              <Badge tone="success">Replied</Badge>
            )}
            {viewer === "member" && needsReply(thread) && (
              <span className="inline-flex items-center gap-1 text-xs text-slate-700">
                <Clock aria-hidden className="size-3.5" /> {REPLY_PROMISE}
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={toggleClosed}
          disabled={statusPending}
          className="inline-flex min-h-11 items-center gap-2 rounded-[3px] border border-navy/15 px-3.5 text-sm font-semibold text-ink hover:border-navy/40 disabled:opacity-60"
        >
          {statusPending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : closed ? <RotateCcw aria-hidden className="size-4" /> : <CheckCheck aria-hidden className="size-4" />}
          {closed ? "Reopen" : viewer === "committee" ? "Mark resolved" : (
            <>
              Close<span className="sr-only sm:not-sr-only"> enquiry</span>
            </>
          )}
        </button>
      </header>

      <div className="relative min-h-0 flex-1">
        <div ref={list} onScroll={onScroll} role="log" aria-live="off" aria-label="Messages" tabIndex={0} className="h-full overflow-y-auto overscroll-contain bg-paper/60 px-3 py-5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-electric-600 sm:px-6">
          <ol className="space-y-1.5">
            {messages.map((m, i) => {
              const prev = messages[i - 1];
              const next = messages[i + 1];
              const own = mine(m);
              const newDay = !prev || !sameDay(prev.created_at, m.created_at);
              const groupStart = newDay || !prev || prev.from_committee !== m.from_committee || prev.author_id !== m.author_id;
              const groupEnd = !next || next.from_committee !== m.from_committee || next.author_id !== m.author_id || !sameDay(next.created_at, m.created_at);
              const committeeName = m.from_committee ? (viewer === "member" ? `${m.author_name}, INSPIRE committee` : m.author_id === me ? "You" : m.author_name) : viewer === "member" ? "You" : memberName;
              return (
                <Fragment key={m.id}>
                  {newDay && (
                    <li aria-hidden={false} className="flex items-center gap-3 py-3 text-xs font-semibold text-slate">
                      <span aria-hidden className="h-px flex-1 bg-navy/10" />
                      <span>{dayLabel(m.created_at)}</span>
                      <span aria-hidden className="h-px flex-1 bg-navy/10" />
                    </li>
                  )}
                  <li className={cn("flex items-end gap-2", own ? "justify-end" : "justify-start", groupStart && i > 0 && !newDay && "pt-3")}>
                    {!own && (
                      <span aria-hidden className="w-8 shrink-0">
                        {groupEnd &&
                          (m.from_committee ? (
                            <span className="grid size-8 place-items-center rounded-full bg-midnight text-gold">
                              <ShieldCheck className="size-4" />
                            </span>
                          ) : (
                            <Avatar url={memberPhoto} name={memberName} className="size-8" fallbackClassName="bg-navy text-[0.65rem] text-cyan" />
                          ))}
                      </span>
                    )}
                    <div className={cn("flex max-w-[85%] flex-col sm:max-w-[70%]", own ? "items-end" : "items-start")}>
                      {groupStart && <p className="mb-1 px-1 text-xs font-semibold text-slate-700">{committeeName}</p>}
                      <div
                        className={cn(
                          "whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-[0.95rem] leading-relaxed [overflow-wrap:anywhere]",
                          own ? "bg-navy text-paper" : "border border-navy/10 bg-white text-ink",
                          own ? (groupEnd ? "rounded-br-md" : "") : groupEnd ? "rounded-bl-md" : "",
                          m.state === "sending" && "opacity-70",
                          m.state === "failed" && "bg-danger/90",
                        )}
                      >
                        <span className="sr-only">{committeeName}: </span>
                        {linkify(m.body)}
                      </div>
                      {(groupEnd || m.state) && (
                        <p className="mt-1 flex items-center gap-1.5 px-1 text-[0.72rem] text-slate">
                          {m.state === "sending" ? (
                            <>Sending…</>
                          ) : m.state === "failed" ? (
                            <span className="flex items-center gap-2 font-semibold text-danger">
                              Not sent.
                              <button type="button" onClick={() => void deliver(m)} className="min-h-8 underline underline-offset-2">
                                Try again
                              </button>
                            </span>
                          ) : (
                            <>
                              <time dateTime={m.created_at}>{timeOf(m.created_at)}</time>
                              {m.id === lastMine?.id && otherReadAt && otherReadAt >= m.created_at && (
                                <span className="flex items-center gap-1">
                                  · <CheckCheck aria-hidden className="size-3.5 text-success" /> Seen{viewer === "member" ? " by the committee" : ""}
                                </span>
                              )}
                            </>
                          )}
                        </p>
                      )}
                    </div>
                  </li>
                </Fragment>
              );
            })}
          </ol>
          {closed && (
            <p className="mx-auto mt-6 flex max-w-sm items-center justify-center gap-2 rounded-full bg-paper-200 px-4 py-2 text-center text-xs font-semibold text-slate-700">
              <Lock aria-hidden className="size-3.5" /> {viewer === "member" ? "Closed. Send a message to reopen it." : "Marked resolved. A new message from them reopens it."}
            </p>
          )}
        </div>
        {unseenBelow > 0 && (
          <button
            type="button"
            onClick={() => scrollToEnd(true)}
            className="absolute bottom-3 left-1/2 inline-flex min-h-10 -translate-x-1/2 items-center gap-1.5 rounded-full bg-midnight px-4 text-sm font-semibold text-paper shadow-lg"
          >
            <ArrowDown aria-hidden className="size-4" /> {unseenBelow === 1 ? "1 new message" : `${unseenBelow} new messages`}
          </button>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="border-t border-navy/10 bg-white p-3 sm:p-4"
      >
        {error && (
          <p role="alert" className="mb-2 px-1 text-sm font-medium text-danger">
            {error}
          </p>
        )}
        <div className="flex items-end gap-2">
          <label htmlFor={inputId} className="sr-only">
            {viewer === "member" ? "Message the committee" : `Reply to ${memberName}`}
          </label>
          <textarea
            id={inputId}
            ref={box}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && fineRef.current) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            maxLength={BODY_MAX + 200}
            aria-describedby={hintId}
            placeholder={viewer === "member" ? "Write a message…" : `Reply to ${memberName.split(" ")[0]}…`}
            className="max-h-40 min-h-12 flex-1 resize-none rounded-xl border border-navy/15 bg-paper/40 px-4 py-3 text-[0.95rem] leading-snug text-ink [field-sizing:content] placeholder:text-slate focus:border-electric-600 focus:bg-white focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-electric-600"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            aria-label="Send"
            className="grid size-12 shrink-0 place-items-center rounded-full bg-navy text-paper transition-colors hover:bg-navy-700 disabled:bg-navy/30"
          >
            <SendHorizontal aria-hidden className="size-5" />
          </button>
        </div>
        <p id={hintId} className="mt-1.5 flex justify-between gap-3 px-1 text-xs text-slate">
          <span className="hidden [@media(pointer:fine)]:inline">Enter to send, Shift + Enter for a new line.</span>
          <span className="[@media(pointer:fine)]:hidden">{viewer === "member" ? "Only you and the committee can see this." : "They'll see your name with your reply."}</span>
          {remaining < 400 && <span className={cn("ml-auto tabular-nums", remaining < 0 && "font-semibold text-danger")}>{remaining} left</span>}
        </p>
      </form>
      <p aria-live="polite" className="sr-only">
        {announce}
      </p>
    </section>
  );
}
