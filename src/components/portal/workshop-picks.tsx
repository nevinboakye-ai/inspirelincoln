"use client";
import Link from "next/link";
import { useId, useMemo, useState, useTransition } from "react";
import { ArrowRight, Check, Clock, Eye, Info, Loader2, Lock, Pencil, RotateCcw, Sparkles, Target, UserRound, Users } from "lucide-react";
import { saveWorkshopRanking } from "@/app/portal/workshop-actions";
import { WorkshopTextEditor } from "@/components/conference/workshop-text-editor";
import { Overlay } from "@/components/ui/overlay";
import { cn } from "@/lib/cn";
import { viewingAs } from "@/lib/view-as-client";
import { workshopColour } from "@/lib/workshops/colours";

export type PickWorkshop = {
  id: string;
  number: number;
  slug: string;
  title: string;
  strapline: string | null;
  summary: string | null;
  description: string | null;
  topics: string[];
  outcomes: string[];
  audience: string | null;
  facilitator: string | null;
  pair: string | null;
  slot: number | null;
  time: string | null;
};
export type PickPlace = { slot: number; time: string | null; room: string | null; workshop: PickWorkshop; choice: number | null };

const when = (d: string) =>
  new Date(d).toLocaleString("en-GB", { timeZone: "Europe/London", weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" });
const savedWhen = (d: string) =>
  new Date(d).toLocaleString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/**
 * Turns three picks into the stored preference order: the picked workshop
 * in each session first, then the other one. The allocation only ever
 * compares the two workshops in a session, so this is all it needs.
 */
const toRanking = (sessions: { slot: number; options: PickWorkshop[] }[], picks: Record<number, string>) => {
  const chosen = sessions.map((s) => picks[s.slot]!);
  const others = sessions.map((s) => s.options.find((w) => w.id !== picks[s.slot])!.id);
  return [...chosen, ...others];
};

/**
 * On My Hub: in each of the three workshop sessions, two workshops run at
 * once, and delegates pick the one they'd rather go to. Each option has an
 * info button that opens the full details over the page. Once the committee
 * publishes places, the card shows where each person is going.
 */
export function WorkshopPicks({
  workshops,
  initial,
  rankedAt,
  open: openProp,
  closesAt,
  places,
  preview = false,
  canEdit = false,
}: {
  workshops: PickWorkshop[];
  initial: string[] | null;
  rankedAt: string | null;
  open: boolean;
  closesAt: string | null;
  places: PickPlace[] | null;
  /** Committee preview while choices are closed: pick freely, nothing is saved. */
  preview?: boolean;
  /** Committee members who can edit the website can change a workshop's wording from its info card. */
  canEdit?: boolean;
}) {
  const open = openProp || preview;
  const headingId = useId();
  const sessions = useMemo(() => {
    const slots = [...new Set(workshops.map((w) => w.slot).filter((s): s is number => s != null))].sort();
    return slots.map((slot) => ({
      slot,
      time: workshops.find((w) => w.slot === slot)?.time ?? null,
      options: workshops.filter((w) => w.slot === slot).sort((a, b) => (a.pair ?? "").localeCompare(b.pair ?? "")),
    }));
  }, [workshops]);
  const ready = sessions.length > 0 && sessions.every((s) => s.options.length === 2) && workshops.every((w) => w.pair);

  // The saved picks: in each session, whichever of the two came first in the stored order.
  const start = useMemo(() => {
    const out: Record<number, string> = {};
    if (!initial) return out;
    for (const s of sessions) {
      const [a, b] = s.options;
      if (!a || !b) continue;
      const ia = initial.indexOf(a.id);
      const ib = initial.indexOf(b.id);
      if (ia >= 0 && ib >= 0) out[s.slot] = ia < ib ? a.id : b.id;
    }
    return out;
  }, [initial, sessions]);

  const [picks, setPicks] = useState<Record<number, string>>(start);
  const [saved, setSaved] = useState<Record<number, string> | null>(initial ? start : null);
  const [savedAt, setSavedAt] = useState<string | null>(rankedAt);
  const [error, setError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const [pending, startSave] = useTransition();
  const [info, setInfo] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const complete = sessions.length > 0 && sessions.every((s) => picks[s.slot]);
  const dirty = !saved || sessions.some((s) => saved[s.slot] !== picks[s.slot]);
  const missing = sessions.filter((s) => !picks[s.slot]).length;
  const byId = useMemo(() => new Map(workshops.map((w) => [w.id, w])), [workshops]);
  const shown = info ? byId.get(info) : undefined;

  const choose = (slot: number, id: string) => {
    setPicks((p) => ({ ...p, [slot]: id }));
    setError(null);
    const w = byId.get(id);
    if (w) setAnnounce(`${w.pair}, ${w.title}, chosen for session ${slot}.`);
  };

  const save = () =>
    startSave(async () => {
      setError(null);
      if (viewingAs()) return setError("You're viewing as someone else, so changes are switched off.");
      if (!complete) return setError(`Choose a workshop in ${missing === 1 ? "the last session" : `all ${sessions.length} sessions`} first.`);
      const r = await saveWorkshopRanking(toRanking(sessions, picks));
      if (r.ok) {
        setSaved(picks);
        setSavedAt(r.savedAt);
        setAnnounce("Your workshop choices are saved.");
      } else setError(r.error);
    });

  const closeInfo = () => {
    setInfo(null);
    setEditing(false);
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
          chosen={shown.slot ? picks[shown.slot] === shown.id : false}
          onChoose={
            open && shown.slot
              ? () => {
                  choose(shown.slot!, shown.id);
                  closeInfo();
                }
              : undefined
          }
        />
      )}
    </Overlay>
  );

  // Places are out: show where they're going.
  if (places && places.length) {
    return (
      <section aria-labelledby={headingId} className="overflow-hidden rounded-xl border border-navy/10 bg-white">
        <div className="relative overflow-hidden bg-midnight px-5 py-5 text-paper sm:px-7">
          <div aria-hidden className="lanyard-grid pointer-events-none absolute inset-0 opacity-20" />
          <p className="eyebrow relative text-gold">Workshops</p>
          <h2 id={headingId} className="relative mt-1 font-display text-2xl">
            Your workshops
          </h2>
          <p className="relative mt-1 text-sm text-paper/75">One in each workshop session. Head to each room a few minutes early.</p>
        </div>
        <ol className="divide-y divide-navy/10">
          {places.map((p) => {
            const c = workshopColour(p.workshop.number);
            const badge = p.choice ? (p.choice <= 3 ? "Your pick" : "Your other option") : null;
            return (
              <li key={p.slot} className="relative flex items-center gap-x-4 px-5 py-4 sm:px-7">
                <span aria-hidden className="absolute inset-y-0 left-0 w-1.5" style={{ background: c.solid }} />
                <span className="grid size-11 shrink-0 place-items-center rounded-full font-ui text-sm font-bold text-white" style={{ background: c.solid }} aria-hidden>
                  {p.workshop.pair ?? p.slot}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">
                    Session {p.slot}
                    {p.time ? ` · ${p.time}` : ""}
                    {p.room ? ` · ${p.room}` : ""}
                  </span>
                  <button type="button" onClick={() => setInfo(p.workshop.id)} className="mt-0.5 block text-left font-semibold text-ink underline-offset-4 hover:underline">
                    {p.workshop.title}
                  </button>
                  {badge && (
                    <span className={cn("mt-1.5 inline-block rounded-full px-2.5 py-1 font-ui text-xs font-semibold", p.choice! <= 3 ? "bg-success/10 text-success" : "bg-paper-200 text-slate-700")}>
                      {badge}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
        {infoCard}
      </section>
    );
  }

  return (
    <section
      aria-labelledby={headingId}
      className={cn("relative scroll-mt-28 overflow-hidden rounded-xl border bg-white", open && !saved && !preview ? "border-gold/50 shadow-[0_18px_40px_-28px_rgba(14,27,49,0.55)]" : "border-navy/10")}
      id="workshops"
    >
      <p role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>
      {preview && (
        <div className="flex items-start gap-3 border-b border-gold/40 bg-gold/10 px-5 py-3.5 text-sm text-ink sm:px-7">
          <Eye aria-hidden className="mt-0.5 size-4 shrink-0" />
          <p>
            <strong>Preview for the committee.</strong> Delegates see this card once you open workshop choices on{" "}
            <Link href="/admin/workshops" className="font-semibold underline underline-offset-4">
              Workshop places
            </Link>
            . Try picking and opening the info cards; nothing here is saved.
          </p>
        </div>
      )}
      <div className="p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={headingId} className="flex items-center gap-2 font-display text-xl text-ink">
              <Sparkles aria-hidden className="size-5 text-electric-600" /> {open ? "Choose your workshops" : "Your workshop choices"}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-700">
              {open ? (
                <>
                  Two workshops run at the same time in each session. Pick the one you&apos;d like to go to in each, and we&apos;ll give you your picks
                  wherever the rooms allow. Tap <Info aria-hidden className="inline size-3.5 align-[-2px]" /> to read more about a workshop.
                </>
              ) : saved ? (
                <>Choices have closed. The committee is now sorting out places, and your three workshops will appear here.</>
              ) : (
                <>Choices have closed. The committee will give you a place in each workshop session, and your three workshops will appear here.</>
              )}
            </p>
          </div>
          {open && !preview && closesAt && (
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

        {!ready ? (
          <p className="mt-5 rounded-lg border border-warning/30 bg-warning/[0.07] p-4 text-sm text-ink">
            The workshops haven&apos;t been paired into sessions yet.
            {preview && (
              <>
                {" "}
                Set them on{" "}
                <Link href="/admin/workshops" className="font-semibold underline underline-offset-4">
                  Workshop places
                </Link>{" "}
                to see the choices.
              </>
            )}
          </p>
        ) : (
          <div className="mt-6 space-y-6">
            {sessions.map((s) => (
              <fieldset key={s.slot}>
                <legend className="mb-3 flex w-full flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="font-display text-lg text-ink">Session {s.slot}</span>
                  {s.time && <span className="text-sm text-slate-700">{s.time}</span>}
                </legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {s.options.map((w) => {
                    const c = workshopColour(w.number);
                    const on = picks[s.slot] === w.id;
                    const inputId = `${headingId}-${w.id}`;
                    return (
                      <div key={w.id} className="relative">
                        <input
                          type="radio"
                          id={inputId}
                          name={`${headingId}-session-${s.slot}`}
                          value={w.id}
                          checked={on}
                          disabled={!open}
                          onChange={() => choose(s.slot, w.id)}
                          className="peer sr-only"
                        />
                        <label
                          htmlFor={inputId}
                          style={{ borderColor: on ? c.solid : undefined, background: on ? c.tint : undefined }}
                          className={cn(
                            "relative flex h-full min-h-28 overflow-hidden rounded-xl border-2 bg-white pr-14 transition-[border-color,background-color,box-shadow] peer-focus-visible:ring-4 peer-focus-visible:ring-electric/30",
                            open ? "cursor-pointer hover:shadow-[0_10px_28px_-20px_rgba(14,27,49,0.6)]" : "cursor-default",
                            on ? "" : "border-navy/10",
                          )}
                        >
                          <span aria-hidden className="w-2 shrink-0" style={{ background: c.solid }} />
                          <span className="flex min-w-0 flex-1 flex-col gap-1.5 p-4">
                            <span className="flex items-center gap-2">
                              <span className="rounded-full px-2.5 py-0.5 font-ui text-xs font-bold text-white" style={{ background: c.solid }}>
                                {w.pair}
                              </span>
                              {on && (
                                <span className="inline-flex items-center gap-1 font-ui text-xs font-semibold text-ink">
                                  <Check aria-hidden className="size-3.5" /> {preview || !saved || dirty ? "Your pick" : "Your pick, saved"}
                                </span>
                              )}
                            </span>
                            <span className="font-semibold leading-snug text-ink">{w.title}</span>
                            {w.strapline && <span className="text-sm leading-snug text-slate-700">{w.strapline}</span>}
                          </span>
                          <span
                            aria-hidden
                            className="absolute right-3 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full border-2 bg-white"
                            style={{ borderColor: on ? c.solid : "rgba(14,27,49,0.25)" }}
                          >
                            {on && <span className="size-3 rounded-full" style={{ background: c.solid }} />}
                          </span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setInfo(w.id)}
                          aria-label={`More about ${w.pair}, ${w.title}`}
                          className="absolute right-2 top-2 z-[1] grid size-9 place-items-center rounded-full text-slate-700 hover:bg-paper-200 hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-electric/30"
                        >
                          <Info aria-hidden className="size-5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </div>
        )}

        {preview && ready && (
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-700">Delegates press &ldquo;Save my choices&rdquo; here. In this preview the button is switched off.</p>
            <button
              type="button"
              onClick={() => {
                setPicks(start);
                setAnnounce("Choices cleared.");
              }}
              className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-[3px] border border-navy/20 bg-white px-6 font-ui text-sm font-semibold text-ink hover:bg-paper-200"
            >
              <RotateCcw aria-hidden className="size-4" /> Start again
            </button>
          </div>
        )}
        {open && !preview && ready && (
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p role={error ? "alert" : undefined} className={cn("text-sm", error ? "font-medium text-danger" : "text-slate-700")}>
              {error ??
                (pending
                  ? "Saving…"
                  : !complete
                    ? `Pick one workshop in each session. ${missing} to go.`
                    : !saved
                      ? "Not saved yet. Your choices only count once you save them."
                      : dirty
                        ? "You have changes that aren't saved yet."
                        : savedAt
                          ? (
                              <span className="inline-flex items-center gap-1.5 font-medium text-success">
                                <Check aria-hidden className="size-4" /> Saved {savedWhen(savedAt)}. You can change them until choices close.
                              </span>
                            )
                          : "Saved.")}
            </p>
            <button
              type="button"
              onClick={save}
              disabled={pending || !dirty || !complete}
              className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-[3px] bg-navy px-6 font-ui text-sm font-semibold text-paper hover:bg-navy-700 disabled:opacity-60"
            >
              {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Check aria-hidden className="size-4" />}
              {saved ? "Save changes" : "Save my choices"}
            </button>
          </div>
        )}
      </div>
      {infoCard}
    </section>
  );
}

/** The overlaid card with everything about one workshop, and an editor for committee members. */
function WorkshopInfo({
  w,
  titleId,
  editing,
  canEdit,
  onEdit,
  onDoneEditing,
  chosen,
  onChoose,
}: {
  w: PickWorkshop;
  titleId: string;
  editing: boolean;
  canEdit: boolean;
  onEdit: () => void;
  onDoneEditing: () => void;
  chosen: boolean;
  onChoose?: () => void;
}) {
  const c = workshopColour(w.number);
  return (
    <>
      <div className="relative shrink-0 px-6 pb-5 pt-6 pr-16 text-white" style={{ background: c.solid }}>
        <p className="font-ui text-xs font-semibold uppercase tracking-[0.16em] text-white/90">
          {w.pair ? `Workshop ${w.pair}` : `Workshop ${w.number}`}
          {w.time ? ` · ${w.time}` : ""}
        </p>
        <h3 id={titleId} className="mt-2 font-display text-2xl leading-tight">
          {editing ? `Edit ${w.title}` : w.title}
        </h3>
        {!editing && w.strapline && <p className="mt-1.5 text-white/90">{w.strapline}</p>}
      </div>
      <div tabIndex={0} aria-label="Workshop details" className="min-h-0 flex-1 overflow-y-auto px-6 py-5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-electric/30">
        {editing ? (
          <WorkshopTextEditor workshop={w} onDone={onDoneEditing} onCancel={onDoneEditing} />
        ) : (
          <div className="space-y-5 text-[0.95rem] leading-relaxed text-slate-700">
            {(w.description || w.summary) && <p className="text-ink">{w.description || w.summary}</p>}
            {w.topics.length > 0 && (
              <div>
                <h4 className="flex items-center gap-2 font-semibold text-ink">
                  <Target aria-hidden className="size-4" style={{ color: c.solid }} /> What you&apos;ll cover
                </h4>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {w.topics.map((t) => (
                    <li key={t} className="rounded-full px-3 py-1 text-sm text-ink" style={{ background: c.tint }}>
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {w.outcomes.length > 0 && (
              <div>
                <h4 className="font-semibold text-ink">You&apos;ll leave able to</h4>
                <ul className="mt-2 space-y-1.5">
                  {w.outcomes.map((o) => (
                    <li key={o} className="flex gap-2">
                      <Check aria-hidden className="mt-1 size-4 shrink-0" style={{ color: c.solid }} />
                      <span>{o}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {w.audience && (
              <p className="flex gap-2">
                <Users aria-hidden className="mt-1 size-4 shrink-0" style={{ color: c.solid }} />
                <span>
                  <span className="font-semibold text-ink">Who it&apos;s for: </span>
                  {w.audience}
                </span>
              </p>
            )}
            <p className="flex gap-2">
              <UserRound aria-hidden className="mt-1 size-4 shrink-0" style={{ color: c.solid }} />
              <span>
                <span className="font-semibold text-ink">Facilitator: </span>
                {w.facilitator ?? "To be announced"}
              </span>
            </p>
          </div>
        )}
      </div>
      {!editing && (
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-navy/10 px-6 py-4">
          {onChoose && (
            <button
              type="button"
              onClick={onChoose}
              data-autofocus
              className="inline-flex min-h-12 items-center gap-2 rounded-[3px] bg-navy px-5 font-ui text-sm font-semibold text-paper hover:bg-navy-700"
            >
              <Check aria-hidden className="size-4" /> {chosen ? "Keep this one" : "Pick this workshop"}
            </button>
          )}
          <Link href={`/workshops/${w.slug}`} className="inline-flex min-h-12 items-center gap-1 px-1 text-sm font-semibold text-electric-600 underline-offset-4 hover:underline">
            Full workshop page <ArrowRight aria-hidden className="size-3.5" />
          </Link>
          {canEdit && (
            <button type="button" onClick={onEdit} className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-[3px] border border-navy/20 px-4 text-sm font-semibold text-ink hover:bg-paper-200">
              <Pencil aria-hidden className="size-4" /> Edit wording
            </button>
          )}
        </div>
      )}
    </>
  );
}
