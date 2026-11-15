"use client";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import {
  ArrowRight, Camera, CameraOff, CheckCircle2, ChevronDown, DoorOpen, Keyboard, Loader2, MapPin, RotateCcw, ScanLine, Search, TriangleAlert, UserCheck, XCircle,
} from "lucide-react";
import { Overlay } from "@/components/ui/overlay";
import { Avatar } from "@/components/ui/avatar";
import { DayTimeline, timeRange, useNow } from "@/components/day/day-timeline";
import { inputClass } from "@/components/forms/field";
import { cn } from "@/lib/cn";
import { rolesLabel } from "@/lib/accounts";
import { sortedRoles } from "@/lib/card";
import { formatTime } from "@/lib/time";
import { placeLine, whereNow, type DayItem, type DayWorkshop } from "@/lib/day/plan";
import { workshopColour } from "@/lib/workshops/colours";
import { beep, useQrScanner } from "@/lib/use-qr-scanner";
import {
  markWorkshop, scanCheckIn, scanLookup, scanPerson, scanSearch, unmarkWorkshop, type MarkResult, type ScanHit, type ScanView,
} from "@/app/portal/day-actions";

export type ScannerSession = { slot: number; title: string; startsAt: string | null; endsAt: string | null };

/** "look": see who they are and their day. "door": standing at one workshop's door in one session, marking people in. */
type Mode = { kind: "look" } | { kind: "door"; slot: number; workshopId: string };

type Flash =
  | { tone: "good" | "warn" | "bad" | "info"; title: string; text?: string }
  | null;

const btn = {
  primary: "inline-flex min-h-12 items-center justify-center gap-2 rounded-[3px] bg-navy px-4 font-ui text-sm font-semibold text-paper hover:bg-navy-700 disabled:opacity-60",
  secondary: "inline-flex min-h-12 items-center justify-center gap-2 rounded-[3px] border border-navy/15 bg-white px-4 font-ui text-sm font-semibold text-ink hover:border-navy/40 disabled:opacity-60",
};

const markText: Record<MarkResult, string> = {
  marked: "Marked in.",
  already: "Already marked in here.",
  changed: "Moved: now marked in here instead.",
  no_place: "They don't have a place in this session.",
  not_approved: "Their account isn't approved, so they don't have a confirmed place.",
  no_event: "No conference is set as the current one.",
  unknown: "We don't recognise this person.",
  undone: "Mark removed.",
};

/** The session a door is most likely for right now: the one running, or the next one. */
function likelySlot(sessions: ScannerSession[], now: number) {
  const t = (s: string | null) => (s ? new Date(s).getTime() : NaN);
  const running = sessions.find((s) => t(s.startsAt) - 15 * 60_000 <= now && now < t(s.endsAt));
  return running?.slot ?? sessions.find((s) => t(s.startsAt) > now)?.slot ?? 1;
}

/**
 * The scanner on the home page of My Hub, for the committee on the day.
 * Scan a Delegate Card (or find someone by name) to see where they should
 * be now and next and their whole day, check them in, and mark them at a
 * workshop. At a workshop door, pick the session and workshop once and every
 * scan marks people in, with a clear warning if they're in the wrong room.
 */
export function HubScanner({ workshops, sessions, canCheckIn }: { workshops: DayWorkshop[]; sessions: ScannerSession[]; canCheckIn: boolean }) {
  const [open, setOpen] = useState(false);
  const ids = useId();
  return (
    <>
      <section aria-labelledby={`${ids}-h`} className="relative isolate overflow-hidden rounded-xl bg-midnight p-4 text-paper sm:p-5">
        <span aria-hidden className="hub-orb -right-10 -top-16 size-44 bg-gold/25" />
        <div aria-hidden className="lanyard-grid pointer-events-none absolute inset-0 opacity-20" />
        <div className="relative flex flex-wrap items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-gold text-midnight">
            <ScanLine aria-hidden className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={`${ids}-h`} className="font-display text-lg leading-tight">On-the-day scanner</h2>
            <p className="text-sm text-paper/75">Scan a Delegate Card to see their day, direct them, and mark them in at workshops.</p>
          </div>
          <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[3px] bg-gold px-5 font-ui text-sm font-semibold text-midnight hover:bg-gold-300 sm:w-auto">
            <Camera aria-hidden className="size-4" /> Scan a card
          </button>
        </div>
      </section>
      <Overlay open={open} onClose={() => setOpen(false)} labelledBy={`${ids}-panel`}>
        {open && <ScannerPanel titleId={`${ids}-panel`} workshops={workshops} sessions={sessions} canCheckIn={canCheckIn} />}
      </Overlay>
    </>
  );
}

