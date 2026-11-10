"use client";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import {
  AlertTriangle,
  BookmarkCheck,
  BookmarkPlus,
  CalendarPlus,
  Clock,
  Coffee,
  FlaskConical,
  LayoutGrid,
  Link2,
  MapPin,
  Mic2,
  PartyPopper,
  Presentation,
  Rows3,
  Search,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Room, Session, SessionCategory, Speaker, Workshop } from "@/lib/types";
import { SESSION_CATEGORY_LABEL } from "@/lib/types";
import { durationMinutes, findConflicts, formatDuration, formatTime, overlaps } from "@/lib/time";
import { buildIcs, downloadIcs } from "@/lib/ics";
import { useAgenda } from "./agenda-context";
import { Drawer } from "@/components/ui/drawer";
import { PlaceholderTag } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { SITE_URL } from "@/lib/site";

export const CATEGORY_META: Record<SessionCategory, { icon: typeof Mic2; colour: string; soft: string }> = {
  keynote: { icon: Mic2, colour: "#3478F6", soft: "bg-electric/10 text-electric-700" },
  research: { icon: FlaskConical, colour: "#0EA5C6", soft: "bg-cyan/15 text-[#0b6577]" },
  workshop: { icon: Presentation, colour: "#8578F9", soft: "bg-violet/12 text-[#4b3fc4]" },
  networking: { icon: Users, colour: "#12805C", soft: "bg-success/10 text-success" },
  break: { icon: Coffee, colour: "#66758C", soft: "bg-paper-200 text-slate-700" },
  closing: { icon: PartyPopper, colour: "#071426", soft: "bg-navy/10 text-navy" },
};

type View = "timeline" | "cards" | "agenda";

interface Props {
  sessions: Session[];
  speakers: Speaker[];
  workshops: Workshop[];
  rooms: Room[];
  editionName: string;
  venue: string;
}

