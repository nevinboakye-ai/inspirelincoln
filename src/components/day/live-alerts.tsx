"use client";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { BellRing, CalendarClock, MapPin, Navigation } from "lucide-react";
import { Overlay } from "@/components/ui/overlay";
import { formatTime } from "@/lib/time";
import { ASSIGNMENT_LABEL, dueAlert, placeLine, type DayItem } from "@/lib/day/plan";
import { workshopColour } from "@/lib/workshops/colours";
import type { LiveAlert, LiveState } from "@/app/api/live/route";

/** Shown once per browser, so a dismissed alert doesn't come back on the next page. */
const SEEN_KEY = "inspire-live-seen";
const readSeen = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
};
const markSeen = (id: string) => {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...readSeen().filter((x) => x !== id), id].slice(-60)));
  } catch {}
};

type Shown = { kind: "item"; key: string; item: DayItem; personal: boolean } | { kind: "broadcast"; key: string; alert: LiveAlert };

/** Fired by the committee page to show what an alert looks like, on their own screen only. */
export const PREVIEW_EVENT = "inspire:preview-alert";

/** Only things with somewhere to go are worth stopping someone for. */
const worthAlerting = (i: DayItem) => Boolean(i.room || i.options.length || i.workshop || i.pending);

/**
 * The "where to go next" card, on every page. On the day, a few minutes
 * before each part of the programme starts, it opens over whatever page
 * someone is on and tells them where to go: their own workshop room when
 * they're signed in. Alerts the committee sends show straight away.
 *
 * It waits until the page has settled before asking for anything, checks
 * every 30 seconds only while the day is on (every few minutes otherwise),
 * and stops while the tab is hidden, so it never slows a page down.
 */
export function LiveAlerts() {
  const [shown, setShown] = useState<Shown | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const state = useRef<LiveState | null>(null);
  const day = useRef<{ items: DayItem[]; personal: boolean; at: number } | null>(null);
  const shownRef = useRef<Shown | null>(null);
  const titleId = useId();

  const open = useCallback((s: Shown | null) => {
    shownRef.current = s;
    setShown(s);
  }, []);

  const decide = useCallback(() => {
    if (shownRef.current) return;
    // Never on top of something else that's open, like the scanner. It shows once that closes.
    if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
    const t = Date.now();
    setNow(t);
    const seen = readSeen();
    const live = state.current;
    const b = live?.alerts.find((a) => !seen.includes(`b:${a.id}`));
    if (b) return open({ kind: "broadcast", key: `b:${b.id}`, alert: b });
    if (!live?.auto || !day.current) return;
    const item = dueAlert(day.current.items.filter(worthAlerting), t, live.leadMinutes);
    if (item && !seen.includes(`i:${item.id}`)) open({ kind: "item", key: `i:${item.id}`, item, personal: day.current.personal });
  }, [open]);

  useEffect(() => {
    let stopped = false;
    let timer = 0;

    const dayIsOn = () => {
      const items = day.current?.items ?? [];
      const t = Date.now();
      // From three hours before the first part to an hour after the last.
      const starts = items.map((i) => (i.startsAt ? new Date(i.startsAt).getTime() : NaN)).filter((x) => !Number.isNaN(x));
      return starts.length > 0 && t > Math.min(...starts) - 3 * 3_600_000 && t < Math.max(...starts) + 3_600_000;
    };

    const poll = async () => {
      if (stopped) return;
      if (document.visibilityState === "visible") {
        try {
          if (!day.current || Date.now() - day.current.at > 5 * 60_000) {
            const r = await fetch("/api/live/day", { cache: "no-store" });
            if (r.ok) {
              const d = (await r.json()) as { items: DayItem[]; personal: boolean };
              day.current = { items: d.items, personal: d.personal, at: Date.now() };
            }
          }
          const r = await fetch("/api/live", { cache: "no-store" });
          if (r.ok) state.current = (await r.json()) as LiveState;
          decide();
        } catch {}
      }
      timer = window.setTimeout(poll, dayIsOn() || (state.current?.alerts.length ?? 0) > 0 ? 30_000 : 3 * 60_000);
    };

    // Start once the page has settled, so the first paint never waits on this.
    const begin = () => {
      timer = window.setTimeout(poll, 1500);
    };
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (idle) idle(begin, { timeout: 4000 });
    else begin();

    const back = () => {
      if (document.visibilityState !== "visible") return;
      clearTimeout(timer);
      timer = window.setTimeout(poll, 300);
    };
    document.addEventListener("visibilitychange", back);
    // A tick between polls, so an alert appears on time even without a new fetch.
    const tick = window.setInterval(() => document.visibilityState === "visible" && decide(), 15_000);

    const preview = (e: Event) => {
      const d = (e as CustomEvent<Shown>).detail;
      if (d) open(d);
    };
    window.addEventListener(PREVIEW_EVENT, preview);
    return () => {
      stopped = true;
      clearTimeout(timer);
      clearInterval(tick);
      document.removeEventListener("visibilitychange", back);
      window.removeEventListener(PREVIEW_EVENT, preview);
    };
  }, [decide, open]);

  // Keep the countdown moving while the card is open.
  useEffect(() => {
    if (!shown) return;
    const id = window.setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(id);
  }, [shown]);

  const close = useCallback(() => {
    if (shownRef.current && !shownRef.current.key.startsWith("preview")) markSeen(shownRef.current.key);
    open(null);
  }, [open]);

  return (
    <Overlay open={Boolean(shown)} onClose={close} labelledBy={titleId}>
      {shown?.kind === "item" && <ItemAlert titleId={titleId} item={shown.item} personal={shown.personal} now={now} onClose={close} />}
      {shown?.kind === "broadcast" && <BroadcastAlert titleId={titleId} alert={shown.alert} onClose={close} />}
    </Overlay>
  );
}

