"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, CheckCircle2, ChevronRight, Loader2, Search, SendHorizontal, ShieldCheck, Sparkles, Users, X } from "lucide-react";
import { useDeferredValue, useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { sendToMany, startConversation } from "@/app/portal/message-actions";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";
import { ACCOUNT_STATUS_LABEL } from "@/lib/accounts";
import { COMMITTEE_TEMPLATES, CONTACT_GROUPS, DM_BODY_MAX, fillTemplate, headlineRole, isCommitteeRole, type Contact, type ContactGroup } from "@/lib/messages";
import { viewingAs } from "@/lib/view-as-client";
import { useMessages } from "./messages-provider";
import { useFullScreenOnPhones } from "./use-full-screen";

/**
 * Pick who to message. Everyone can open a conversation with one person.
 * The committee can also filter by group or university, tick several people
 * (or everyone shown) and send them the same message, each privately.
 */
export function NewMessage({ contacts, committee, unavailable }: { contacts: Contact[]; committee: boolean; unavailable?: string | null }) {
  const router = useRouter();
  const { refresh } = useMessages();
  const shell = useRef<HTMLElement>(null);
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<ContactGroup>("all");
  const [uni, setUni] = useState("");
  const [several, setSeveral] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [composing, setComposing] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const query = useDeferredValue(q.trim().toLowerCase());
  const search = useRef<HTMLInputElement>(null);
  useFullScreenOnPhones(shell);
  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) search.current?.focus();
  }, []);

  const unis = useMemo(() => [...new Set(contacts.map((c) => c.institution).filter(Boolean) as string[])].sort(), [contacts]);
  const shown = useMemo(
    () =>
      contacts.filter(
        (c) =>
          CONTACT_GROUPS[group].match(c) &&
          (!uni || c.institution === uni) &&
          (!query || [c.full_name, c.institution, c.committee_position].some((v) => v?.toLowerCase().includes(query))),
      ),
    [contacts, group, uni, query],
  );
  const allShownPicked = shown.length > 0 && shown.every((c) => picked.has(c.id));

  const open = (c: Contact) =>
    start(async () => {
      setError(null);
      setOpening(c.id);
      const res = await startConversation(c.id);
      if (!res.ok) {
        setOpening(null);
        setError(res.error);
        return;
      }
      refresh();
      router.push(`/portal/messages/${res.id}`);
    });

  const toggle = (id: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const pickAllShown = () =>
    setPicked((s) => {
      const n = new Set(s);
      if (allShownPicked) for (const c of shown) n.delete(c.id);
      else for (const c of shown) n.add(c.id);
      return n;
    });

  const pickedPeople = contacts.filter((c) => picked.has(c.id));

  return (
    <section
      ref={shell}
      aria-labelledby="new-title"
      className="fixed inset-x-0 top-0 z-[55] flex h-[100dvh] flex-col overflow-hidden bg-white lg:relative lg:z-auto lg:h-full lg:rounded-2xl lg:border lg:border-navy/10 lg:shadow-[0_24px_60px_-44px_rgba(12,24,44,0.55)]"
    >
      <header className="border-b border-navy/10 bg-white px-2 pb-3 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-3 lg:px-4 lg:pt-4">
        <div className="flex items-center gap-2">
          <Link href="/portal/messages" aria-label="Back to messages" className="grid size-11 shrink-0 place-items-center rounded-full text-ink hover:bg-paper-200 lg:hidden">
            <ArrowLeft aria-hidden className="size-5" />
          </Link>
          <h1 id="new-title" className="flex-1 font-display text-xl text-ink lg:text-2xl">
            {several ? "Group message" : "New message"}
          </h1>
          {committee && (
            <button
              type="button"
              onClick={() => {
                setSeveral((v) => !v);
                setPicked(new Set());
                setError(null);
              }}
              aria-pressed={several}
              className={cn(
                "inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition-colors",
                several ? "bg-navy text-paper" : "bg-gold/15 text-midnight ring-1 ring-gold/50 hover:bg-gold/25",
              )}
            >
              {several ? <X aria-hidden className="size-4" /> : <Users aria-hidden className="size-4" />}
              {several ? "Cancel" : "Several people"}
            </button>
          )}
        </div>
        {several && (
          <p className="mt-1.5 px-1 text-sm text-slate-700 lg:px-0">Tick who to send to. Each person gets the message in their own private conversation with you.</p>
        )}
        <div className="mt-3 px-1 lg:px-0">
          <label className="relative block">
            <span className="sr-only">Search people</span>
            <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name or university"
              ref={search}
              className="min-h-12 w-full rounded-xl border border-navy/15 bg-paper/40 pl-10 pr-3 text-base text-ink placeholder:text-slate focus:border-electric-600 focus:bg-white focus:outline-none lg:text-sm"
            />
          </label>
        </div>
        {committee && (
          <div className="mt-2.5 flex items-center gap-2 px-1 lg:px-0">
            <div className="-mx-1 flex flex-1 gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]">
              {(Object.keys(CONTACT_GROUPS) as ContactGroup[]).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGroup(g)}
                  aria-pressed={group === g}
                  className={cn(
                    "min-h-9 shrink-0 rounded-full px-3 text-xs font-semibold transition-colors",
                    group === g ? "bg-navy text-paper" : "bg-paper-200 text-slate-700 hover:bg-paper-300",
                  )}
                >
                  {CONTACT_GROUPS[g].label}
                </button>
              ))}
            </div>
          </div>
        )}
        {committee && unis.length > 1 && (
          <label className="mt-2 block px-1 lg:px-0">
            <span className="sr-only">University</span>
            <select value={uni} onChange={(e) => setUni(e.target.value)} className="min-h-10 w-full rounded-xl border border-navy/15 bg-white px-3 text-sm text-ink focus:border-electric-600 focus:outline-none">
              <option value="">All universities</option>
              {unis.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>

      {error && (
        <p role="alert" className="border-b border-danger/20 bg-danger/5 px-4 py-2.5 text-sm font-medium text-danger">
          {error}
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {unavailable ? (
          <p className="p-6 text-center text-sm text-slate-700">{unavailable}</p>
        ) : shown.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-700">{contacts.length ? "No one matches that search." : "There's no one to message yet."}</p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 px-4 pb-1 pt-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate">
                {shown.length} {shown.length === 1 ? "person" : "people"}
              </p>
              {several && (
                <button type="button" onClick={pickAllShown} className="min-h-9 text-sm font-semibold text-electric-600 hover:underline">
                  {allShownPicked ? "Untick everyone shown" : `Tick all ${shown.length}`}
                </button>
              )}
            </div>
            <ul className="pb-28 lg:pb-4">
              {shown.map((c) => (
                <li key={c.id}>
                  <PersonRow c={c} several={several} picked={picked.has(c.id)} busy={opening === c.id} onPick={() => (several ? toggle(c.id) : open(c))} committee={committee} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {several && picked.size > 0 && !composing && (
        <div className="absolute inset-x-0 bottom-0 border-t border-navy/10 bg-white/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:rounded-b-2xl">
          <button
            type="button"
            onClick={() => setComposing(true)}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-navy font-ui text-sm font-semibold text-paper shadow-[0_12px_30px_-14px_rgba(12,24,44,0.8)] hover:bg-navy-700"
          >
            Write to {picked.size} {picked.size === 1 ? "person" : "people"} <ChevronRight aria-hidden className="size-4" />
          </button>
        </div>
      )}

      {composing && (
        <GroupCompose
          people={pickedPeople}
          onBack={() => setComposing(false)}
          onSent={() => {
            refresh();
          }}
        />
      )}
    </section>
  );
}

function PersonRow({ c, several, picked, busy, onPick, committee }: { c: Contact; several: boolean; picked: boolean; busy: boolean; onPick: () => void; committee: boolean }) {
  const isCommittee = isCommitteeRole(c.roles);
  const role = headlineRole(c.roles, c.committee_position);
  const status = c.account_status !== "approved" ? ACCOUNT_STATUS_LABEL[c.account_status] : null;
  return (
    <button
      type="button"
      onClick={onPick}
      role={several ? "checkbox" : undefined}
      aria-checked={several ? picked : undefined}
      className={cn("flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-paper/70 active:bg-paper", picked && "bg-cyan-300/60")}
    >
      {several && (
        <span aria-hidden className={cn("grid size-6 shrink-0 place-items-center rounded-[6px] border-2 transition-colors", picked ? "border-navy bg-navy text-paper" : "border-navy/25 bg-white")}>
          {picked && <Check className="size-4" strokeWidth={3} />}
        </span>
      )}
      <span className="relative shrink-0">
        <Avatar url={c.photo} name={c.full_name} className={cn("size-11", isCommittee && "ring-2 ring-gold ring-offset-2 ring-offset-white")} fallbackClassName={isCommittee ? "bg-midnight text-xs text-gold-300" : "bg-navy text-xs text-cyan"} />
        {isCommittee && (
          <span aria-hidden className="absolute -bottom-0.5 -right-0.5 grid size-5 place-items-center rounded-full bg-midnight text-gold ring-2 ring-white">
            <ShieldCheck className="size-3" />
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-ink">{c.full_name}</span>
        <span className="block truncate text-xs text-slate-700">
          <span className={cn(isCommittee && "font-semibold text-gold-700")}>{role}</span>
          {c.institution && ` · ${c.institution}`}
        </span>
      </span>
      {committee && status && <span className="shrink-0 rounded-full bg-paper-200 px-2 py-0.5 text-[0.68rem] font-semibold text-slate-700">{status.label}</span>}
      {!several && (busy ? <Loader2 aria-hidden className="size-4 shrink-0 animate-spin text-slate" /> : <ChevronRight aria-hidden className="size-4 shrink-0 text-slate" />)}
    </button>
  );
}

function GroupCompose({ people, onBack, onSent }: { people: Contact[]; onBack: () => void; onSent: () => void }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const id = useId();
  const names = people.slice(0, 3).map((p) => p.full_name.split(/\s+/)[0]);
  const more = people.length - names.length;

  const send = () =>
    start(async () => {
      setError(null);
      if (viewingAs()) return setError("You're viewing as someone else, so messages are read only.");
      const res = await sendToMany(
        people.map((p) => p.id),
        body,
      );
      if (!res.ok) return setError(res.error);
      setDone(res.sent);
      onSent();
    });

  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-white lg:rounded-2xl">
      <header className="flex items-center gap-2 border-b border-navy/10 px-2 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-3 lg:px-4 lg:pt-4">
        <button type="button" onClick={onBack} aria-label="Back to choosing people" className="grid size-11 shrink-0 place-items-center rounded-full text-ink hover:bg-paper-200" disabled={pending}>
          <ArrowLeft aria-hidden className="size-5" />
        </button>
        <div className="min-w-0">
          <p className="font-display text-xl leading-tight text-ink">Group message</p>
          <p className="truncate text-xs text-slate-700">
            To {names.join(", ")}
            {more > 0 && ` and ${more} more`}
          </p>
        </div>
      </header>
      {done !== null ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <span className="grid size-16 place-items-center rounded-full bg-success/10 text-success">
            <CheckCircle2 aria-hidden className="size-8" />
          </span>
          <p className="mt-4 font-display text-2xl text-ink">Sent to {done} {done === 1 ? "person" : "people"}</p>
          <p className="mt-1.5 max-w-sm text-sm text-slate-700">Each person has it in their own conversation with you, and their replies come straight to your messages.</p>
          <button type="button" onClick={() => router.push("/portal/messages")} className="mt-6 min-h-12 rounded-xl bg-navy px-6 font-ui text-sm font-semibold text-paper hover:bg-navy-700">
            Back to messages
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <p className="mb-2 flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-gold-700">
              <Sparkles aria-hidden className="size-3.5" /> Start from a request
            </p>
            <div className="flex flex-wrap gap-1.5">
              {COMMITTEE_TEMPLATES.map((t) => (
                <button
                  key={t.label}
                  type="button"
                  onClick={() => setBody(fillTemplate(t.body, people.length === 1 ? people[0].full_name : null))}
                  className="min-h-9 rounded-full border border-gold/50 bg-gold/10 px-3 text-xs font-semibold text-midnight transition-colors hover:bg-gold/25"
                >
                  {t.label}
                </button>
              ))}
            </div>
            <label htmlFor={id} className="mt-5 block text-sm font-semibold text-ink">
              Your message
            </label>
            <textarea
              id={id}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              maxLength={DM_BODY_MAX}
              placeholder="Write your message…"
              className="mt-1.5 w-full rounded-xl border border-navy/15 bg-paper/40 px-4 py-3 text-base leading-relaxed text-ink focus:border-electric-600 focus:bg-white focus:outline-none lg:text-[0.95rem]"
            />
            <p className="mt-1 flex justify-between gap-3 text-xs text-slate">
              <span>It arrives from you, marked as from the INSPIRE committee.</span>
              <span className="tabular-nums">{DM_BODY_MAX - body.length} left</span>
            </p>
            {error && (
              <p role="alert" className="mt-3 text-sm font-medium text-danger">
                {error}
              </p>
            )}
          </div>
          <div className="border-t border-navy/10 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
            <button
              type="submit"
              disabled={pending || !body.trim()}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-navy font-ui text-sm font-semibold text-paper hover:bg-navy-700 disabled:opacity-50"
            >
              {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <SendHorizontal aria-hidden className="size-4" />}
              Send to {people.length} {people.length === 1 ? "person" : "people"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