export function ProgrammeExplorer({ sessions, speakers, workshops, rooms, editionName, venue }: Props) {
  const agenda = useAgenda();
  const toast = useToast();
  const [view, setView] = useState<View>("timeline");
  const [query, setQuery] = useState("");
  const [cats, setCats] = useState<Set<SessionCategory>>(new Set());
  const [workshopFilter, setWorkshopFilter] = useState("");
  const [speakerFilter, setSpeakerFilter] = useState("");
  const [selected, setSelected] = useState<Session | null>(null);

  const speakerById = useMemo(() => new Map(speakers.map((s) => [s.id, s])), [speakers]);
  const workshopById = useMemo(() => new Map(workshops.map((w) => [w.id, w])), [workshops]);
  const roomById = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms]);

  const timed = sessions.some((s) => s.startsAt);
  const provisional = sessions.some((s) => s.isProvisional);

  // Deep links: /programme?session=slug and ?view=agenda
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get("session");
    const v = params.get("view");
    if (v === "cards" || v === "agenda" || v === "timeline") setView(v);
    if (slug) {
      const s = sessions.find((x) => x.slug === slug);
      if (s) setSelected(s);
    }
  }, [sessions]);

  const syncUrl = useCallback((session: Session | null, v: View) => {
    const url = new URL(window.location.href);
    if (session) url.searchParams.set("session", session.slug);
    else url.searchParams.delete("session");
    if (v !== "timeline") url.searchParams.set("view", v);
    else url.searchParams.delete("view");
    window.history.replaceState(null, "", url);
  }, []);

  const open = (s: Session) => {
    setSelected(s);
    syncUrl(s, view);
  };
  const close = useCallback(() => {
    setSelected(null);
    syncUrl(null, view);
  }, [syncUrl, view]);

  const changeView = (v: View) => {
    setView(v);
    syncUrl(selected, v);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sessions.filter((s) => {
      if (view === "agenda" && !agenda.sessions.has(s.id)) return false;
      if (cats.size && !cats.has(s.category)) return false;
      if (workshopFilter && s.workshopId !== workshopFilter) return false;
      if (speakerFilter && !s.speakerIds.includes(speakerFilter)) return false;
      if (q) {
        const names = s.speakerIds.map((id) => speakerById.get(id)?.fullName ?? "").join(" ");
        const ws = s.workshopId ? workshopById.get(s.workshopId)?.title ?? "" : "";
        const hay = `${s.title} ${s.description} ${s.objectives.join(" ")} ${names} ${ws} ${SESSION_CATEGORY_LABEL[s.category]}`.toLowerCase();
        if (!q.split(/\s+/).every((w) => hay.includes(w))) return false;
      }
      return true;
    });
  }, [sessions, view, agenda.sessions, cats, workshopFilter, speakerFilter, query, speakerById, workshopById]);

  const savedSessions = useMemo(() => sessions.filter((s) => agenda.sessions.has(s.id)), [sessions, agenda.sessions]);
  const agendaConflicts = useMemo(() => findConflicts(savedSessions), [savedSessions]);

  /** Sessions sharing a time slot in the whole programme (parallel tracks). */
  const parallelCount = useCallback((s: Session) => sessions.filter((o) => o.id !== s.id && overlaps(o, s)).length, [sessions]);

  const groups = useMemo(() => {
    if (!timed) return [{ key: "all", label: null as string | null, items: filtered }];
    const map = new Map<string, Session[]>();
    const untimed: Session[] = [];
    for (const s of filtered) {
      if (!s.startsAt) untimed.push(s);
      else {
        const k = s.startsAt;
        map.set(k, [...(map.get(k) ?? []), s]);
      }
    }
    const out = [...map.entries()]
      .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
      .map(([k, items]) => ({ key: k, label: formatTime(k), items }));
    if (untimed.length) out.push({ key: "tbc", label: "TBC", items: untimed });
    return out;
  }, [filtered, timed]);

  const toggleCat = (c: SessionCategory) => {
    const next = new Set(cats);
    if (next.has(c)) next.delete(c);
    else next.add(c);
    setCats(next);
  };
  const clearFilters = () => {
    setCats(new Set());
    setQuery("");
    setWorkshopFilter("");
    setSpeakerFilter("");
  };
  const filtersActive = cats.size > 0 || query || workshopFilter || speakerFilter;

  const sessionLocation = (s: Session) => {
    const r = s.roomId ? roomById.get(s.roomId) : null;
    return r ? [r.name, r.building].filter(Boolean).join(", ") : null;
  };

  const exportAgenda = () => {
    const exportable = savedSessions.filter((s) => s.startsAt && s.endsAt);
    if (!exportable.length) {
      toast({ tone: "info", title: "Nothing to export yet", body: "Calendar export is available once session times are confirmed." });
      return;
    }
    const ics = buildIcs(
      exportable.map((s) => ({
        uid: `${s.id}@inspirelincoln.uk`,
        title: s.title,
        start: new Date(s.startsAt!),
        end: new Date(s.endsAt!),
        description: s.description,
        location: [sessionLocation(s), venue].filter(Boolean).join(", "),
        url: `${SITE_URL}/programme?session=${s.slug}`,
      })),
      `${editionName}: my agenda`,
    );
    downloadIcs("inspire-agenda.ics", ics);
    const skipped = savedSessions.length - exportable.length;
    toast({ tone: "success", title: "Calendar file downloaded", body: skipped ? `${skipped} session(s) without confirmed times were left out.` : undefined });
  };

  const categories = (Object.keys(SESSION_CATEGORY_LABEL) as SessionCategory[]).filter((c) => sessions.some((s) => s.category === c));
  const sessionWorkshops = workshops.filter((w) => sessions.some((s) => s.workshopId === w.id));
  const sessionSpeakers = speakers.filter((sp) => sessions.some((s) => s.speakerIds.includes(sp.id)));

  return (
    <div>
      {/* Toolbar */}
      <div className="sticky top-[var(--header-h)] z-30 -mx-5 border-b border-navy/10 bg-paper/90 px-5 py-4 backdrop-blur-xl sm:-mx-8 sm:px-8 lg:-mx-12 lg:px-12">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div role="tablist" aria-label="Programme view" className="flex w-fit rounded-full bg-paper-200 p-1">
            {(
              [
                { v: "timeline", label: "Timeline", icon: Rows3 },
                { v: "cards", label: "Cards", icon: LayoutGrid },
                { v: "agenda", label: `My agenda${agenda.sessions.size ? ` (${agenda.sessions.size})` : ""}`, icon: BookmarkCheck },
              ] as const
            ).map(({ v, label, icon: Icon }) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                onClick={() => changeView(v)}
                className={cn("relative flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors", view === v ? "text-paper" : "text-slate-700 hover:text-ink")}
              >
                {view === v && <motion.span layoutId="view-pill" className="absolute inset-0 rounded-full bg-navy" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
                <Icon aria-hidden className="relative size-4" />
                <span className="relative">{label}</span>
              </button>
            ))}
          </div>

          <label className="relative flex-1 lg:max-w-sm">
            <span className="sr-only">Search sessions</span>
            <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search sessions, speakers, topics"
              className="h-11 w-full rounded-full border border-navy/15 bg-white pl-11 pr-4 text-[0.95rem] text-ink placeholder:text-slate focus:border-electric-600 focus:outline-none focus:ring-2 focus:ring-electric/20"
            />
          </label>

          <div className="flex flex-wrap gap-2 lg:ml-auto">
            <select
              aria-label="Filter by workshop"
              value={workshopFilter}
              onChange={(e) => setWorkshopFilter(e.target.value)}
              disabled={!sessionWorkshops.length}
              className="h-11 rounded-full border border-navy/15 bg-white px-4 text-sm text-ink disabled:opacity-50"
            >
              <option value="">{sessionWorkshops.length ? "All workshops" : "Workshops: times TBC"}</option>
              {sessionWorkshops.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.number}. {w.title}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by speaker"
              value={speakerFilter}
              onChange={(e) => setSpeakerFilter(e.target.value)}
              disabled={!sessionSpeakers.length}
              className="h-11 rounded-full border border-navy/15 bg-white px-4 text-sm text-ink disabled:opacity-50"
            >
              <option value="">{sessionSpeakers.length ? "All speakers" : "Speakers: coming soon"}</option>
              {sessionSpeakers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" role="group" aria-label="Filter by session category">
          {categories.map((c) => {
            const on = cats.has(c);
            const Icon = CATEGORY_META[c].icon;
            return (
              <button
                key={c}
                type="button"
                aria-pressed={on}
                onClick={() => toggleCat(c)}
                className={cn(
                  "flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[0.8125rem] font-medium transition-colors",
                  on ? "border-navy bg-navy text-paper" : "border-navy/15 bg-white text-slate-700 hover:border-navy/40",
                )}
              >
                <Icon aria-hidden className="size-3.5" />
                {SESSION_CATEGORY_LABEL[c]}
              </button>
            );
          })}
          {filtersActive && (
            <button type="button" onClick={clearFilters} className="flex min-h-9 shrink-0 items-center gap-1 rounded-full px-3 text-[0.8125rem] font-medium text-electric-600 hover:underline">
              <X aria-hidden className="size-3.5" /> Clear
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 py-6">
        <p aria-live="polite" className="text-sm text-slate">
          {filtered.length} {filtered.length === 1 ? "session" : "sessions"}
          {view === "agenda" ? " in your agenda" : ""}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {provisional && <PlaceholderTag>Provisional programme</PlaceholderTag>}
          {view === "agenda" && savedSessions.length > 0 && (
            <button type="button" onClick={exportAgenda} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-navy px-4 text-sm font-medium text-paper hover:bg-navy-700">
              <CalendarPlus aria-hidden className="size-4" /> Export to calendar
            </button>
          )}
        </div>
      </div>

      {view === "agenda" && (
        <div className="mb-6 space-y-3">
          {!agenda.signedIn && (
            <p className="rounded-md border border-navy/10 bg-white p-4 text-sm text-slate-700">
              Your agenda is saved in this browser.{" "}
              <Link href="/login?next=/programme?view=agenda" className="font-medium text-electric-600 underline underline-offset-4">
                Sign in
              </Link>{" "}
              to keep it across devices.
            </p>
          )}
          {agendaConflicts.size > 0 && (
            <p role="alert" className="flex items-start gap-3 rounded-md border border-warning/30 bg-warning/[0.07] p-4 text-sm text-slate-700">
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
              {agendaConflicts.size} sessions in your agenda overlap. Conflicting sessions are marked below.
            </p>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState view={view} onClear={clearFilters} filtersActive={Boolean(filtersActive)} />
      ) : view === "cards" ? (
        <LayoutGroup>
          <motion.ul layout className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence initial={false}>
              {filtered.map((s) => (
                <motion.li key={s.id} layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}>
                  <SessionCard session={s} onOpen={open} speakerById={speakerById} location={sessionLocation(s)} conflict={agendaConflicts.has(s.id)} parallel={parallelCount(s)} />
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
        </LayoutGroup>
      ) : (
        <ol className="relative">
          {groups.map((g) => (
            <li key={g.key} className="relative grid gap-4 pb-8 sm:grid-cols-[6.5rem_1fr]">
              <div className="sm:sticky sm:top-[calc(var(--header-h)+9rem)] sm:self-start">
                {g.label ? (
                  <p className="font-display text-2xl font-semibold tabular-nums text-ink">{g.label}</p>
                ) : (
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate">In order</p>
                )}
                {g.items.length > 1 && g.label && <p className="mt-1 text-xs text-slate">{g.items.length} parallel sessions</p>}
              </div>
              <ul className={cn("grid gap-3", g.label && g.items.length > 1 && "lg:grid-cols-2")}>
                {g.items.map((s) => (
                  <motion.li key={s.id} layout="position">
                    <SessionRow session={s} onOpen={open} speakerById={speakerById} location={sessionLocation(s)} conflict={agendaConflicts.has(s.id)} parallel={parallelCount(s)} />
                  </motion.li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}

      <Drawer open={Boolean(selected)} onClose={close} label={selected ? selected.title : "Session details"}>
        {selected && (
          <SessionDetail
            session={selected}
            speakers={selected.speakerIds.map((id) => speakerById.get(id)).filter((x): x is Speaker => Boolean(x))}
            workshop={selected.workshopId ? workshopById.get(selected.workshopId) ?? null : null}
            room={selected.roomId ? roomById.get(selected.roomId) ?? null : null}
            venue={venue}
            parallel={parallelCount(selected)}
            conflictsWith={savedSessions.filter((o) => o.id !== selected.id && overlaps(o, selected))}
          />
        )}
      </Drawer>
    </div>
  );
}

function EmptyState({ view, onClear, filtersActive }: { view: View; onClear: () => void; filtersActive: boolean }) {
  return (
    <div className="rounded-xl border border-dashed border-navy/15 bg-white px-6 py-16 text-center">
      <BookmarkPlus aria-hidden className="mx-auto size-8 text-slate" />
      <p className="mt-4 font-display text-xl font-medium text-ink">
        {view === "agenda" && !filtersActive ? "Your agenda is empty" : "No sessions match"}
      </p>
      <p className="mx-auto mt-2 max-w-md text-slate-700">
        {view === "agenda" && !filtersActive
          ? "Open any session and choose “Add to my agenda” to build your personal plan for the day."
          : "Try removing a filter or searching for something broader."}
      </p>
      {filtersActive && (
        <button type="button" onClick={onClear} className="mt-6 rounded-full bg-navy px-5 py-2.5 text-sm font-medium text-paper">
          Clear filters
        </button>
      )}
    </div>
  );
}

interface ItemProps {
  session: Session;
  onOpen: (s: Session) => void;
  speakerById: Map<string, Speaker>;
  location: string | null;
  conflict: boolean;
  parallel: number;
}

function SaveButton({ session, compact = false }: { session: Session; compact?: boolean }) {
  const agenda = useAgenda();
  const saved = agenda.sessions.has(session.id);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        agenda.toggleSession(session.id, session.title);
      }}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${session.title} from my agenda` : `Add ${session.title} to my agenda`}
      className={cn(
        "relative z-10 flex shrink-0 items-center justify-center gap-2 rounded-full border transition-all",
        compact ? "size-11" : "min-h-11 px-4 text-sm font-medium",
        saved ? "border-electric-600 bg-electric-600 text-white" : "border-navy/15 bg-white text-ink hover:border-electric-600 hover:text-electric-600",
      )}
    >
      <motion.span key={String(saved)} initial={{ scale: 0.6, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 500, damping: 18 }}>
        {saved ? <BookmarkCheck aria-hidden className="size-[1.1rem]" /> : <BookmarkPlus aria-hidden className="size-[1.1rem]" />}
      </motion.span>
      {!compact && (saved ? "In my agenda" : "Add to my agenda")}
    </button>
  );
}

function SessionMetaLine({ session, location }: { session: Session; location: string | null }) {
  const mins = durationMinutes(session);
  return (
    <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate">
      <span className="flex items-center gap-1.5">
        <Clock aria-hidden className="size-3.5" />
        {session.startsAt ? `${formatTime(session.startsAt)}${session.endsAt ? ` to ${formatTime(session.endsAt)}` : ""}` : "Time TBC"}
        {mins ? ` · ${formatDuration(mins)}` : ""}
      </span>
      <span className="flex items-center gap-1.5">
        <MapPin aria-hidden className="size-3.5" />
        {location ?? "Room TBC"}
      </span>
    </span>
  );
}

function SessionRow({ session, onOpen, speakerById, location, conflict, parallel }: ItemProps) {
  const meta = CATEGORY_META[session.category];
  const Icon = meta.icon;
  const names = session.speakerIds.map((id) => speakerById.get(id)?.fullName).filter(Boolean);
  return (
    <div
      className={cn(
        "group relative flex items-start gap-4 overflow-hidden rounded-lg border bg-white p-5 transition-[border-color,box-shadow] hover:border-navy/25 hover:shadow-[0_16px_40px_-24px_rgba(7,20,38,0.4)]",
        conflict ? "border-warning/50" : "border-navy/10",
        session.category === "break" && "bg-paper-200/60",
      )}
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: meta.colour }} />
      <span className={cn("mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full", meta.soft)}>
        <Icon aria-hidden className="size-[1.1rem]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate">{SESSION_CATEGORY_LABEL[session.category]}</p>
        <button type="button" onClick={() => onOpen(session)} className="mt-1 text-left font-display text-lg font-medium leading-snug text-ink after:absolute after:inset-0 after:content-[''] focus-visible:outline-none group-focus-within:underline">
          {session.title}
        </button>
        {names.length > 0 && <p className="mt-1 text-sm text-slate-700">{names.join(", ")}</p>}
        <div className="mt-3">
          <SessionMetaLine session={session} location={location} />
        </div>
        {(conflict || parallel > 0) && (
          <p className={cn("mt-3 flex items-center gap-1.5 text-xs font-medium", conflict ? "text-warning" : "text-slate")}>
            <AlertTriangle aria-hidden className="size-3.5" />
            {conflict ? "Clashes with another session in your agenda" : `Runs alongside ${parallel} other session${parallel === 1 ? "" : "s"}`}
          </p>
        )}
      </div>
      {session.category !== "break" && <SaveButton session={session} compact />}
    </div>
  );
}

function SessionCard(props: ItemProps) {
  const { session, onOpen, speakerById, location, conflict, parallel } = props;
  const meta = CATEGORY_META[session.category];
  const Icon = meta.icon;
  const names = session.speakerIds.map((id) => speakerById.get(id)?.fullName).filter(Boolean);
  return (
    <div className={cn("group relative flex h-full flex-col rounded-lg border bg-white p-6 transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:shadow-[0_24px_48px_-28px_rgba(7,20,38,0.45)]", conflict ? "border-warning/50" : "border-navy/10")}>
      <div className="flex items-start justify-between gap-4">
        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", meta.soft)}>
          <Icon aria-hidden className="size-3.5" />
          {SESSION_CATEGORY_LABEL[session.category]}
        </span>
        {session.category !== "break" && <SaveButton session={session} compact />}
      </div>
      <button type="button" onClick={() => onOpen(session)} className="mt-5 text-left font-display text-xl font-medium leading-snug text-ink after:absolute after:inset-0 after:content-[''] focus-visible:outline-none group-focus-within:underline">
        {session.title}
      </button>
      {names.length > 0 && <p className="mt-1 text-sm text-slate-700">{names.join(", ")}</p>}
      <p className="mt-3 line-clamp-3 text-[0.95rem] leading-relaxed text-slate-700">{session.description}</p>
      <div className="mt-auto pt-5">
        <SessionMetaLine session={session} location={location} />
        {(conflict || parallel > 0) && (
          <p className={cn("mt-2 flex items-center gap-1.5 text-xs font-medium", conflict ? "text-warning" : "text-slate")}>
            <AlertTriangle aria-hidden className="size-3.5" />
            {conflict ? "Clashes with your agenda" : `Runs alongside ${parallel} other session${parallel === 1 ? "" : "s"}`}
          </p>
        )}
      </div>
    </div>
  );
}

function SessionDetail({
  session,
  speakers,
  workshop,
  room,
  venue,
  parallel,
  conflictsWith,
}: {
  session: Session;
  speakers: Speaker[];
  workshop: Workshop | null;
  room: Room | null;
  venue: string;
  parallel: number;
  conflictsWith: Session[];
}) {
  const toast = useToast();
  const meta = CATEGORY_META[session.category];
  const Icon = meta.icon;
  const mins = durationMinutes(session);
  const shareUrl = `${SITE_URL}/programme?session=${session.slug}`;

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: session.title, url: shareUrl });
      else {
        await navigator.clipboard.writeText(shareUrl);
        toast({ tone: "success", title: "Link copied" });
      }
    } catch {
      // User dismissed the share sheet.
    }
  };

  const addToCalendar = () => {
    if (!session.startsAt || !session.endsAt) return;
    downloadIcs(
      `${session.slug}.ics`,
      buildIcs([
        {
          uid: `${session.id}@inspirelincoln.uk`,
          title: session.title,
          start: new Date(session.startsAt),
          end: new Date(session.endsAt),
          description: session.description,
          location: [room?.name, venue].filter(Boolean).join(", "),
          url: shareUrl,
        },
      ]),
    );
  };

  return (
    <article>
      <header className="relative overflow-hidden bg-navy px-6 pb-8 pt-16 text-paper sm:px-8">
        <div aria-hidden className="grid-lines absolute inset-0 opacity-60" />
        <div aria-hidden className="absolute -right-16 -top-16 size-56 rounded-full blur-3xl" style={{ background: `${meta.colour}55` }} />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-paper">
            <Icon aria-hidden className="size-3.5" />
            {SESSION_CATEGORY_LABEL[session.category]}
          </span>
          {session.isProvisional && (
            <span className="ml-2">
              <PlaceholderTag dark>Provisional</PlaceholderTag>
            </span>
          )}
          <h2 className="mt-4 font-display text-3xl font-semibold leading-tight" data-autofocus tabIndex={-1}>
            {session.title}
          </h2>
        </div>
      </header>
      <div className="space-y-8 px-6 py-8 sm:px-8">
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div className="rounded-md bg-paper p-4">
            <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate">Time</dt>
            <dd className="mt-1 font-medium text-ink">{session.startsAt ? `${formatTime(session.startsAt)}${session.endsAt ? ` to ${formatTime(session.endsAt)}` : ""}` : "To be confirmed"}</dd>
          </div>
          <div className="rounded-md bg-paper p-4">
            <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate">Duration</dt>
            <dd className="mt-1 font-medium text-ink">{formatDuration(mins) ?? "To be confirmed"}</dd>
          </div>
          <div className="rounded-md bg-paper p-4">
            <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate">Location</dt>
            <dd className="mt-1 font-medium text-ink">{room ? room.name : "To be confirmed"}</dd>
            {room?.directions && <dd className="mt-1 text-slate-700">{room.directions}</dd>}
          </div>
          <div className="rounded-md bg-paper p-4">
            <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate">Capacity</dt>
            <dd className="mt-1 font-medium text-ink">{session.capacity ? `${session.capacity} places` : "Not applicable"}</dd>
          </div>
        </dl>

        {conflictsWith.length > 0 && (
          <p role="alert" className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/[0.07] p-4 text-sm text-slate-700">
            <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
            Overlaps with {conflictsWith.map((c) => c.title).join(", ")} in your agenda.
          </p>
        )}
        {parallel > 0 && conflictsWith.length === 0 && <p className="text-sm text-slate">Runs alongside {parallel} other session{parallel === 1 ? "" : "s"}.</p>}

        <div className="flex flex-wrap gap-2">
          {session.category !== "break" && <SaveButton session={session} />}
          <button
            type="button"
            onClick={addToCalendar}
            disabled={!session.startsAt || !session.endsAt}
            title={!session.startsAt ? "Available once the time is confirmed" : undefined}
            className="flex min-h-11 items-center gap-2 rounded-full border border-navy/15 px-4 text-sm font-medium text-ink hover:border-navy/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CalendarPlus aria-hidden className="size-4" /> Add to calendar
          </button>
          <button type="button" onClick={share} className="flex min-h-11 items-center gap-2 rounded-full border border-navy/15 px-4 text-sm font-medium text-ink hover:border-navy/40">
            <Link2 aria-hidden className="size-4" /> Share
          </button>
        </div>
        {!session.startsAt && <p className="-mt-4 text-xs text-slate">Calendar export becomes available when the time is confirmed.</p>}

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate">About this session</h3>
          <p className="mt-3 leading-relaxed text-slate-700">{session.description}</p>
        </section>

        {session.objectives.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate">Learning objectives</h3>
            <ul className="mt-3 space-y-2">
              {session.objectives.map((o) => (
                <li key={o} className="flex gap-3 text-slate-700">
                  <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full" style={{ background: meta.colour }} />
                  {o}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate">{session.category === "workshop" ? "Facilitator" : "Speaker"}</h3>
          {speakers.length ? (
            <ul className="mt-3 space-y-3">
              {speakers.map((s) => (
                <li key={s.id}>
                  <Link href={`/speakers/${s.slug}`} className="group flex items-center justify-between rounded-md border border-navy/10 p-4 hover:border-electric-600/40">
                    <span>
                      <span className="block font-medium text-ink">{s.fullName}</span>
                      <span className="block text-sm text-slate-700">{[s.position, s.institution].filter(Boolean).join(", ")}</span>
                    </span>
                    <span className="text-sm font-medium text-electric-600">Profile</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-slate-700">{workshop?.facilitator ?? "To be announced."}</p>
          )}
        </section>

        {workshop && (
          <Link href={`/workshops/${workshop.slug}`} className="block rounded-md bg-navy p-5 text-paper hover:bg-navy-700">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan">Workshop {workshop.number}</span>
            <span className="mt-1 block font-display text-lg font-medium">{workshop.title}</span>
          </Link>
        )}
      </div>
    </article>
  );
}