function when(startsAt: string, now: number) {
  const mins = Math.round((new Date(startsAt).getTime() - now) / 60_000);
  if (mins > 1) return `Starts in ${mins} minutes, at ${formatTime(startsAt)}`;
  if (mins === 1) return "Starts in 1 minute";
  if (mins >= -1) return "Starting now";
  return `Started ${-mins} minutes ago`;
}

function ItemAlert({ titleId, item, personal, now, onClose }: { titleId: string; item: DayItem; personal: boolean; now: number; onClose: () => void }) {
  const colour = item.workshop ? workshopColour(item.workshop.number) : null;
  const where = placeLine(item.room);
  return (
    <div className="overflow-y-auto">
      <div className="relative isolate overflow-hidden bg-midnight px-5 pb-5 pt-5 text-paper sm:px-6">
        <span aria-hidden className="hub-orb -right-12 -top-16 size-48 bg-gold/30" />
        <div aria-hidden className="lanyard-grid pointer-events-none absolute inset-0 opacity-20" />
        <p className="relative flex items-center gap-2 pr-12 font-ui text-xs font-semibold uppercase tracking-[0.16em] text-gold">
          <span className="relative grid size-6 place-items-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-gold/40 [animation-duration:1.8s]" />
            <CalendarClock aria-hidden className="relative size-4" />
          </span>
          {item.startsAt ? when(item.startsAt, now) : "Up next"}
        </p>
        <h2 id={titleId} className="relative mt-2.5 font-display text-2xl leading-tight sm:text-3xl">
          {colour && (
            <span className="mr-2 inline-grid size-7 translate-y-[-3px] place-items-center rounded-full align-middle font-ui text-sm font-bold text-white" style={{ background: colour.solid }}>
              {item.workshop!.number}
            </span>
          )}
          {item.title}
        </h2>
        {item.slotTitle && <p className="relative mt-1 text-sm text-paper/75">{item.slotTitle}</p>}
        {item.role && personal && <p className="relative mt-2 inline-flex rounded-full bg-gold px-2.5 py-0.5 text-xs font-semibold text-midnight">{ASSIGNMENT_LABEL[item.role]}</p>}
      </div>
      <div className="space-y-4 p-5 sm:p-6">
        {where ? (
          <div>
            <p className="font-ui text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-slate">Go to</p>
            <p className="mt-1 flex items-start gap-2 font-display text-2xl leading-tight text-ink">
              <MapPin aria-hidden className="mt-1 size-6 shrink-0 text-electric-600" /> {where}
            </p>
            {item.room?.directions && <p className="mt-1.5 text-slate-700">{item.room.directions}</p>}
          </div>
        ) : item.options.length ? (
          <div>
            <p className="font-ui text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-slate">Go to either</p>
            <ul className="mt-1.5 space-y-2">
              {item.options.map((o) => (
                <li key={o.sessionId} className="flex items-center gap-2">
                  <MapPin aria-hidden className="size-5 shrink-0 text-electric-600" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-ink">{placeLine(o.room) ?? o.title}</span>
                    {o.room && <span className="block text-sm text-slate-700">{o.title}</span>}
                  </span>
                  {o.mapHref && (
                    <Link href={o.mapHref} onClick={onClose} className="inline-flex min-h-10 items-center rounded-full px-3 text-sm font-semibold text-electric-600 hover:bg-paper-200">
                      Map
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : item.pending ? (
          <p className="text-slate-700">{personal ? item.pending : "Head to your workshop room. Signed-in delegates see their room in My day."}</p>
        ) : null}
        {item.note && personal && <p className="rounded-md bg-paper p-3 text-sm text-ink">{item.note}</p>}
        <div className="grid gap-2 sm:grid-cols-2">
          {item.mapHref ? (
            <Link href={item.mapHref} onClick={onClose} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[3px] bg-navy px-5 font-ui text-sm font-semibold text-paper">
              <Navigation aria-hidden className="size-4" /> Show me on the map
            </Link>
          ) : personal ? (
            <Link href="/portal/my-day" onClick={onClose} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[3px] bg-navy px-5 font-ui text-sm font-semibold text-paper">
              <CalendarClock aria-hidden className="size-4" /> My day
            </Link>
          ) : null}
          <button type="button" data-autofocus onClick={onClose} className={`inline-flex min-h-12 items-center justify-center rounded-[3px] border border-navy/15 px-5 font-ui text-sm font-semibold text-ink hover:bg-paper-200 ${item.mapHref || personal ? "" : "sm:col-span-2"}`}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

function BroadcastAlert({ titleId, alert, onClose }: { titleId: string; alert: LiveAlert; onClose: () => void }) {
  return (
    <div className="overflow-y-auto">
      <div className="relative isolate overflow-hidden bg-gold px-5 pb-5 pt-5 text-midnight sm:px-6">
        <span aria-hidden className="hub-orb -right-12 -top-16 size-48 bg-white/40" />
        <p className="relative flex items-center gap-2 pr-12 font-ui text-xs font-semibold uppercase tracking-[0.16em]">
          <BellRing aria-hidden className="size-4" /> From the INSPIRE committee · {formatTime(alert.startsAt)}
        </p>
        <h2 id={titleId} className="relative mt-2.5 font-display text-2xl leading-tight sm:text-3xl">
          {alert.title}
        </h2>
      </div>
      <div className="space-y-4 p-5 sm:p-6">
        {alert.body && <p className="whitespace-pre-line text-lg leading-relaxed text-ink">{alert.body}</p>}
        {alert.place && (
          <p className="flex items-start gap-2 font-display text-2xl leading-tight text-ink">
            <MapPin aria-hidden className="mt-1 size-6 shrink-0 text-electric-600" /> {alert.place}
          </p>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          {alert.mapHref && (
            <Link href={alert.mapHref} onClick={onClose} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[3px] bg-navy px-5 font-ui text-sm font-semibold text-paper">
              <Navigation aria-hidden className="size-4" /> Show me on the map
            </Link>
          )}
          <button type="button" data-autofocus onClick={onClose} className={`inline-flex min-h-12 items-center justify-center rounded-[3px] border border-navy/15 px-5 font-ui text-sm font-semibold text-ink hover:bg-paper-200 ${alert.mapHref ? "" : "sm:col-span-2"}`}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
