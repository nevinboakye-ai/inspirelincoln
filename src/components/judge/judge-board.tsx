"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronRight, CircleDashed, Lock, MapPin, PartyPopper, PencilLine, ScanLine, Search, UserCheck, Users, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";
import { KIND_LABEL, MIN_JUDGES, isComplete, isDone, judgesLabel, type BoardEntry, type JudgingKind } from "@/lib/judging";

type Filter = "todo" | "done" | "all";
const STORE = "judge-board-view";

/** A ring that fills as the judge works through their list. */
export function ProgressRing({ done, total, size = 76 }: { done: number; total: number; size?: number }) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const pct = total ? done / total : 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${done} of ${total} marked`}>
      <svg viewBox={`0 0 ${size} ${size}`} className="-rotate-90" width={size} height={size} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(255 255 255 / 0.12)" strokeWidth={8} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-gold)"
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <span aria-hidden className="absolute inset-0 grid place-items-center text-center font-display leading-none text-paper">
        <span>
          <span className="block text-xl">{done}</span>
          <span className="block text-[0.6rem] uppercase tracking-[0.14em] text-paper/60">of {total}</span>
        </span>
      </span>
    </div>
  );
}

function StatusPill({ e }: { e: BoardEntry }) {
  if (e.myStatus === "submitted")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
        <CheckCircle2 aria-hidden className="size-3.5" />
        {e.myTotal ?? 0}/{e.myMax ?? 0}
      </span>
    );
  if (e.closed)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-paper-200 px-2.5 py-1 text-xs font-semibold text-slate-700">
        <Lock aria-hidden className="size-3.5" /> Closed
      </span>
    );
  if (e.myStatus === "draft")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2.5 py-1 text-xs font-semibold text-[#7a4a00]">
        <PencilLine aria-hidden className="size-3.5" /> Draft
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-paper-200 px-2.5 py-1 text-xs font-semibold text-slate-700">
      <CircleDashed aria-hidden className="size-3.5" /> To mark
    </span>
  );
}

/** How many judges have submitted marks for this presenter, against the minimum of two. */
function JudgesCount({ e }: { e: BoardEntry }) {
  const complete = isComplete(e.marksIn);
  return (
    <span
      className={cn("inline-flex items-center gap-1 font-semibold", complete ? "text-success" : e.marksIn > 0 ? "text-[#7a4a00]" : "text-slate")}
      title={complete ? "Marking complete. More judges can still mark them." : `Needs ${MIN_JUDGES - e.marksIn} more judge${MIN_JUDGES - e.marksIn === 1 ? "" : "s"}`}
    >
      <Users aria-hidden className="size-3" />
      {judgesLabel(e.marksIn)}
    </span>
  );
}

/**
 * The judge's list: their progress, a switch between talks and posters, and
 * a search that works instantly on the phone (no trip to the server).
 */
export function JudgeBoard({
  firstName,
  queue,
  open,
  canMark,
}: {
  firstName: string | null;
  queue: BoardEntry[];
  open: boolean;
  canMark: boolean;
}) {
  const kinds = useMemo(() => (["oral", "poster"] as JudgingKind[]).filter((k) => queue.some((e) => e.kind === k)), [queue]);
  const [kind, setKind] = useState<JudgingKind>(kinds[0] ?? "poster");
  const [filter, setFilter] = useState<Filter>("todo");
  const [q, setQ] = useState("");

  // Come back to the same tab after marking someone.
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORE) ?? "null") as { kind?: JudgingKind; filter?: Filter } | null;
      if (saved?.kind && kinds.includes(saved.kind)) setKind(saved.kind);
      if (saved?.filter) setFilter(saved.filter);
    } catch {}
  }, [kinds]);
  useEffect(() => {
    try {
      sessionStorage.setItem(STORE, JSON.stringify({ kind, filter }));
    } catch {}
  }, [kind, filter]);

  const done = queue.filter(isDone).length;
  const ofKind = queue.filter((e) => e.kind === kind);
  const term = q.trim().toLowerCase();
  const shown = ofKind.filter(
    (e) =>
      (filter === "all" || (filter === "done" ? isDone(e) : !isDone(e))) &&
      (!term || [e.name, e.title, e.label, e.institution].some((v) => v?.toLowerCase().includes(term))),
  );
  const left = ofKind.filter((e) => !isDone(e)).length;
  const nextUp = queue.find((e) => !isDone(e));

  return (
    <div className="space-y-4">
      <header className="enter-up relative overflow-hidden rounded-2xl bg-midnight p-5 text-paper sm:p-6">
        <div aria-hidden className="lanyard-grid pointer-events-none absolute inset-0 opacity-15" />
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-gold/20 blur-3xl" />
        <div className="relative flex items-center gap-4">
          <ProgressRing done={done} total={queue.length} />
          <div className="min-w-0">
            <p className="eyebrow text-gold">INSPIRE judging</p>
            <h1 className="mt-1 font-display text-2xl leading-tight sm:text-3xl">{firstName ? `Welcome, ${firstName}` : "Your presentations"}</h1>
            <p className="mt-1 text-sm text-paper/70">
              {queue.length === 0
                ? "No presentations to mark yet."
                : done === queue.length
                  ? "You've marked everyone. Thank you!"
                  : `${queue.length - done} left to mark`}
            </p>
          </div>
        </div>
        {!open && (
          <p className="relative mt-4 rounded-lg bg-white/10 px-3 py-2 text-sm text-paper/85">Judging is closed. You can still read your marks, but they can&apos;t be changed.</p>
        )}
        {!canMark && (
          <p className="relative mt-4 rounded-lg bg-white/10 px-3 py-2 text-sm text-paper/85">You&apos;re viewing the judges&apos; list. Only judges can mark.</p>
        )}
        {nextUp && open && canMark && (
          <div className="relative mt-5 grid grid-cols-2 gap-2">
            <Link
              href={`/judge/${nextUp.presenterId}/${nextUp.kind}`}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gold px-3 text-sm font-semibold text-midnight transition-transform active:scale-[0.98]"
            >
              Mark next <ChevronRight aria-hidden className="size-4" />
            </Link>
            <Link
              href="/judge/scan"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-3 text-sm font-semibold text-paper transition-transform active:scale-[0.98]"
            >
              <ScanLine aria-hidden className="size-4" /> Scan a card
            </Link>
          </div>
        )}
      </header>

      {kinds.length > 1 && (
        <div role="tablist" aria-label="Kind of presentation" className="grid grid-cols-2 gap-1 rounded-xl bg-paper-200 p-1">
          {kinds.map((k) => {
            const n = queue.filter((e) => e.kind === k);
            return (
              <button
                key={k}
                role="tab"
                type="button"
                aria-selected={kind === k}
                onClick={() => setKind(k)}
                className={cn(
                  "flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors",
                  kind === k ? "bg-white text-ink shadow-sm" : "text-slate-700",
                )}
              >
                {KIND_LABEL[k].many}
                <span className={cn("rounded-full px-2 py-0.5 text-xs", kind === k ? "bg-navy text-paper" : "bg-white/70")}>
                  {n.filter(isDone).length}/{n.length}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Search by name, title or board</span>
          <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, title or board"
            className="min-h-12 w-full rounded-xl border border-navy/15 bg-white pl-10 pr-10 text-base text-ink placeholder:text-slate focus:border-navy focus:outline-none focus:ring-4 focus:ring-electric/15"
          />
          {q && (
            <button type="button" onClick={() => setQ("")} className="absolute right-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-slate hover:bg-paper-200" aria-label="Clear search">
              <X aria-hidden className="size-4" />
            </button>
          )}
        </label>
        <div role="group" aria-label="Show" className="flex gap-1">
          {(
            [
              ["todo", `To mark (${left})`],
              ["done", "Marked"],
              ["all", "All"],
            ] as [Filter, string][]
          ).map(([f, label]) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                "min-h-11 flex-1 whitespace-nowrap rounded-xl border px-3 text-sm font-semibold transition-colors sm:flex-none",
                filter === f ? "border-navy bg-navy text-paper" : "border-navy/15 bg-white text-slate-700",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-navy/10 bg-white p-8 text-center">
          {filter === "todo" && !term && ofKind.length > 0 ? (
            <>
              <PartyPopper aria-hidden className="mx-auto size-8 text-gold-600" />
              <p className="mt-3 font-display text-xl text-ink">All {KIND_LABEL[kind].many.toLowerCase()} marked</p>
              <p className="mt-1 text-sm text-slate-700">Switch to “Marked” to read or change your marks.</p>
            </>
          ) : (
            <p className="text-slate-700">{term ? "Nobody matches that search." : `No ${KIND_LABEL[kind].many.toLowerCase()} here yet.`}</p>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {shown.map((e, i) => (
            <li key={`${e.presenterId}-${e.kind}`} className="enter-up" style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}>
              <Link
                href={`/judge/${e.presenterId}/${e.kind}`}
                className={cn(
                  "group flex items-center gap-3 rounded-2xl border bg-white p-3 transition-[transform,box-shadow,border-color] active:scale-[0.99] sm:p-4",
                  isDone(e) ? "border-success/25" : "border-navy/10 hover:border-navy/30 hover:shadow-[0_14px_30px_-22px_rgba(14,27,49,0.5)]",
                )}
              >
                <span className="relative">
                  <Avatar url={e.avatarUrl} name={e.name} className="size-12 text-sm" fallbackClassName="bg-navy text-cyan" />
                  {e.checkedIn && (
                    <span className="absolute -bottom-0.5 -right-0.5 grid size-5 place-items-center rounded-full border-2 border-white bg-success text-white" title="Checked in">
                      <UserCheck aria-hidden className="size-2.5" />
                      <span className="sr-only">Checked in</span>
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {e.label && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-gold/20 px-1.5 py-0.5 text-[0.7rem] font-bold uppercase tracking-wide text-gold-700">
                        <MapPin aria-hidden className="size-3" />
                        {e.label}
                      </span>
                    )}
                    <span className="truncate font-semibold text-ink">{e.name}</span>
                  </span>
                  {e.title && <span className="mt-0.5 line-clamp-2 text-sm leading-snug text-slate-700">{e.title}</span>}
                  <span className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-slate">
                    <JudgesCount e={e} />
                    {e.institution && <span className="truncate">{e.institution}</span>}
                    {e.attendance === "unavailable" && <span className="font-semibold text-danger">Said they can&apos;t attend</span>}
                    {e.assigned && <span className="font-semibold text-electric-600">On your list</span>}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-2">
                  <StatusPill e={e} />
                  <ChevronRight aria-hidden className="size-4 text-slate transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
