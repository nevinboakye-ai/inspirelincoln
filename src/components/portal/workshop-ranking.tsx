"use client";
import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowRight, ArrowUp, Check, Clock, GripVertical, Loader2, Lock, Sparkles } from "lucide-react";
import { saveWorkshopRanking } from "@/app/portal/workshop-actions";
import { cn } from "@/lib/cn";
import { viewingAs } from "@/lib/view-as-client";

export type RankWorkshop = { id: string; slug: string; title: string; strapline: string; pair: string | null; slot: number | null; time: string | null };
export type RankPlace = { slot: number; time: string | null; room: string | null; workshop: RankWorkshop; choice: number | null };

const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;
const when = (d: string) =>
  new Date(d).toLocaleString("en-GB", { timeZone: "Europe/London", weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" });
const savedWhen = (d: string) =>
  new Date(d).toLocaleString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/**
 * On My Hub: delegates put the six workshops in order of preference. Each
 * row moves with its arrow buttons (keyboard and screen readers) or by
 * dragging the handle (mouse and touch). Once the committee publishes the
 * allocation, the card shows the three workshops each person goes to.
 */
export function WorkshopRanking({
  workshops,
  initial,
  rankedAt,
  open,
  closesAt,
  places,
}: {
  workshops: RankWorkshop[];
  initial: string[] | null;
  rankedAt: string | null;
  open: boolean;
  closesAt: string | null;
  places: RankPlace[] | null;
}) {
  const byId = useMemo(() => new Map(workshops.map((w) => [w.id, w])), [workshops]);
  const start = initial && initial.every((id) => byId.has(id)) && initial.length === workshops.length ? initial : workshops.map((w) => w.id);
  const [order, setOrder] = useState<string[]>(start);
  const [saved, setSaved] = useState<string[] | null>(initial ? start : null);
  const [savedAt, setSavedAt] = useState<string | null>(rankedAt);
  const [error, setError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const [pending, startSave] = useTransition();
  const [dragging, setDragging] = useState<string | null>(null);
  const rows = useRef(new Map<string, HTMLLIElement>());
  const focusNext = useRef<{ id: string; dir: "up" | "down" } | null>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const headingId = useId();
  const hintId = useId();
  const dirty = !saved || saved.join() !== order.join();

  // Keep keyboard focus on the row that moved.
  useEffect(() => {
    const f = focusNext.current;
    if (!f) return;
    focusNext.current = null;
    const i = order.indexOf(f.id);
    const dir = (f.dir === "up" && i === 0) || (f.dir === "down" && i === order.length - 1) ? (f.dir === "up" ? "down" : "up") : f.dir;
    buttons.current.get(`${f.id}:${dir}`)?.focus();
  }, [order]);

  const move = (id: string, to: number, how: "keys" | "drag" = "keys") => {
    setOrder((o) => {
      const from = o.indexOf(id);
      if (from < 0 || to < 0 || to >= o.length || from === to) return o;
      const next = [...o];
      next.splice(from, 1);
      next.splice(to, 0, id);
      if (how === "keys") setAnnounce(`${byId.get(id)?.title} moved to ${ordinal(to + 1)} of ${o.length}.`);
      return next;
    });
    setError(null);
  };

  const onPointerDown = (id: string) => (e: React.PointerEvent) => {
    if (!open) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(id);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    // Where the dragged row would land among the others, by their middles.
    const others = order.filter((x) => x !== dragging);
    let to = others.length;
    for (let k = 0; k < others.length; k++) {
      const r = rows.current.get(others[k]!)?.getBoundingClientRect();
      if (r && e.clientY < r.top + r.height / 2) {
        to = k;
        break;
      }
    }
    if (to !== order.indexOf(dragging)) move(dragging, to, "drag");
  };
  const onPointerUp = () => {
    if (dragging) setAnnounce(`${byId.get(dragging)?.title} placed ${ordinal(order.indexOf(dragging) + 1)} of ${order.length}.`);
    setDragging(null);
  };

  const save = () =>
    startSave(async () => {
      setError(null);
      if (viewingAs()) return setError("You're viewing as someone else, so changes are switched off.");
      const r = await saveWorkshopRanking(order);
      if (r.ok) {
        setSaved(order);
        setSavedAt(r.savedAt);
        setAnnounce("Your ranking is saved.");
      } else setError(r.error);
    });

  // Results are out: show where they're going.
  if (places && places.length) {
    return (
      <section aria-labelledby={headingId} className="overflow-hidden rounded-xl border border-navy/10 bg-white">
        <div className="relative overflow-hidden bg-midnight px-5 py-5 text-paper sm:px-7">
          <div aria-hidden className="lanyard-grid pointer-events-none absolute inset-0 opacity-20" />
          <p className="eyebrow relative text-gold">Workshops</p>
          <h2 id={headingId} className="relative mt-1 font-display text-2xl">Your workshops</h2>
          <p className="relative mt-1 text-sm text-paper/75">One in each workshop session. Head to each room a few minutes early.</p>
        </div>
        <ol className="divide-y divide-navy/10">
          {places.map((p) => (
            <li key={p.slot} className="flex items-center gap-x-4 px-5 py-4 sm:px-7">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-navy font-ui text-sm font-bold text-cyan" aria-hidden>
                {p.workshop.pair ?? p.slot}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">
                  Session {p.slot}
                  {p.time ? ` · ${p.time}` : ""}
                  {p.room ? ` · ${p.room}` : ""}
                </span>
                <Link href={`/workshops/${p.workshop.slug}`} className="mt-0.5 block font-semibold text-ink underline-offset-4 hover:underline">
                  {p.workshop.title}
                </Link>
                {p.choice && (
                  <span className={cn("mt-1.5 inline-block rounded-full px-2.5 py-1 font-ui text-xs font-semibold sm:hidden", p.choice <= 3 ? "bg-success/10 text-success" : "bg-paper-200 text-slate-700")}>
                    Your {ordinal(p.choice)} choice
                  </span>
                )}
              </span>
              {p.choice && (
                <span className={cn("hidden rounded-full px-2.5 py-1 font-ui text-xs font-semibold sm:inline-block", p.choice <= 3 ? "bg-success/10 text-success" : "bg-paper-200 text-slate-700")}>
                  Your {ordinal(p.choice)} choice
                </span>
              )}
            </li>
          ))}
        </ol>
      </section>
    );
  }

  const partnerAbove = (id: string, index: number) => {
    const w = byId.get(id);
    if (!w?.slot) return null;
    const j = order.findIndex((x, k) => k < index && byId.get(x)?.slot === w.slot);
    return j >= 0 ? j + 1 : null;
  };

  return (
    <section aria-labelledby={headingId} className={cn("relative scroll-mt-28 overflow-hidden rounded-xl border bg-white", open && !saved ? "border-gold/50 shadow-[0_18px_40px_-28px_rgba(14,27,49,0.55)]" : "border-navy/10")} id="workshops">
      {open && !saved && <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-gold" />}
      <p role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>
      <div className="p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={headingId} className="flex items-center gap-2 font-display text-xl text-ink">
              <Sparkles aria-hidden className="size-5 text-electric-600" /> {open ? "Choose your workshops" : "Your workshop ranking"}
            </h2>
            <p id={hintId} className="mt-2 max-w-2xl text-sm text-slate-700">
              {open ? (
                <>
                  Put all six in order, your favourite first. Two workshops run at the same time in each session, so you&apos;ll go to one from each
                  session. We&apos;ll give you your top choices wherever the rooms allow.
                </>
              ) : saved ? (
                <>Ranking has closed. The committee is now sorting out places, and your three workshops will appear here.</>
              ) : (
                <>Ranking has closed. The committee will give you a place in each workshop session, and your three workshops will appear here.</>
              )}
            </p>
          </div>
          {open && closesAt && (
            <p className="inline-flex items-center gap-1.5 rounded-full bg-paper-200 px-3 py-1.5 text-xs font-semibold text-slate-700">
              <Clock aria-hidden className="size-3.5" /> Closes {when(closesAt)}
            </p>
          )}
          {!open && (
            <p className="inline-flex items-center gap-1.5 rounded-full bg-paper-200 px-3 py-1.5 text-xs font-semibold text-slate-700">
              <Lock aria-hidden className="size-3.5" /> Closed
            </p>
          )}
        </div>

        {(open || saved) && (
          <ol
            aria-describedby={hintId}
            className={cn("mt-5 space-y-2", dragging && "cursor-grabbing select-none")}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {order.map((id, i) => {
              const w = byId.get(id)!;
              const clash = partnerAbove(id, i);
              const top = i < 3;
              return (
                <li
                  key={id}
                  ref={(el) => {
                    if (el) rows.current.set(id, el);
                    else rows.current.delete(id);
                  }}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border px-3 py-3 transition-[box-shadow,background-color,border-color] sm:gap-4 sm:px-4",
                    dragging === id ? "z-10 border-electric-600 bg-white shadow-[0_18px_36px_-18px_rgba(14,27,49,0.55)]" : top ? "border-navy/15 bg-paper/50" : "border-navy/10 bg-white",
                  )}
                >
                  {open && (
                    <span
                      aria-hidden
                      onPointerDown={onPointerDown(id)}
                      className="hidden cursor-grab touch-none text-slate hover:text-ink sm:grid sm:place-items-center"
                      title="Drag to reorder"
                    >
                      <GripVertical className="size-5" />
                    </span>
                  )}
                  <span
                    aria-hidden
                    onPointerDown={open ? onPointerDown(id) : undefined}
                    className={cn(
                      "grid size-9 shrink-0 touch-none place-items-center rounded-full font-ui text-sm font-bold",
                      open && "cursor-grab",
                      i === 0 ? "bg-gold text-midnight" : top ? "bg-navy text-paper" : "bg-paper-200 text-slate-700",
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="sr-only">{ordinal(i + 1)} choice: </span>
                    <span className="block font-semibold leading-snug text-ink">{w.title}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-700">
                      {w.pair && (
                        <span className="font-semibold text-navy">
                          Workshop {w.pair}
                          {w.time ? ` · ${w.time}` : ""}
                        </span>
                      )}
                      {clash && <span>Same time as your {ordinal(clash)} choice</span>}
                    </span>
                  </span>
                  {open && (
                    <span className="flex shrink-0 flex-col gap-1 sm:flex-row">
                      {(["up", "down"] as const).map((dir) => {
                        const disabled = dir === "up" ? i === 0 : i === order.length - 1;
                        const Icon = dir === "up" ? ArrowUp : ArrowDown;
                        return (
                          <button
                            key={dir}
                            type="button"
                            ref={(el) => {
                              if (el) buttons.current.set(`${id}:${dir}`, el);
                              else buttons.current.delete(`${id}:${dir}`);
                            }}
                            disabled={disabled}
                            onClick={() => {
                              focusNext.current = { id, dir };
                              move(id, dir === "up" ? i - 1 : i + 1);
                            }}
                            aria-label={`Move ${w.title} ${dir}`}
                            className="grid size-11 place-items-center rounded-full border border-navy/15 bg-white text-ink transition-colors hover:border-navy/40 disabled:cursor-not-allowed disabled:opacity-35 sm:size-10"
                          >
                            <Icon aria-hidden className="size-4" />
                          </button>
                        );
                      })}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        )}

        {open && (
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p role={error ? "alert" : undefined} className={cn("text-sm", error ? "font-medium text-danger" : "text-slate-700")}>
              {error ??
                (pending
                  ? "Saving…"
                  : !saved
                    ? "Not saved yet. Your ranking only counts once you save it."
                    : dirty
                      ? "You have changes that aren't saved yet."
                      : savedAt
                        ? (
                            <span className="inline-flex items-center gap-1.5 font-medium text-success">
                              <Check aria-hidden className="size-4" /> Saved {savedWhen(savedAt)}. You can change it until ranking closes.
                            </span>
                          )
                        : "Saved.")}
            </p>
            <button
              type="button"
              onClick={save}
              disabled={pending || !dirty}
              className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-[3px] bg-navy px-6 font-ui text-sm font-semibold text-paper hover:bg-navy-700 disabled:opacity-60"
            >
              {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Check aria-hidden className="size-4" />}
              {saved ? "Save changes" : "Save my ranking"}
            </button>
          </div>
        )}
        <p className="mt-4 text-sm">
          <Link href="/workshops" className="inline-flex items-center gap-1 font-semibold text-electric-600 underline-offset-4 hover:underline">
            Read about the workshops <ArrowRight aria-hidden className="size-3.5" />
          </Link>
        </p>
      </div>
    </section>
  );
}
