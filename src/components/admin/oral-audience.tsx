"use client";
import { useActionState, useMemo, useState, useTransition } from "react";
import { Loader2, Lock, LockOpen, Search, Shuffle } from "lucide-react";
import { runAudienceSplit, saveAudiencePublish, setAudiencePlace, type OralResult } from "@/app/admin/orals/actions";
import { btn } from "@/components/admin/ui";
import { inputClass } from "@/components/forms/field";
import { cn } from "@/lib/cn";
import { AUDIENCE_DEFAULT_GROUPS, AUDIENCE_GROUP_LABEL, AUDIENCE_GROUPS, type AudiencePerson } from "@/lib/orals/groups";
import type { OralPlacement } from "@/lib/orals/allocate";
import { roomColour, type BoardRoom } from "@/components/admin/oral-board";

function Result({ r }: { r: OralResult }) {
  if (!r) return null;
  return (
    <p role={r.ok ? "status" : "alert"} className={cn("text-sm font-medium", r.ok ? "text-success" : "text-danger")}>
      {r.ok ? r.message : r.error}
    </p>
  );
}

/** "Isaac Newton Building" in building "Isaac Newton Building (INB)" reads as "INB" on a small button. */
export function shortRoom(r: Pick<BoardRoom, "name" | "building">) {
  if (r.name.length <= 9) return r.name;
  const code = r.building?.match(/\(([A-Z]{2,6})\)/)?.[1];
  return code ?? r.name;
}

type Place = { roomId: string | null; locked: boolean };

/**
 * The audience: everyone else attending, each in one room for the whole
 * oral session because the buildings are too far apart to swap. Split at
 * random, then move anyone with one tap. Moving someone locks them.
 */