function ScannerPanel({ titleId, workshops, sessions, canCheckIn }: { titleId: string; workshops: DayWorkshop[]; sessions: ScannerSession[]; canCheckIn: boolean }) {
  const now = useNow();
  const [mode, setMode] = useState<Mode>({ kind: "look" });
  const [scanning, setScanning] = useState(true);
  const [camError, setCamError] = useState<string | null>(null);
  const [view, setView] = useState<ScanView | null>(null);
  const [flash, setFlash] = useState<Flash>(null);
  const [pending, start] = useTransition();
  const [code, setCode] = useState("");
  const [tab, setTab] = useState<"scan" | "find">("scan");
  const paused = useRef(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const modeRef = useRef(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const doorWorkshop = mode.kind === "door" ? workshops.find((w) => w.id === mode.workshopId) ?? null : null;

  const resume = useCallback((after = 0) => {
    setTimeout(() => {
      paused.current = false;
    }, after);
  }, []);

  /** At a door: check they belong here, then mark them in. */
  const atDoor = useCallback(
    async (v: ScanView, m: Extract<Mode, { kind: "door" }>, force = false) => {
      const placed = v.items.find((i) => i.slot === m.slot)?.workshop ?? null;
      if (!force && placed && placed.id !== m.workshopId) {
        const item = v.items.find((i) => i.slot === m.slot)!;
        setFlash({ tone: "warn", title: "Wrong room", text: `${v.person.name.split(" ")[0]} is in ${placed.title}${item.room ? `, ${placeLine(item.room)}` : ""}.` });
        beep(false);
        return;
      }
      if (!force && !placed) {
        setFlash({ tone: "warn", title: "No place in this session", text: "They weren't placed in a workshop for this session. Mark them here if there's room." });
        beep(false);
        return;
      }
      const res = await markWorkshop(v.person.id, m.slot, m.workshopId);
      if (!res.ok) {
        setFlash({ tone: "bad", title: "Not marked", text: res.error });
        beep(false);
        return;
      }
      if (res.data.view) setView(res.data.view);
      const good = res.data.result === "marked" || res.data.result === "changed" || res.data.result === "already";
      setFlash({
        tone: good ? (res.data.result === "already" ? "info" : "good") : "bad",
        title: good ? `${v.person.name.split(" ")[0]} is in` : "Not marked",
        text: `${markText[res.data.result]}${res.data.checkedInNow ? " Also checked in to the conference." : ""}`,
      });
      beep(good);
      if (good) resume(2200);
    },
    [resume],
  );

  const show = useCallback(
    (v: ScanView | null) => {
      setView(v);
      setFlash(null);
      if (!v) {
        setFlash({ tone: "bad", title: "Code not recognised", text: "It may have been replaced with a newer one. Find them by name instead." });
        beep(false);
        return false;
      }
      return true;
    },
    [],
  );

  const lookup = useCallback(
    (raw: string) =>
      start(async () => {
        try {
          const res = await scanLookup(raw);
          if (!res.ok) {
            setView(null);
            setFlash({ tone: "bad", title: "Couldn't read that", text: res.error });
            beep(false);
            return;
          }
          if (!show(res.data)) return;
          const m = modeRef.current;
          if (m.kind === "door") await atDoor(res.data!, m);
          else beep(true);
          requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
        } catch {
          setFlash({ tone: "bad", title: "No connection", text: "That didn't go through. Check your connection and try again." });
          beep(false);
        }
      }),
    [atDoor, show],
  );

  const openPerson = (id: string) =>
    start(async () => {
      const res = await scanPerson(id);
      if (!res.ok) return setFlash({ tone: "bad", title: "Couldn't open", text: res.error });
      show(res.data);
      setTab("scan");
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
    });

  const video = useQrScanner({
    active: scanning && tab === "scan",
    paused,
    onValue: lookup,
    onError: setCamError,
    onStop: () => setScanning(false),
  });

  const scanNext = () => {
    setView(null);
    setFlash(null);
    paused.current = false;
    if (!scanning) setScanning(true);
  };

  const slotNow = now != null ? likelySlot(sessions, now) : 1;

  return (
    <div data-scroller className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
      <div className="sticky top-0 z-[1] border-b border-navy/10 bg-white/95 px-4 pb-3 pt-4 backdrop-blur sm:px-5">
        <h2 id={titleId} className="flex min-h-11 items-center gap-2 pr-14 font-display text-xl text-ink">
          <ScanLine aria-hidden className="size-5 text-electric-600" /> Scanner
        </h2>
        {/* What each scan does */}
        {/* Hidden while finding by name: it doesn't apply there, and on a phone the keyboard needs the room. */}
        <div role="radiogroup" aria-label="What a scan does" className={cn("mt-2.5 flex gap-1.5 overflow-x-auto pb-0.5", tab === "find" && "hidden")}>
          <ModeChip on={mode.kind === "look"} onClick={() => setMode({ kind: "look" })}>
            <Search aria-hidden className="size-3.5" /> Look up
          </ModeChip>
          {workshops.length > 0 && sessions.length > 0 && (
            <ModeChip on={mode.kind === "door"} onClick={() => setMode({ kind: "door", slot: slotNow, workshopId: mode.kind === "door" ? mode.workshopId : workshops[0]!.id })}>
              <DoorOpen aria-hidden className="size-3.5" /> Workshop door
            </ModeChip>
          )}
        </div>
        {mode.kind === "door" && tab === "scan" && (
          <div className="mt-2.5 grid grid-cols-[auto_1fr] gap-2">
            <label className="sr-only" htmlFor={`${titleId}-slot`}>Session</label>
            <select
              id={`${titleId}-slot`}
              value={mode.slot}
              onChange={(e) => setMode({ ...mode, slot: Number(e.target.value) })}
              className="min-h-11 rounded-md border border-navy/15 bg-white px-2 text-sm font-semibold text-ink"
            >
              {sessions.map((s) => (
                <option key={s.slot} value={s.slot}>
                  Session {s.slot}
                  {s.startsAt ? ` · ${formatTime(s.startsAt)}` : ""}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor={`${titleId}-ws`}>Workshop</label>
            <select
              id={`${titleId}-ws`}
              value={mode.workshopId}
              onChange={(e) => setMode({ ...mode, workshopId: e.target.value })}
              className="min-h-11 min-w-0 rounded-md border border-navy/15 bg-white px-2 text-sm font-semibold text-ink"
            >
              {workshops.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.number}. {w.title}
                  {w.room ? ` (${w.room})` : ""}
                </option>
              ))}
            </select>
            {doorWorkshop && (
              <p className="col-span-2 flex items-center gap-2 text-xs text-slate-700">
                <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: workshopColour(doorWorkshop.number).solid }} />
                Every scan marks people in at {doorWorkshop.title}, session {mode.slot}. You&apos;ll be warned if they belong somewhere else.
              </p>
            )}
          </div>
        )}
        <div className="mt-2.5 grid grid-cols-2 gap-1 rounded-full bg-paper-200 p-1 text-sm font-semibold">
          {(["scan", "find"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} aria-pressed={tab === t} className={cn("min-h-10 rounded-full", tab === t ? "bg-white text-ink shadow-sm" : "text-slate-700")}>
              {t === "scan" ? "Scan" : "Find by name"}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 p-4 sm:p-5">
        {tab === "scan" ? (
          <>
            {camError && (
              <p role="alert" className="flex items-start gap-2 rounded-md border border-danger/25 bg-danger/[0.06] p-3 text-sm text-danger">
                <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" /> {camError}
              </p>
            )}
            {scanning ? (
              <div className="relative overflow-hidden rounded-xl bg-midnight">
                <video ref={video} muted playsInline aria-label="Camera view for scanning QR codes" className="aspect-[4/3] w-full object-cover" />
                <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
                  <div className={cn("aspect-square w-[58%] max-w-64 rounded-2xl border-4 transition-colors", pending ? "border-cyan" : view || flash ? "border-gold" : "border-white/80")} />
                </div>
                <p aria-hidden className="absolute inset-x-0 bottom-0 bg-midnight/70 px-3 py-2 text-center text-sm font-medium text-paper">
                  {pending ? "Looking them up…" : view || flash ? "Got it. Tap Scan next when you're ready" : "Hold the QR code inside the square"}
                </p>
                <button type="button" onClick={() => setScanning(false)} className="absolute right-2 top-2 grid size-10 place-items-center rounded-full bg-midnight/60 text-paper" aria-label="Stop camera">
                  <CameraOff aria-hidden className="size-4" />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => { setCamError(null); setScanning(true); }} className={cn(btn.primary, "w-full")}>
                <Camera aria-hidden className="size-4" /> Start camera
              </button>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (code.trim()) lookup(code);
              }}
              className="flex items-end gap-2"
            >
              <div className="min-w-0 flex-1">
                <label htmlFor={`${titleId}-code`} className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <Keyboard aria-hidden className="size-3.5" /> Or type the 16 characters under their QR code
                </label>
                <input
                  id={`${titleId}-code`}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  placeholder="ABCD EFGH JKMN PQRS"
                  className={cn(inputClass, "mt-1 py-2.5 font-mono tracking-[0.1em]")}
                />
              </div>
              <button disabled={pending || !code.trim()} className={btn.secondary}>
                Go
              </button>
            </form>
          </>
        ) : (
          <FindByName onPick={openPerson} />
        )}

        <div ref={resultRef} aria-live="assertive" aria-atomic="false" className="scroll-mt-40 space-y-3">
          {flash && <FlashCard flash={flash} />}
          {flash?.title === "Wrong room" || flash?.title === "No place in this session" ? (
            view && mode.kind === "door" && (
              <div className="grid grid-cols-2 gap-2">
                <button type="button" disabled={pending} onClick={() => start(() => atDoor(view, mode, true))} className={btn.secondary}>
                  Mark them here anyway
                </button>
                <button type="button" onClick={scanNext} className={btn.primary}>
                  Send them on <ArrowRight aria-hidden className="size-4" />
                </button>
              </div>
            )
          ) : null}
          {view && <PersonPanel view={view} now={now} canCheckIn={canCheckIn} onView={setView} onFlash={setFlash} />}
          {(view || flash) && tab === "scan" && (
            <button type="button" onClick={scanNext} className={cn(btn.primary, "sticky bottom-3 w-full shadow-lg")}>
              <ScanLine aria-hidden className="size-4" /> Scan next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ModeChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={cn("inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold", on ? "border-navy bg-navy text-paper" : "border-navy/15 bg-white text-slate-700")}
    >
      {children}
    </button>
  );
}

function FlashCard({ flash }: { flash: NonNullable<Flash> }) {
  const Icon = flash.tone === "good" ? CheckCircle2 : flash.tone === "warn" ? TriangleAlert : flash.tone === "info" ? CheckCircle2 : XCircle;
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border-2 p-4",
        flash.tone === "good" ? "border-success/50 bg-success/[0.08]" : flash.tone === "warn" ? "border-warning/60 bg-warning/[0.09]" : flash.tone === "info" ? "border-navy/20 bg-paper" : "border-danger/40 bg-danger/[0.06]",
      )}
    >
      <Icon aria-hidden className={cn("size-9 shrink-0", flash.tone === "good" ? "text-success" : flash.tone === "warn" ? "text-warning" : flash.tone === "info" ? "text-navy" : "text-danger")} />
      <div className="min-w-0">
        <p className="font-display text-xl leading-tight text-ink">{flash.title}</p>
        {flash.text && <p className="mt-0.5 text-sm font-medium text-slate-700">{flash.text}</p>}
      </div>
    </div>
  );
}

