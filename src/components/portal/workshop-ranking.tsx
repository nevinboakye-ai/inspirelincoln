"use client";
import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Check, Clock, Eye, GripVertical, Info, Loader2, Lock, RotateCcw, Sparkles } from "lucide-react";
import { saveWorkshopRanking } from "@/app/portal/workshop-actions";
import { WorkshopInfo, type InfoWorkshop } from "@/components/portal/workshop-info";
import { Overlay } from "@/components/ui/overlay";
import { cn } from "@/lib/cn";
import { viewingAs } from "@/lib/view-as-client";
import { workshopColour } from "@/lib/workshops/colours";

export type RankWorkshop = InfoWorkshop;
export type RankPlace = { slot: number; time: string | null; room: string | null; workshop: RankWorkshop; choice: number | null };

/** How many workshops each delegate goes to: one per session. */
const GO_TO = 3;

const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;
const when = (d: string) =>
  new Date(d)
    .toLocaleString("en-GB", { timeZone: "Europe/London", weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", hour12: true })
    .replace(":00", "")
    .replace(" at ", ", ");
const savedWhen = (d: string) =>
  new Date(d).toLocaleString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/**
 * On My Hub: all six workshops run in each of the three sessions, so each
 * delegate goes to three of the six. Delegates rank all six from 1 to 6.
 * Each row moves with its arrow buttons (keyboard and screen readers) or by
 * dragging (mouse and touch), and "More info" opens the full details over
 * the page. Once the committee publishes places, the card shows the three
 * workshops each person is going to.
 */
export function WorkshopRanking({
  workshops,
  initial,
  rankedAt,
  open: openProp,
  closesAt,
  places,
  preview = false,
  canEdit = false,
}: {
  workshops: RankWorkshop[];
  initial: string[] | null;
  rankedAt: string | null;
  open: boolean;
  closesAt: string | null;
  places: RankPlace[] | null;
  /** Committee preview while ranking is closed: reorder freely, nothing is saved. */
  preview?: boolean;
  /** Committee members who can edit the website can change a workshop's wording from its info card. */
  canEdit?: boolean;
}) {
  const open = openProp || preview;
  const byId = useMemo(() => new Map(workshops.map((w) => [w.id, w])), [workshops]);
  const start = initial && initial.length === workshops.length && initial.every((id) => byId.has(id)) ? initial : workshops.map((w) => w.id);
  const [order, setOrder] = useState<string[]>(start);
  const [saved, setSaved] = useState<string[] | null>(initial ? start : null);
  const [savedAt, setSavedAt] = useState<string | null>(rankedAt);
  const [error, setError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const [pending, startSave] = useTransition();
  const [dragging, setDragging] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const rows = useRef(new Map<string, HTMLLIElement>());
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const focusNext = useRef<{ id: string; dir: "up" | "down" } | null>(null);
  const headingId = useId();
  const dirty = !saved || saved.join() !== order.join();
  const top = Math.min(GO_TO, workshops.length);

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
      if (how === "keys") setAnnounce(`${byId.get(id)?.title} moved to ${ordinal(to + 1)}${to < top ? ", in your top three" : ""}.`);
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
    if (dragging) setAnnounce(`${byId.get(dragging)?.title} placed ${ordinal(order.indexOf(dragging) + 1)}.`);
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

  const shown = info ? byId.get(info) : undefined;
  const closeInfo = () => {
    setInfo(null);
    setEditing(false);
  };
  const placeOf = (id: string) => places?.find((p) => p.workshop.id === id);
  const noteFor = (id: string) => {
    const p = placeOf(id);
    if (p) return `You're going to this in session ${p.slot}${p.time ? `, ${p.time}` : ""}.`;
    if (places?.length) return null;
    const i = order.indexOf(id);
    return i >= 0 && (open || saved) ? `${saved && !dirty ? "You've ranked this" : "This is"} ${ordinal(i + 1)}${i < top ? ", in your top three" : ""}.` : null;
  };
  const infoCard = (
    <Overlay open={Boolean(shown)} onClose={closeInfo} labelledBy={`${headingId}-info`}>
      {shown && (
        <WorkshopInfo
          w={shown}
          titleId={`${headingId}-info`}
          editing={editing}
          canEdit={canEdit}
          onEdit={() => setEditing(true)}
          onDoneEditing={() => setEditing(false)}
          note={noteFor(shown.id)}
        />
      )}
    </Overlay>
  );
  /** The workshop's title opens its full details, so no separate "More info" button takes up room. */
  const titleButton = (w: RankWorkshop, strap = false) => (
    <button
      type="button"
      onClick={() => setInfo(w.id)}
      className="group block min-h-10 w-full rounded-md py-0.5 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-electric/30"
    >
      <span className="block text-sm font-semibold leading-snug text-ink group-hover:underline group-hover:underline-offset-4 sm:text-[0.95rem]">
        {w.title}
        <Info aria-hidden className="ml-1.5 inline size-3.5 -translate-y-px text-electric-600" />
        <span className="sr-only">, more info</span>
      </span>
      {strap && w.strapline && <span className="mt-0.5 hidden truncate text-xs leading-snug text-slate-700 lg:block">{w.strapline}</span>}
    </button>
  );

  // Places are out: show where they're going.
  if (places && places.length) {
    return (
      <section aria-labelledby={headingId} id="workshops" className="scroll-mt-28 overflow-hidden rounded-xl border border-navy/10 bg-white">
        <div className="relative overflow-hidden bg-midnight px-4 py-3.5 text-paper sm:px-5">
          <div aria-hidden className="lanyard-grid pointer-events-none absolute inset-0 opacity-20" />
          <p className="eyebrow relative text-gold">Workshops</p>
          <h2 id={headingId} className="relative mt-0.5 font-display text-xl">
            Your workshops
          </h2>
          <p className="relative mt-0.5 text-sm text-paper/75">One in each session. Head to each room a few minutes early.</p>
        </div>
        <ol className="divide-y divide-navy/10">
          {[...places].sort((a, b) => a.slot - b.slot).map((p) => {
            const c = workshopColour(p.workshop.number);
            return (
              <li key={p.slot} className="relative flex items-center gap-3 py-2.5 pl-5 pr-2 sm:pl-6 sm:pr-3">
                <span aria-hidden className="absolute inset-y-0 left-0 w-1.5" style={{ background: c.solid }} />
                <span className="grid size-9 shrink-0 place-items-center rounded-full font-ui text-sm font-bold text-white" style={{ background: c.solid }} aria-hidden>
                  {p.slot}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">
                    <span>
                      Session {p.slot}
                      {p.time ? ` · ${p.time}` : ""}
                      {p.room ? ` · ${p.room}` : ""}
                    </span>
                    {p.choice && (
                      <span className={cn("rounded-full px-2 py-0.5 font-ui text-[0.68rem] normal-case tracking-normal", p.choice <= top ? "bg-success/10 text-success" : "bg-paper-200 text-slate-700")}>
                        Your {ordinal(p.choice)} choice
                      </span>
                    )}
                  </span>
                  {titleButton(p.workshop)}
                </span>
              </li>
            );
          })}
        </ol>
        {infoCard}
      </section>
    );
  }

  const row = (id: string, i: number) => {
    const w = byId.get(id)!;
    const c = workshopColour(w.number);
    const inTop = i < top;
    return (
      <li
        key={id}
        ref={(el) => {
          if (el) rows.current.set(id, el);
          else rows.current.delete(id);
        }}
        className={cn(
          "relative flex items-center gap-2.5 overflow-hidden rounded-lg border bg-white py-1.5 pl-4 pr-1.5 transition-[box-shadow,border-color] sm:gap-3 sm:pl-5 sm:pr-2",
          dragging === id ? "z-10 border-electric-600 shadow-[0_18px_36px_-18px_rgba(14,27,49,0.55)]" : "border-navy/15",
        )}
        style={inTop && dragging !== id ? { background: c.tint } : undefined}
      >
        <span aria-hidden className="absolute inset-y-0 left-0 w-1.5" style={{ background: c.solid }} />
        {open && (
          <span aria-hidden onPointerDown={onPointerDown(id)} className="hidden cursor-grab touch-none text-slate hover:text-ink sm:grid sm:place-items-center" title="Drag to reorder">
            <GripVertical className="size-4" />
          </span>
        )}
        <span
          aria-hidden
          onPointerDown={open ? onPointerDown(id) : undefined}
          className={cn("grid size-8 shrink-0 touch-none place-items-center rounded-full font-ui text-sm font-bold", open && "cursor-grab", inTop ? "text-white" : "border-2 bg-white text-ink")}
          style={inTop ? { background: c.solid } : { borderColor: c.solid }}
        >
          {i + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className="sr-only">{ordinal(i + 1)}: </span>
          {titleButton(w, true)}
        </span>
        {open && (
          <span className="flex shrink-0 gap-1">
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
                  className="grid size-10 place-items-center rounded-full border border-navy/15 bg-white text-ink transition-colors hover:border-navy/40 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <Icon aria-hidden className="size-4" />
                </button>
              );
            })}
          </span>
        )}
      </li>
    );
  };

  return (
    <section
      aria-labelledby={headingId}
      className={cn("relative scroll-mt-28 overflow-hidden rounded-xl border bg-white", open && !saved && !preview ? "border-gold/50 shadow-[0_18px_40px_-28px_rgba(14,27,49,0.55)]" : "border-navy/10")}
      id="workshops"
    >
      {open && !saved && !preview && <span aria-hidden className="absolute inset-y-0 left-0 z-[1] w-1.5 bg-gold" />}
      <p role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>
      {preview && (
        <div className="flex items-start gap-3 border-b border-gold/40 bg-gold/10 px-4 py-2.5 text-sm text-ink sm:px-5">
          <Eye aria-hidden className="mt-0.5 size-4 shrink-0" />
          <p>
            <strong>Preview for the committee.</strong> Delegates see this card once you open ranking on{" "}
            <Link href="/admin/workshops" className="font-semibold underline underline-offset-4">
              Workshop places
            </Link>
            . Try moving the workshops around and opening &ldquo;More info&rdquo;; nothing here is saved.
          </p>
        </div>
      )}
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          <h2 id={headingId} className="flex items-center gap-2 font-display text-xl text-ink">
            <Sparkles aria-hidden className="size-5 text-electric-600" /> {open ? "Rank your workshops" : "Your workshop ranking"}
          </h2>
          {!open && (
            <p className="inline-flex items-center gap-1.5 rounded-full bg-paper-200 px-3 py-1 text-xs font-semibold text-slate-700">
              <Lock aria-hidden className="size-3.5" /> Closed
            </p>
          )}

          {open && !preview && closesAt && (
            <p className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-ink", saved ? "bg-paper-200" : "bg-gold/25")}>
              <Clock aria-hidden className="size-3.5" /> Rank by {when(closesAt)}
            </p>
          )}
        </div>
        {open ? (
          <p className="mt-2 text-sm leading-snug text-slate-700">
            All {workshops.length} run in each session and you go to {GO_TO}, one per session. We aim for your top {GO_TO} and use the rest if a room fills. Select a title for details.
          </p>
        ) : (
          <p className="mt-2 max-w-2xl text-sm text-slate-700">
            {saved
              ? `Ranking has closed. The committee is now sorting out places, and your ${GO_TO} workshops will appear here.`
              : `Ranking has closed. The committee will give you a workshop in each of the three sessions, and your ${GO_TO} workshops will appear here.`}
          </p>
        )}

        {(open || saved) && (
          <div className={cn("mt-3", dragging && "cursor-grabbing select-none")} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
            <h3 id={`${headingId}-top`} className="flex flex-wrap items-baseline gap-x-2 font-ui text-xs font-semibold uppercase tracking-[0.14em] text-ink">
              Your top {top} <span className="font-normal normal-case tracking-normal text-slate-700">the workshops we&apos;ll aim to give you</span>
            </h3>
            <ol aria-labelledby={`${headingId}-top`} className="mt-1.5 space-y-1.5">
              {order.slice(0, top).map((id, i) => row(id, i))}
            </ol>
            {order.length > top && (
              <>
                <h3 id={`${headingId}-rest`} className="mt-3 flex flex-wrap items-baseline gap-x-2 font-ui text-xs font-semibold uppercase tracking-[0.14em] text-ink">
                  Back-ups <span className="font-normal normal-case tracking-normal text-slate-700">used if one of your top {top} is full</span>
                </h3>
                <ol start={top + 1} aria-labelledby={`${headingId}-rest`} className="mt-1.5 space-y-1.5">
                  {order.slice(top).map((id, k) => row(id, top + k))}
                </ol>
              </>
            )}
          </div>
        )}

        {preview && (
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-700">Delegates press &ldquo;Save my ranking&rdquo; here. In this preview the button is switched off.</p>
            <button
              type="button"
              onClick={() => {
                setOrder(start);
                setAnnounce("Order reset.");
              }}
              className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-[3px] border border-navy/20 bg-white px-6 font-ui text-sm font-semibold text-ink hover:bg-paper-200"
            >
              <RotateCcw aria-hidden className="size-4" /> Reset the order
            </button>
          </div>
        )}
        {open && !preview && (
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p role={error ? "alert" : undefined} className={cn("text-sm", error ? "font-medium text-danger" : "text-slate-700")}>
              {error ??
                (pending ? (
                  "Saving…"
                ) : !saved ? (
                  closesAt ? "Not saved yet. If you don't save a ranking before the deadline, we'll place you in workshops that still have space." : "Not saved yet. Your ranking only counts once you save it."
                ) : dirty ? (
                  "You have changes that aren't saved yet."
                ) : savedAt ? (
                  <span className="inline-flex items-center gap-1.5 font-medium text-success">
                    <Check aria-hidden className="size-4" /> Saved {savedWhen(savedAt)}. You can change it until ranking closes.
                  </span>
                ) : (
                  "Saved."
                ))}
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
      </div>
      {infoCard}
    </section>
  );
}
