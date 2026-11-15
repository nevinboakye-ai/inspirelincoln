"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowLeft, Ban, CheckCheck, Flag, Loader2, MoreVertical, SendHorizontal, ShieldCheck, Sparkles, Trash2, UserX } from "lucide-react";
import { Fragment, useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { clearConversation, reportConversation, sendMessage, setBlocked } from "@/app/portal/message-actions";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";
import {
  COMMITTEE_TEMPLATES,
  DM_BODY_MAX,
  dayLabel,
  fillTemplate,
  headlineRole,
  isCommitteeRole,
  sameDay,
  timeOf,
  type DmMessage,
  type Peer,
} from "@/lib/messages";
import { viewingAs } from "@/lib/view-as-client";
import { useMessages } from "./messages-provider";
import { useFullScreenOnPhones } from "./use-full-screen";

type Local = DmMessage & { state?: "sending" | "failed" };

const POLL_VISIBLE = 3500;
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

export function DmChat({
  conversationId,
  messages: initialMessages,
  peer: initialPeer,
  me,
  committee,
}: {
  conversationId: string;
  messages: DmMessage[];
  peer: Peer;
  me: string;
  /** The viewer has the "Direct messages" permission. */
  committee: boolean;
}) {
  const router = useRouter();
  const { refresh } = useMessages();
  const [peer, setPeer] = useState(initialPeer);
  const [messages, setMessages] = useState<Local[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const [unseenBelow, setUnseenBelow] = useState(0);
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [busy, startBusy] = useTransition();
  const shell = useRef<HTMLElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const atBottom = useRef(true);
  const fineRef = useRef(false);
  const inputId = useId();
  const menuId = useId();
  const first = peer.other_name.split(/\s+/)[0] || peer.other_name;
  const theyAreCommittee = isCommitteeRole(peer.other_roles);
  const role = headlineRole(peer.other_roles, peer.other_position);
  const mine = (m: DmMessage) => m.sender_id === me;

  useFullScreenOnPhones(shell);

  useEffect(() => {
    fineRef.current = window.matchMedia("(pointer: fine)").matches;
    if (fineRef.current) box.current?.focus({ preventScroll: true });
  }, []);

  const scrollToEnd = useCallback((smooth = false) => {
    const el = list.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    setUnseenBelow(0);
  }, []);

  useLayoutEffect(() => scrollToEnd(), [scrollToEnd]);
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
  useEffect(() => {
    lastAtRef.current = lastAt;
  }, [lastAt]);
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
        const res = await fetch(`/api/messages/${conversationId}?${qs}`, { cache: "no-store" });
        if (res.ok) {
          failures = 0;
          const data = (await res.json()) as { messages: DmMessage[]; otherReadAt: string | null; otherGone: boolean };
          setPeer((p) => (p.other_read_at === data.otherReadAt && !(data.otherGone && p.other_id) ? p : { ...p, other_read_at: data.otherReadAt, ...(data.otherGone ? { other_id: null, can_send: false } : {}) }));
          if (data.messages.length) {
            setMessages((prev) => {
              const known = new Set(prev.map((m) => m.id));
              const fresh = data.messages.filter((m) => !known.has(m.id));
              if (!fresh.length) return prev;
              const theirs = fresh.filter((m) => m.sender_id !== me);
              if (theirs.length) {
                const last = theirs.at(-1)!;
                setAnnounce(`New message from ${last.sender_name}: ${last.body.slice(0, 140)}`);
                if (!atBottom.current) setUnseenBelow((n) => n + theirs.length);
              }
              return [...prev, ...fresh].sort((a, b) => a.created_at.localeCompare(b.created_at));
            });
            refresh();
          }
        } else failures++;
      } catch {
        failures++;
      }
      if (stopped) return;
      const base = document.visibilityState === "visible" ? POLL_VISIBLE : POLL_HIDDEN;
      timer = window.setTimeout(poll, Math.min(base * 2 ** failures, 60000));
    };
    timer = window.setTimeout(poll, 500);
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
  }, [conversationId, me, refresh]);

  const deliver = async (temp: Local) => {
    setMessages((prev) => prev.map((m) => (m.id === temp.id ? { ...m, state: "sending" } : m)));
    const res = await sendMessage(conversationId, temp.body).catch(() => ({ ok: false as const, error: "That didn't send. Check your connection and try again." }));
    if (res.ok) {
      setMessages((prev) => {
        const without = prev.filter((m) => m.id !== temp.id && m.id !== res.message.id);
        return [...without, res.message].sort((a, b) => a.created_at.localeCompare(b.created_at));
      });
      refresh();
    } else {
      setMessages((prev) => prev.map((m) => (m.id === temp.id ? { ...m, state: "failed" } : m)));
      setError(res.error);
    }
  };

  const send = () => {
    const body = draft.trim();
    if (!body) return;
    setError(null);
    if (viewingAs()) return setError("You're viewing as someone else, so messages are read only.");
    if (body.length > DM_BODY_MAX) return setError(`Keep your message to ${DM_BODY_MAX} characters.`);
    const temp: Local = {
      id: `tmp-${crypto.randomUUID()}`,
      conversation_id: conversationId,
      sender_id: me,
      sender_name: "You",
      from_committee: committee,
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

  const toggleBlock = () =>
    startBusy(async () => {
      setMenu(false);
      if (!peer.other_id) return;
      const on = !peer.blocked_by_me;
      const res = await setBlocked(peer.other_id, on);
      if (!res.ok) return setError(res.error);
      setPeer((p) => ({ ...p, blocked_by_me: on, can_send: committee ? p.can_send : !on, why_not: on && !committee ? `You've blocked ${p.other_name}.` : null }));
      setAnnounce(on ? `${peer.other_name} is blocked.` : `${peer.other_name} is unblocked.`);
      refresh();
    });

  const remove = () =>
    startBusy(async () => {
      setMenu(false);
      if (!window.confirm(`Delete this conversation from your messages? ${peer.other_name} keeps their copy. If they write again it comes back.`)) return;
      const res = await clearConversation(conversationId);
      if (!res.ok) return setError(res.error);
      refresh();
      router.push("/portal/messages");
    });

  // The last of my sent messages, which carries the "Seen" note.
  const lastMine = [...messages].reverse().find((m) => mine(m) && !m.state);
  const remaining = DM_BODY_MAX - draft.length;
  const canSend = peer.can_send && !(peer.blocked_by_me && !committee);

  return (
    <section
      ref={shell}
      aria-labelledby="dm-with"
      className="fixed inset-x-0 top-0 z-[55] flex h-[100dvh] flex-col overflow-hidden bg-white lg:relative lg:z-auto lg:h-full lg:rounded-2xl lg:border lg:border-navy/10 lg:shadow-[0_24px_60px_-44px_rgba(12,24,44,0.55)]"
    >
      <header className="relative flex items-center gap-2 border-b border-navy/10 bg-white/95 px-2 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur sm:px-3 lg:px-4 lg:py-3">
        <Link href="/portal/messages" aria-label="All messages" className="grid size-11 shrink-0 place-items-center rounded-full text-ink hover:bg-paper-200 lg:hidden">
          <ArrowLeft aria-hidden className="size-5" />
        </Link>
        <span className="relative shrink-0">
          <Avatar
            url={peer.other_photo}
            name={peer.other_id ? peer.other_name : null}
            className={cn("size-10 lg:size-11", theyAreCommittee && "ring-2 ring-gold ring-offset-2 ring-offset-white")}
            fallbackClassName={theyAreCommittee ? "bg-midnight text-xs text-gold-300" : "bg-navy text-xs text-cyan"}
          />
          {!peer.other_id && (
            <span aria-hidden className="absolute inset-0 grid place-items-center rounded-full bg-paper-200 text-slate">
              <UserX className="size-5" />
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1 pl-1">
          <h1 id="dm-with" className="truncate font-semibold leading-tight text-ink lg:text-lg">
            {peer.other_name}
          </h1>
          <p className="flex min-w-0 items-center gap-1.5 truncate text-xs text-slate">
            {theyAreCommittee && <ShieldCheck aria-hidden className="size-3.5 shrink-0 text-gold-700" />}
            <span className={cn("truncate", theyAreCommittee && "font-semibold text-gold-700")}>
              {[role, peer.other_institution].filter(Boolean).join(" · ") || (peer.other_id ? "INSPIRE" : "This account has been removed")}
            </span>
          </p>
        </div>
        {peer.other_id && (
          <div className="relative">
            <button
              type="button"
              aria-label="Conversation options"
              aria-expanded={menu}
              aria-controls={menuId}
              onClick={() => setMenu((v) => !v)}
              className="grid size-11 place-items-center rounded-full text-slate-700 hover:bg-paper-200"
            >
              {busy ? <Loader2 aria-hidden className="size-5 animate-spin" /> : <MoreVertical aria-hidden className="size-5" />}
            </button>
            {menu && (
              <>
                <button type="button" aria-hidden tabIndex={-1} className="fixed inset-0 z-10 cursor-default" onClick={() => setMenu(false)} />
                <ul id={menuId} className="absolute right-0 top-12 z-20 w-60 overflow-hidden rounded-xl border border-navy/10 bg-white py-1 shadow-[0_20px_50px_-20px_rgba(12,24,44,0.45)]">
                  {!committee && !theyAreCommittee && (
                    <li>
                      <MenuItem icon={Flag} onClick={() => { setMenu(false); setReporting(true); }}>Report to the committee</MenuItem>
                    </li>
                  )}
                  {!theyAreCommittee && (
                    <li>
                      <MenuItem icon={Ban} onClick={toggleBlock}>{peer.blocked_by_me ? `Unblock ${first}` : `Block ${first}`}</MenuItem>
                    </li>
                  )}
                  <li>
                    <MenuItem icon={Trash2} danger onClick={remove}>Delete conversation</MenuItem>
                  </li>
                </ul>
              </>
            )}
          </div>
        )}
      </header>

      <div className="relative min-h-0 flex-1">
        <div
          ref={list}
          onScroll={onScroll}
          role="log"
          aria-live="off"
          aria-label={`Messages with ${peer.other_name}`}
          tabIndex={0}
          className="h-full overflow-y-auto overscroll-contain bg-[radial-gradient(circle_at_20%_0%,rgba(201,216,236,0.45),transparent_45%),radial-gradient(circle_at_100%_100%,rgba(212,175,90,0.12),transparent_40%)] bg-paper/60 px-3 py-4 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-electric-600 sm:px-5"
        >
          {messages.length === 0 && (
            <div className="mx-auto mt-6 max-w-xs text-center">
              <Avatar url={peer.other_photo} name={peer.other_name} className="mx-auto size-20 ring-4 ring-white" fallbackClassName="bg-navy text-xl text-cyan" />
              <p className="mt-3 font-display text-xl text-ink">{peer.other_name}</p>
              {role && <p className="text-sm text-slate-700">{[role, peer.other_institution].filter(Boolean).join(" · ")}</p>}
              <p className="mt-4 text-sm text-slate-700">
                {committee ? `Only you and ${first} can see this conversation.` : `Say hello. Only you and ${first} can see this conversation.`}
              </p>
            </div>
          )}
          <ol className="space-y-1">
            {messages.map((m, i) => {
              const prev = messages[i - 1];
              const next = messages[i + 1];
              const own = mine(m);
              const newDay = !prev || !sameDay(prev.created_at, m.created_at);
              const groupStart = newDay || !prev || prev.sender_id !== m.sender_id;
              const groupEnd = !next || next.sender_id !== m.sender_id || !sameDay(next.created_at, m.created_at);
              return (
                <Fragment key={m.id}>
                  {newDay && (
                    <li className="sticky top-0 z-[1] flex justify-center py-2">
                      <span className="rounded-full bg-white/90 px-3 py-1 text-[0.7rem] font-semibold text-slate-700 shadow-sm ring-1 ring-navy/10 backdrop-blur">{dayLabel(m.created_at)}</span>
                    </li>
                  )}
                  <li className={cn("flex items-end gap-2", own ? "justify-end" : "justify-start", groupStart && i > 0 && !newDay && "pt-2.5")}>
                    {!own && (
                      <span aria-hidden className="w-7 shrink-0">
                        {groupEnd && <Avatar url={peer.other_photo} name={peer.other_name} className="size-7" fallbackClassName="bg-navy text-[0.6rem] text-cyan" />}
                      </span>
                    )}
                    <div className={cn("flex max-w-[82%] flex-col sm:max-w-[72%]", own ? "items-end" : "items-start")}>
                      {groupStart && !own && m.from_committee && (
                        <p className="mb-1 flex items-center gap-1 px-1 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-gold-700">
                          <ShieldCheck aria-hidden className="size-3" /> INSPIRE committee
                        </p>
                      )}
                      <div
                        className={cn(
                          "whitespace-pre-wrap break-words rounded-[1.25rem] px-3.5 py-2 text-[0.95rem] leading-relaxed [overflow-wrap:anywhere] motion-safe:animate-[dm-in_220ms_var(--ease-out-expo)]",
                          own ? "bg-navy text-paper" : m.from_committee ? "bg-white text-ink shadow-[0_1px_2px_rgba(12,24,44,0.08)] ring-1 ring-gold/60" : "bg-white text-ink shadow-[0_1px_2px_rgba(12,24,44,0.08)] ring-1 ring-navy/[0.08]",
                          own ? (groupEnd ? "rounded-br-md" : "") : groupEnd ? "rounded-bl-md" : "",
                          m.state === "sending" && "opacity-70",
                          m.state === "failed" && "bg-danger/90",
                        )}
                      >
                        <span className="sr-only">{own ? "You" : m.sender_name}: </span>
                        {linkify(m.body)}
                      </div>
                      {(groupEnd || m.state) && (
                        <p className="mt-1 flex items-center gap-1.5 px-1 text-[0.7rem] text-slate">
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
                              {m.id === lastMine?.id && peer.other_read_at && peer.other_read_at >= m.created_at && (
                                <span className="flex items-center gap-1">
                                  · <CheckCheck aria-hidden className="size-3.5 text-success" /> Seen
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

      {reporting && <ReportPanel name={peer.other_name} conversationId={conversationId} onClose={() => setReporting(false)} />}

      {canSend ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="border-t border-navy/10 bg-white px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 sm:px-3 lg:p-3"
        >
          {committee && (
            <div className="-mx-2 mb-2 flex gap-1.5 overflow-x-auto px-2 pb-0.5 [scrollbar-width:none] sm:-mx-3 sm:px-3">
              <span className="flex shrink-0 items-center gap-1 pr-1 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-gold-700">
                <Sparkles aria-hidden className="size-3.5" /> Ask to
              </span>
              {COMMITTEE_TEMPLATES.map((t) => (
                <button
                  key={t.label}
                  type="button"
                  onClick={() => {
                    setDraft((d) => (d.trim() ? `${d.trimEnd()}\n\n` : "") + fillTemplate(t.body, peer.other_name));
                    box.current?.focus();
                  }}
                  className="min-h-9 shrink-0 rounded-full border border-gold/50 bg-gold/10 px-3 text-xs font-semibold text-midnight transition-colors hover:bg-gold/25"
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
          {error && (
            <p role="alert" className="mb-2 px-1 text-sm font-medium text-danger">
              {error}
            </p>
          )}
          <div className="flex items-end gap-2">
            <label htmlFor={inputId} className="sr-only">
              Message {peer.other_name}
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
              maxLength={DM_BODY_MAX + 200}
              enterKeyHint="send"
              placeholder={`Message ${first}…`}
              className="max-h-36 min-h-12 flex-1 resize-none rounded-3xl border border-navy/15 bg-paper/40 px-4 py-3 text-base leading-snug text-ink [field-sizing:content] placeholder:text-slate focus:border-electric-600 focus:bg-white focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-electric-600 lg:text-[0.95rem]"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              aria-label="Send"
              className="grid size-12 shrink-0 place-items-center rounded-full bg-navy text-paper transition-[background-color,transform] hover:bg-navy-700 active:scale-95 disabled:bg-navy/25"
            >
              <SendHorizontal aria-hidden className="size-5" />
            </button>
          </div>
          {remaining < 400 && <p className={cn("mt-1 px-2 text-right text-xs tabular-nums text-slate", remaining < 0 && "font-semibold text-danger")}>{remaining} left</p>}
        </form>
      ) : (
        <div className="border-t border-navy/10 bg-paper/70 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 text-center text-sm text-slate-700">
          {peer.blocked_by_me ? (
            <>
              You&apos;ve blocked {first}, so neither of you can send messages here.{" "}
              <button type="button" onClick={toggleBlock} className="min-h-9 font-semibold text-electric-600 underline underline-offset-2">
                Unblock
              </button>
            </>
          ) : (
            (peer.why_not ?? "You can't reply in this conversation.")
          )}
          {error && <p role="alert" className="mt-2 font-medium text-danger">{error}</p>}
        </div>
      )}
      <p aria-live="polite" className="sr-only">
        {announce}
      </p>
    </section>
  );
}

function MenuItem({ icon: Icon, children, onClick, danger }: { icon: typeof Flag; children: ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={cn("flex min-h-12 w-full items-center gap-3 px-4 text-left text-sm font-medium hover:bg-paper/80", danger ? "text-danger" : "text-ink")}>
      <Icon aria-hidden className="size-4 shrink-0" /> {children}
    </button>
  );
}

function ReportPanel({ name, conversationId, onClose }: { name: string; conversationId: string; onClose: () => void }) {
  const [note, setNote] = useState("");
  const [state, setState] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const id = useId();
  return (
    <div className="border-t border-navy/10 bg-white p-4">
      {state?.ok ? (
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm text-success">{state.text}</p>
          <button type="button" onClick={onClose} className="min-h-9 shrink-0 text-sm font-semibold text-electric-600">
            Close
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              if (viewingAs()) return setState({ ok: false, text: "You're viewing as someone else, so reports are switched off." });
              const res = await reportConversation(conversationId, note);
              setState(res.ok ? { ok: true, text: "Thank you. The committee has your report and will reply under Enquiries. You can also block them from the menu." } : { ok: false, text: res.error });
            });
          }}
        >
          <label htmlFor={id} className="block font-semibold text-ink">
            Report {name} to the committee
          </label>
          <p className="mt-0.5 text-xs text-slate-700">The committee will see what you write and your latest messages with them. {name} isn&apos;t told.</p>
          <textarea id={id} value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={800} placeholder="What happened?" className="mt-2 w-full rounded-xl border border-navy/15 bg-paper/40 px-3 py-2 text-base focus:border-electric-600 focus:outline-none lg:text-sm" />
          {state && !state.ok && <p role="alert" className="mt-1 text-sm text-danger">{state.text}</p>}
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="min-h-11 rounded-[3px] px-4 text-sm font-semibold text-slate-700">
              Cancel
            </button>
            <button type="submit" disabled={pending} className="inline-flex min-h-11 items-center gap-2 rounded-[3px] bg-danger px-4 text-sm font-semibold text-white disabled:opacity-60">
              {pending && <Loader2 aria-hidden className="size-4 animate-spin" />} Send report
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