/** Who they are, where they should be, and their workshop marks. */
function PersonPanel({ view, now, canCheckIn, onView, onFlash }: { view: ScanView; now: number | null; canCheckIn: boolean; onView: (v: ScanView) => void; onFlash: (f: Flash) => void }) {
  const [pending, start] = useTransition();
  const [whole, setWhole] = useState(false);
  const p = view.person;
  const first = p.name.split(" ")[0];
  const { current, next } = useMemo(() => (now != null ? whereNow(view.items, now) : { current: null, next: null }), [view.items, now]);
  const workshopItems = view.items.filter((i) => i.slot != null);

  const act = (fn: () => Promise<{ ok: true; data: { view: ScanView | null; result: string; checkedInNow?: boolean } } | { ok: false; error: string }>, done: (r: string, checkedInNow?: boolean) => Flash) =>
    start(async () => {
      try {
        const res = await fn();
        if (!res.ok) return onFlash({ tone: "bad", title: "Didn't go through", text: res.error });
        if (res.data.view) onView(res.data.view);
        onFlash(done(res.data.result, res.data.checkedInNow));
        beep(res.data.result !== "not_approved" && res.data.result !== "no_place");
      } catch {
        onFlash({ tone: "bad", title: "No connection", text: "Check your connection and try again." });
      }
    });

  return (
    <article className="overflow-hidden rounded-xl border border-navy/10 bg-white">
      <header className="flex items-center gap-3 bg-paper p-4">
        <Avatar url={p.photo} name={p.name} className="size-16 ring-2 ring-white" fallbackClassName="bg-navy text-lg text-cyan" />
        <div className="min-w-0">
          <p className="font-display text-xl leading-tight text-ink">{p.name}</p>
          {p.roles.length > 0 && <p className="mt-0.5 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-gold-700">{p.position && !p.roles.every((r) => ["delegate", "oral_presenter", "poster_presenter", "oral_waitlist"].includes(r)) ? p.position : rolesLabel(sortedRoles(p.roles))}</p>}
          {(p.institution || p.yearOfStudy) && <p className="text-sm text-slate-700">{[p.institution, p.yearOfStudy].filter(Boolean).join(" · ")}</p>}
        </div>
      </header>

      <div className="space-y-3 p-4">
        {/* Conference check-in */}
        {p.accountStatus !== "approved" ? (
          <p className="flex items-start gap-2 rounded-md bg-danger/[0.07] p-3 text-sm font-medium text-danger">
            <XCircle aria-hidden className="mt-0.5 size-4 shrink-0" /> Account not approved ({p.accountStatus}). Send them to the help desk.
          </p>
        ) : p.checkedInAt ? (
          <p className="flex items-center gap-2 text-sm font-semibold text-success">
            <CheckCircle2 aria-hidden className="size-4" /> Checked in at {formatTime(p.checkedInAt)}
            {p.checkedInBy ? <span className="font-normal text-slate-700">by {p.checkedInBy}</span> : null}
          </p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-warning/[0.08] p-3">
            <p className="text-sm font-semibold text-ink">Not checked in yet</p>
            {canCheckIn && (
              <button
                type="button"
                disabled={pending}
                onClick={() => act(() => scanCheckIn(p.id), (r) => ({ tone: r === "checked_in" ? "good" : "info", title: r === "checked_in" ? `${first} is checked in` : "Check-in", text: r === "checked_in" ? "Welcome them in." : `Result: ${r.replace(/_/g, " ")}.` }))}
                className={cn(btn.primary, "min-h-11")}
              >
                {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <UserCheck aria-hidden className="size-4" />} Check in
              </button>
            )}
          </div>
        )}
        {p.needs && (
          <p className="rounded-md border border-electric/25 bg-cyan-300/50 p-3 text-sm text-ink">
            <span className="font-semibold">Access needs:</span> {p.needs}
          </p>
        )}

        {/* Where to send them */}
        <div className="grid gap-2 sm:grid-cols-2">
          <WhereCard label="Now" item={current} empty="Nothing running right now" tone="now" />
          <WhereCard label="Next" item={next} empty="That's the end of their day" tone="next" />
        </div>

        {/* Workshop marks */}
        {workshopItems.length > 0 && (
          <div>
            <h3 className="font-ui text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-slate">Workshops</h3>
            <ul className="mt-1.5 divide-y divide-navy/10 rounded-lg border border-navy/10">
              {workshopItems.map((i) => {
                const c = i.workshop ? workshopColour(i.workshop.number) : null;
                return (
                  <li key={i.id} className="flex items-center gap-2.5 p-2.5">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full font-ui text-xs font-bold text-white" style={{ background: c?.solid ?? "var(--color-slate)" }}>
                      {i.slot}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">{i.workshop?.title ?? "No place"}</span>
                      <span className="block truncate text-xs text-slate-700">
                        {timeRange(i)}
                        {i.room ? ` · ${i.room.name}` : ""}
                      </span>
                    </span>
                    {i.mark ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => act(() => unmarkWorkshop(p.id, i.slot!), () => ({ tone: "info", title: "Mark removed", text: `Session ${i.slot}.` }))}
                        className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-full bg-success/10 px-3 text-xs font-semibold text-success"
                        aria-label={`Marked in at ${formatTime(i.mark.markedAt)}. Undo for session ${i.slot}`}
                      >
                        <CheckCircle2 aria-hidden className="size-3.5" /> {formatTime(i.mark.markedAt)} <RotateCcw aria-hidden className="ml-0.5 size-3" />
                      </button>
                    ) : i.workshop ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          act(
                            () => markWorkshop(p.id, i.slot!, null),
                            (r, checked) => ({ tone: r === "marked" || r === "already" ? "good" : "warn", title: r === "marked" ? `${first} is in` : "Workshop", text: `${markText[r as MarkResult] ?? r}${checked ? " Also checked in to the conference." : ""}` }),
                          )
                        }
                        className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-full bg-navy px-3 text-xs font-semibold text-paper"
                      >
                        Mark in
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <button type="button" onClick={() => setWhole((w) => !w)} aria-expanded={whole} className="flex min-h-11 w-full items-center justify-between rounded-md px-1 text-sm font-semibold text-electric-600">
          {whole ? "Hide" : "See"} {first}&apos;s whole day
          <ChevronDown aria-hidden className={cn("size-4 transition-transform", whole && "rotate-180")} />
        </button>
        {whole && <DayTimeline items={view.items} them />}
      </div>
    </article>
  );
}

function WhereCard({ label, item, empty, tone }: { label: string; item: DayItem | null; empty: string; tone: "now" | "next" }) {
  const where = item ? placeLine(item.room) : null;
  return (
    <div className={cn("rounded-lg border p-3", tone === "now" ? "border-success/35 bg-success/[0.05]" : "border-gold/50 bg-gold/[0.07]")}>
      <p className="font-ui text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate">
        {label}
        {item?.startsAt ? ` · ${formatTime(item.startsAt)}` : ""}
      </p>
      {item ? (
        <>
          <p className="mt-0.5 font-semibold leading-snug text-ink">{item.title}</p>
          {where ? (
            <p className="mt-1 flex items-start gap-1 text-sm font-semibold text-electric-600">
              <MapPin aria-hidden className="mt-0.5 size-3.5 shrink-0" /> {where}
            </p>
          ) : item.options.length ? (
            <p className="mt-1 text-sm text-slate-700">Either: {item.options.map((o) => o.room?.name ?? o.title).join(" or ")}</p>
          ) : item.pending ? (
            <p className="mt-1 text-sm text-slate-700">No workshop place</p>
          ) : null}
          {item.room?.directions && <p className="mt-0.5 text-xs text-slate-700">{item.room.directions}</p>}
        </>
      ) : (
        <p className="mt-0.5 text-sm text-slate-700">{empty}</p>
      )}
    </div>
  );
}

function FindByName({ onPick }: { onPick: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<ScanHit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  // The box is the first thing under the header, so scrolling the sheet to the
  // top keeps it in view with the names between it and the keyboard.
  const lift = () => box.current?.closest<HTMLElement>("[data-scroller]")?.scrollTo({ top: 0 });
  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) return;
    let live = true;
    const t = setTimeout(async () => {
      try {
        const res = await scanSearch(query);
        if (!live) return;
        if (res.ok) {
          setHits(res.data);
          setError(null);
        } else setError(res.error);
      } catch {
        if (live) setError("Search isn't working just now.");
      }
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q]);
  const searching = q.trim().length >= 2;
  return (
    <div ref={box} className="space-y-2">
      <label htmlFor={`${id}-q`} className="sr-only">Name, medical school or email</label>
      <input id={`${id}-q`} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, medical school or full email" autoComplete="off" enterKeyHint="search" onFocus={() => setTimeout(lift, 300)} className={inputClass} autoFocus />
      {error && <p className="text-sm text-danger">{error}</p>}
      {searching && hits?.length === 0 && <p className="text-sm text-slate-700">No approved accounts match. Try their medical school.</p>}
      {searching && hits && hits.length > 0 && (
        <ul className="divide-y divide-navy/10 rounded-lg border border-navy/10">
          {hits.map((h) => (
            <li key={h.id}>
              <button type="button" onClick={() => onPick(h.id)} className="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left hover:bg-paper">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ink">{h.full_name ?? "No name"}</span>
                  <span className="block truncate text-xs text-slate-700">{[h.institution, rolesLabel(sortedRoles(h.roles))].filter(Boolean).join(" · ")}</span>
                </span>
                {h.checked_in_at && <CheckCircle2 aria-label="Checked in" className="size-4 shrink-0 text-success" />}
                <ArrowRight aria-hidden className="size-4 shrink-0 text-slate" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