export function OralAudienceEditor({
  rooms,
  people,
  board,
  version,
}: {
  rooms: BoardRoom[];
  people: AudiencePerson[];
  board: OralPlacement[];
  version: number;
}) {
  const [run, runAction, running] = useActionState(runAudienceSplit, null);
  const [overrides, setOverrides] = useState(new Map<string, Place>());
  const [busy, setBusy] = useState(new Set<string>());
  const [msg, setMsg] = useState<OralResult>(null);
  const [, start] = useTransition();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("all");

  // A new split from the server replaces any taps still showing.
  const [seenVersion, setSeenVersion] = useState(version);
  if (version !== seenVersion) {
    setSeenVersion(version);
    setOverrides(new Map());
  }

  const roomIds = useMemo(() => new Set(rooms.map((r) => r.id)), [rooms]);
  const fromServer = useMemo(() => new Map(board.map((p) => [p.key, { roomId: p.roomId && roomIds.has(p.roomId) ? p.roomId : null, locked: p.locked }])), [board, roomIds]);
  const placeOf = (key: string): Place => overrides.get(key) ?? fromServer.get(key) ?? { roomId: null, locked: false };

  const counts = new Map(rooms.map((r) => [r.id, 0]));
  let unplaced = 0;
  let locked = 0;
  let unlockedPlaced = 0;
  for (const p of people) {
    const at = placeOf(p.key);
    if (at.roomId) counts.set(at.roomId, (counts.get(at.roomId) ?? 0) + 1);
    else unplaced++;
    if (at.locked) locked++;
    else if (at.roomId) unlockedPlaced++;
  }
  const byGroup = new Map(AUDIENCE_GROUPS.map((g) => [g, people.filter((p) => p.group === g).length]));

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return people.filter((p) => {
      if (t && !p.name.toLowerCase().includes(t) && !(p.institution ?? "").toLowerCase().includes(t)) return false;
      const at = overrides.get(p.key) ?? fromServer.get(p.key) ?? { roomId: null, locked: false };
      if (filter === "all") return true;
      if (filter === "none") return !at.roomId;
      if (filter === "locked") return at.locked;
      if (filter.startsWith("g:")) return p.group === filter.slice(2);
      return at.roomId === filter;
    });
  }, [people, q, filter, overrides, fromServer]);

  const set = (p: AudiencePerson, next: Place) => {
    const prev = overrides.get(p.key);
    setOverrides((m) => new Map(m).set(p.key, next));
    setBusy((b) => new Set(b).add(p.key));
    setMsg(null);
    start(async () => {
      const res = await setAudiencePlace(p.key, next.roomId, next.locked);
      setBusy((b) => {
        const n = new Set(b);
        n.delete(p.key);
        return n;
      });
      if (!res?.ok) {
        setOverrides((m) => {
          const n = new Map(m);
          if (prev) n.set(p.key, prev);
          else n.delete(p.key);
          return n;
        });
        setMsg(res ?? { ok: false, error: `We couldn't move ${p.name}. Please try again.` });
      }
    });
  };

  return (
    <div className="space-y-5">
      <ul className="grid grid-cols-3 gap-2 sm:gap-3">
        {rooms.map((r, i) => {
          const n = counts.get(r.id) ?? 0;
          const c = roomColour(i);
          const over = r.seats != null && n > r.seats;
          return (
            <li key={r.id} className="min-w-0 rounded-xl p-3 sm:p-4" style={{ background: c.tint }}>
              <p className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-ink sm:gap-2 sm:text-base">
                <span aria-hidden className="size-2.5 shrink-0 rounded-full sm:size-3" style={{ background: c.solid }} />
                <span className="truncate sm:hidden">{shortRoom(r)}</span>
                <span className="hidden truncate sm:inline">{r.name}</span>
              </p>
              <p className="mt-1 font-display text-2xl text-ink sm:text-3xl">
                {n}
                {r.seats != null && <span className="block text-xs text-slate-700 sm:inline sm:text-base"> / {r.seats} seats</span>}
              </p>
              {over && <p className="text-sm font-medium text-danger">More people than seats</p>}
            </li>
          );
        })}
        <li className="min-w-0 rounded-xl border border-dashed border-navy/20 p-3 sm:p-4">
          <p className="truncate text-xs font-semibold text-ink sm:text-base">
            <span className="sm:hidden">No room</span>
            <span className="hidden sm:inline">Not in a room</span>
          </p>
          <p className="mt-1 font-display text-2xl text-ink sm:text-3xl">{unplaced}</p>
        </li>
      </ul>

      <form
        action={runAction}
        onSubmit={(e) => {
          if (unlockedPlaced && !confirm("This reshuffles everyone who isn't locked. Locked people stay in their room. Split at random?")) e.preventDefault();
        }}
        className="space-y-3 rounded-xl border border-navy/10 bg-paper/50 p-4"
      >
        <input type="hidden" name="version" value={version} />
        <fieldset>
          <legend className="text-sm font-semibold text-ink">Who to share out</legend>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
            {AUDIENCE_GROUPS.filter((g) => (byGroup.get(g) ?? 0) > 0).map((g) => (
              <label key={g} className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" name="group" value={g} defaultChecked={AUDIENCE_DEFAULT_GROUPS.includes(g)} className="size-5 accent-navy" />
                {AUDIENCE_GROUP_LABEL[g].many} ({byGroup.get(g)})
              </label>
            ))}
          </div>
        </fieldset>
        <p className="text-sm text-slate-700">
          Shares them between the rooms at random, in proportion to each room&apos;s seats (evenly if seats aren&apos;t set). Anyone not ticked, and anyone locked, stays where they are.
          {locked > 0 && <strong className="font-semibold text-ink"> {locked} locked.</strong>}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button className={btn.primary} disabled={running || rooms.length < 2}>
            {running ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Shuffle aria-hidden className="size-4" />}
            {unplaced < people.length ? "Split at random again" : "Split at random"}
          </button>
          <Result r={run} />
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-0 flex-1 basis-56 sm:max-w-sm">
          <span className="sr-only">Search by name or university</span>
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or university" className={cn(inputClass, "pl-9")} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="font-semibold text-ink">Show</span>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className={cn(inputClass.replace("w-full", "w-auto"), "px-3")}>
            <option value="all">Everyone</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                In {r.name}
              </option>
            ))}
            <option value="none">Not in a room</option>
            <option value="locked">Locked</option>
            {AUDIENCE_GROUPS.filter((g) => (byGroup.get(g) ?? 0) > 0).map((g) => (
              <option key={g} value={`g:${g}`}>
                {AUDIENCE_GROUP_LABEL[g].many}
              </option>
            ))}
          </select>
        </label>
        <p className="text-sm text-slate-700" aria-live="polite">
          {shown.length} of {people.length}
        </p>
      </div>
      <Result r={msg} />

      <ul className="divide-y divide-navy/10 rounded-xl border border-navy/10 bg-white">
        {shown.map((p) => {
          const at = placeOf(p.key);
          const i = rooms.findIndex((r) => r.id === at.roomId);
          return (
            <li key={p.key} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 sm:px-4">
              <span aria-hidden className={cn("size-3 shrink-0 rounded-full", i < 0 && "border-2 border-navy/25")} style={i >= 0 ? { background: roomColour(i).solid } : undefined} />
              <span className="min-w-0 flex-1 basis-44">
                <span className="block truncate font-semibold text-ink">{p.name}</span>
                <span className="block truncate text-xs text-slate-700">
                  {[AUDIENCE_GROUP_LABEL[p.group].one, p.institution, p.hasAccount ? null : "No account yet"].filter(Boolean).join(" · ")}
                </span>
              </span>
              <span className="flex items-center gap-1.5">
                <span role="group" aria-label={`Room for ${p.name}`} className="inline-flex rounded-lg border border-navy/15 p-0.5">
                  {rooms.map((r, n) => {
                    const on = at.roomId === r.id;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        aria-pressed={on}
                        title={r.name}
                        onClick={() => !on && set(p, { roomId: r.id, locked: true })}
                        className={cn("min-h-9 min-w-14 rounded-md px-3 text-sm font-semibold transition-colors", on ? "text-white" : "text-slate-700 hover:bg-paper-200")}
                        style={on ? { background: roomColour(n).solid } : undefined}
                      >
                        {shortRoom(r)}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    aria-pressed={!at.roomId}
                    title="Not in a room"
                    onClick={() => at.roomId && set(p, { roomId: null, locked: true })}
                    className={cn("min-h-9 rounded-md px-2.5 text-sm font-semibold", !at.roomId ? "bg-paper-200 text-ink" : "text-slate-700 hover:bg-paper-200")}
                  >
                    None
                  </button>
                </span>
                <button
                  type="button"
                  onClick={() => set(p, { ...at, locked: !at.locked })}
                  aria-pressed={at.locked}
                  aria-label={at.locked ? `Unlock ${p.name}` : `Lock ${p.name} where they are`}
                  title={at.locked ? "Locked: splitting at random keeps them here" : "Lock, so splitting at random keeps them here"}
                  className={cn("grid size-10 place-items-center rounded-lg border", at.locked ? "border-navy bg-navy text-paper" : "border-navy/15 text-slate hover:text-ink")}
                >
                  {busy.has(p.key) ? <Loader2 aria-hidden className="size-4 animate-spin" /> : at.locked ? <Lock aria-hidden className="size-4" /> : <LockOpen aria-hidden className="size-4" />}
                </button>
              </span>
            </li>
          );
        })}
        {!shown.length && <li className="p-6 text-center text-sm text-slate-700">No one matches.</li>}
      </ul>
    </div>
  );
}

/** Show or hide each member of the audience's room. */
export function AudiencePublishForm({ published, hasPlaces }: { published: boolean; hasPlaces: boolean }) {
  const [r, action, pending] = useActionState(saveAudiencePublish, null);
  return (
    <form action={action} className="space-y-4">
      <label className="flex items-start gap-3">
        <input type="checkbox" name="publish" defaultChecked={published} disabled={!hasPlaces && !published} className="mt-1 size-5 shrink-0 accent-navy disabled:opacity-50" />
        <span>
          <span className="block font-semibold text-ink">Show the audience their room</span>
          <span className="block text-sm text-slate-700">
            {hasPlaces
              ? "Everyone placed sees their room for the oral presentations in My Hub and in their day, and the “where to go next” alert sends them there. Anyone you placed in an oral session on the On the day page (a judge, say) keeps that place. Changes show straight away."
              : "Available once people are in rooms."}
          </span>
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button className={btn.primary} disabled={pending}>
          {pending && <Loader2 aria-hidden className="size-4 animate-spin" />} Save
        </button>
        <Result r={r} />
      </div>
    </form>
  );
}
