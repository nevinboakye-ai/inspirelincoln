"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BellRing, Loader2, MessageCirclePlus, MessagesSquare, Search, Settings2, ShieldCheck, UserX } from "lucide-react";
import { useDeferredValue, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { saveMessagePrefs, setDelegateMessages } from "@/app/portal/message-actions";
import { Avatar } from "@/components/ui/avatar";
import { Drawer } from "@/components/ui/drawer";
import { cn } from "@/lib/cn";
import { headlineRole, isCommitteeRole, previewLine, shortWhen, type InboxRow } from "@/lib/messages";
import { viewingAs } from "@/lib/view-as-client";
import { useMessages } from "./messages-provider";

type Prefs = { open: boolean; email: boolean };

const POLL_VISIBLE = 12_000;
const POLL_HIDDEN = 90_000;

/**
 * Messages in My Hub. On phones the inbox fills the page and a
 * conversation opens over it full screen. From laptop width up the inbox
 * sits on the left and the conversation on the right, like a mail app.
 */
export function MessagesShell({
  initialRows,
  ready,
  prefs,
  owner,
  delegateMessages,
  committee,
  judge = false,
  children,
}: {
  initialRows: InboxRow[];
  ready: boolean;
  prefs: Prefs;
  owner: boolean;
  delegateMessages: boolean;
  committee: boolean;
  /** Judges message the committee only. */
  judge?: boolean;
  children: ReactNode;
}) {
  const path = usePathname();
  const [rows, setRows] = useState(initialRows);
  const [q, setQ] = useState("");
  const [settings, setSettings] = useState(false);
  const query = useDeferredValue(q.trim().toLowerCase());
  const { version, refresh } = useMessages();
  const active = path.startsWith("/portal/messages/") ? path.split("/")[3] : null;
  const inside = Boolean(active);
  const kick = useRef<() => void>(() => {});

  // Keep the list fresh: poll while it's on screen, and straight away when something changes.
  useEffect(() => {
    let timer: number | undefined;
    let stopped = false;
    let failures = 0;
    const poll = async () => {
      try {
        const res = await fetch("/api/messages/inbox", { cache: "no-store" });
        if (res.ok) {
          failures = 0;
          const data = (await res.json()) as { rows: InboxRow[] };
          setRows(data.rows);
        } else failures++;
      } catch {
        failures++;
      }
      if (stopped) return;
      const base = document.visibilityState === "visible" ? POLL_VISIBLE : POLL_HIDDEN;
      timer = window.setTimeout(poll, Math.min(base * 2 ** failures, 300_000));
    };
    kick.current = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(poll, 60);
    };
    timer = window.setTimeout(poll, POLL_VISIBLE);
    const wake = () => document.visibilityState === "visible" && kick.current();
    document.addEventListener("visibilitychange", wake);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", wake);
    };
  }, []);

  // A new message arrived somewhere, or you opened, sent or deleted one.
  useEffect(() => {
    if (version) kick.current();
  }, [version]);
  useEffect(() => {
    kick.current();
    refresh();
  }, [active, refresh]);

  // Opening a conversation clears its unread count straight away.
  const shown = rows
    .map((r) => (r.conversation_id === active ? { ...r, unread: 0 } : r))
    .filter((r) => !query || r.other_name.toLowerCase().includes(query) || r.other_institution?.toLowerCase().includes(query));

  return (
    <div className="lg:grid lg:h-[min(calc(100dvh-9rem),54rem)] lg:min-h-[34rem] lg:grid-cols-[17.5rem_1fr] lg:gap-4 xl:grid-cols-[20rem_1fr]">
      <section
        aria-labelledby="messages-title"
        className={cn(
          "flex-col overflow-hidden rounded-2xl border border-navy/10 bg-white shadow-[0_24px_60px_-44px_rgba(12,24,44,0.55)] lg:flex",
          inside || path === "/portal/messages/new" ? "hidden" : "flex",
        )}
      >
        <header className="relative overflow-hidden bg-midnight px-4 pb-4 pt-5 text-paper">
          <span aria-hidden className="lanyard-grid pointer-events-none absolute inset-0 opacity-20" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="eyebrow flex items-center gap-2 text-gold">
                <MessagesSquare aria-hidden className="size-4" /> Messages
              </p>
              <h1 id="messages-title" className="mt-1.5 font-display text-2xl leading-tight">
                Your conversations
              </h1>
            </div>
            <button
              type="button"
              onClick={() => setSettings(true)}
              aria-label="Message settings"
              className="grid size-11 shrink-0 place-items-center rounded-full text-paper/70 ring-1 ring-white/15 transition-colors hover:bg-white/10 hover:text-paper"
            >
              <Settings2 aria-hidden className="size-[1.1rem]" />
            </button>
          </div>
          <Link
            href="/portal/messages/new"
            className="relative mt-4 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gold font-ui text-sm font-semibold text-midnight shadow-[0_10px_24px_-14px_rgba(212,175,90,0.9)] transition-[transform,background-color] hover:bg-gold-300 active:scale-[0.98]"
          >
            <MessageCirclePlus aria-hidden className="size-[1.1rem]" /> {committee ? "New message or group message" : "New message"}
          </Link>
        </header>

        {rows.length > 5 && (
          <div className="border-b border-navy/10 p-3">
            <label className="relative block">
              <span className="sr-only">Search conversations</span>
              <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate" />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search conversations"
                className="min-h-11 w-full rounded-xl border border-navy/10 bg-paper/50 pl-9 pr-3 text-sm text-ink placeholder:text-slate focus:border-electric-600 focus:bg-white focus:outline-none"
              />
            </label>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {!ready ? (
            <p className="p-6 text-sm text-slate-700">Messages aren&apos;t available just now. Please try again later.</p>
          ) : rows.length === 0 ? (
            <EmptyInbox committee={committee} judge={judge} />
          ) : shown.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-700">No conversations match that search.</p>
          ) : (
            <ul className="divide-y divide-navy/[0.07]">
              {shown.map((r) => (
                <li key={r.conversation_id}>
                  <InboxItem row={r} active={r.conversation_id === active} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* min-h-0 keeps a long list or conversation inside the panel (scrolling within it) instead of stretching past the page. */}
      <div className={cn("min-w-0 lg:min-h-0", !inside && path !== "/portal/messages/new" && "hidden lg:block")}>{children}</div>

      <Drawer open={settings} onClose={() => setSettings(false)} label="Message settings">
        <MessageSettings prefs={prefs} owner={owner} delegateMessages={delegateMessages} judge={judge} />
      </Drawer>
    </div>
  );
}

function InboxItem({ row: r, active }: { row: InboxRow; active: boolean }) {
  const committee = isCommitteeRole(r.other_roles);
  const unread = r.unread > 0;
  const role = headlineRole(r.other_roles, r.other_position);
  return (
    <Link
      href={`/portal/messages/${r.conversation_id}`}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-3 px-4 py-3.5 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-electric-600",
        active ? "bg-cyan-300/70" : "hover:bg-paper/70 active:bg-paper",
      )}
    >
      {active && <span aria-hidden className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-navy" />}
      <span className="relative shrink-0">
        <Avatar
          url={r.other_photo}
          name={r.other_id ? r.other_name : null}
          className={cn("size-12", committee && "ring-2 ring-gold ring-offset-2 ring-offset-white")}
          fallbackClassName={committee ? "bg-midnight text-sm text-gold-300" : "bg-navy text-sm text-cyan"}
        />
        {!r.other_id && (
          <span aria-hidden className="absolute inset-0 grid place-items-center rounded-full bg-paper-200 text-slate">
            <UserX className="size-5" />
          </span>
        )}
        {committee && (
          <span aria-hidden className="absolute -bottom-0.5 -right-0.5 grid size-5 place-items-center rounded-full bg-midnight text-gold ring-2 ring-white">
            <ShieldCheck className="size-3" />
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className={cn("truncate text-[0.95rem] text-ink", unread ? "font-bold" : "font-semibold")}>{r.other_name}</span>
          <time dateTime={r.last_message_at} className={cn("shrink-0 text-xs", unread ? "font-semibold text-electric-600" : "text-slate")}>
            {shortWhen(r.last_message_at)}
          </time>
        </span>
        {role && <span className={cn("block truncate text-xs", committee ? "font-semibold text-gold-700" : "text-slate")}>{role}{r.other_institution && !committee ? ` · ${r.other_institution}` : ""}</span>}
        <span className="mt-0.5 flex items-center gap-2">
          <span className={cn("line-clamp-1 flex-1 text-sm", unread ? "font-medium text-ink" : "text-slate-700")}>{previewLine(r)}</span>
          {unread && (
            <span className="grid min-w-5 shrink-0 place-items-center rounded-full bg-electric-600 px-1.5 text-[0.7rem] font-bold leading-5 text-white">
              {r.unread > 99 ? "99+" : r.unread}
              <span className="sr-only"> unread</span>
            </span>
          )}
        </span>
      </span>
    </Link>
  );
}

function EmptyInbox({ committee, judge }: { committee: boolean; judge: boolean }) {
  return (
    <div className="px-6 py-10 text-center">
      <span aria-hidden className="mx-auto grid size-14 place-items-center rounded-full bg-cyan-300 text-navy">
        <MessagesSquare className="size-6" />
      </span>
      <p className="mt-4 font-display text-lg text-ink">No messages yet</p>
      <p className="mx-auto mt-1.5 max-w-xs text-sm text-slate-700">
        {committee
          ? "Message anyone with an account, or send the same message to a whole group. Each person gets it privately."
          : judge
            ? "Message the committee here if you need anything, before or on the day. Only the committee can message you."
            : "Say hello to someone you'd like to meet. You can message other delegates from the delegate network, and the committee can message you here too."}
      </p>
    </div>
  );
}

function Toggle({ checked, onChange, title, children, disabled }: { checked: boolean; onChange: (v: boolean) => void; title: string; children: ReactNode; disabled?: boolean }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-navy/10 p-4 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-electric-600">
      <span>
        <span className="block font-semibold text-ink">{title}</span>
        <span className="mt-0.5 block text-sm text-slate-700">{children}</span>
      </span>
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span aria-hidden className="relative mt-1 h-7 w-12 shrink-0 rounded-full bg-paper-300 transition-colors peer-checked:bg-navy peer-disabled:opacity-60 after:absolute after:left-1 after:top-1 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5" />
    </label>
  );
}

function MessageSettings({ prefs, owner, delegateMessages, judge }: { prefs: Prefs; owner: boolean; delegateMessages: boolean; judge: boolean }) {
  const [p, setP] = useState(prefs);
  const [dm, setDm] = useState(delegateMessages);
  const [pending, start] = useTransition();
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const save = (next: Prefs) => {
    setP(next);
    start(async () => {
      if (viewingAs()) return setNote({ ok: false, text: "You're viewing as someone else, so changes are switched off." });
      const res = await saveMessagePrefs(next.open, next.email);
      setNote(res.ok ? { ok: true, text: "Saved." } : { ok: false, text: res.error });
      if (!res.ok) setP(p);
    });
  };
  const flip = (on: boolean) => {
    setDm(on);
    start(async () => {
      const res = await setDelegateMessages(on);
      setNote(res.ok ? { ok: true, text: on ? "Delegates can message each other." : "Delegate-to-delegate messages are off." } : { ok: false, text: res.error });
      if (!res.ok) setDm(!on);
    });
  };
  return (
    <div className="px-6 pb-8 pt-8 sm:px-8">
      <p className="eyebrow flex items-center gap-2 text-gold-700">
        <Settings2 aria-hidden className="size-4" /> Messages
      </p>
      <h2 className="mt-2 font-display text-2xl text-ink">Message settings</h2>
      <div className="mt-6 space-y-3">
        {!judge && (
          <Toggle checked={p.open} onChange={(v) => save({ ...p, open: v })} title="Messages from other delegates" disabled={pending}>
            Let confirmed delegates start a conversation with you. The committee can always message you, and you can always reply.
          </Toggle>
        )}
        <Toggle checked={p.email} onChange={(v) => save({ ...p, email: v })} title="Email me about new messages" disabled={pending}>
          <BellRing aria-hidden className="mr-1 inline size-3.5 align-[-2px]" /> One short email when a message is waiting and you haven&apos;t been on the website. Never one per message.
        </Toggle>
        {owner && (
          <div className="pt-4">
            <p className="mb-2 font-ui text-xs font-semibold uppercase tracking-[0.16em] text-gold-700">Site owner</p>
            <Toggle checked={dm} onChange={flip} title="Delegates can message each other" disabled={pending}>
              Needs the delegate network to be open as well. The committee can always message anyone, and who counts as committee is set by the &ldquo;Direct messages&rdquo; permission on the Platform dashboard.
            </Toggle>
          </div>
        )}
      </div>
      <p aria-live="polite" className={cn("mt-4 flex min-h-6 items-center gap-2 text-sm font-medium", note?.ok ? "text-success" : "text-danger")}>
        {pending ? <Loader2 aria-hidden className="size-4 animate-spin text-slate" /> : note?.text}
      </p>
    </div>
  );
}
