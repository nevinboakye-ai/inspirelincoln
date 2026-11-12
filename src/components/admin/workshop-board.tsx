"use client";
import { useActionState, useMemo, useState, useTransition } from "react";
import { Loader2, Play, Search } from "lucide-react";
import { runAllocation, saveChoiceSettings, saveWorkshopRooms, setPlace, type BoardResult } from "@/app/admin/workshops/actions";
import { btn } from "@/components/admin/ui";
import { inputClass } from "@/components/forms/field";
import { cn } from "@/lib/cn";
import { workshopColour } from "@/lib/workshops/colours";
import { WORKSHOP_ROOMS } from "@/lib/workshops/rooms";

function Result({ r }: { r: BoardResult }) {
  if (!r) return null;
  return (
    <p role={r.ok ? "status" : "alert"} className={cn("text-sm font-medium", r.ok ? "text-success" : "text-danger")}>
      {r.ok ? r.message : r.error}
    </p>
  );
}


/** Open or close workshop ranking, set when it closes, and publish places. */
export function ChoiceSettingsForm({ open, closesAt, published, hasPlaces }: { open: boolean; closesAt: string; published: boolean; hasPlaces: boolean }) {
  const [r, action, pending] = useActionState(saveChoiceSettings, null);
  return (
    <form action={action} className="space-y-4">
      <label className="flex items-start gap-3">
        <input type="checkbox" name="open" defaultChecked={open} className="mt-1 size-5 accent-navy" />
        <span>
          <span className="block font-semibold text-ink">Open workshop ranking to delegates</span>
          <span className="block text-sm text-slate-700">Everyone with a confirmed place sees &ldquo;Rank your workshops&rdquo; at the top of My Hub and can change their order until ranking closes.</span>
        </span>
      </label>
      <div>
        <label htmlFor="closes_at" className="block font-semibold text-ink">
          Closes <span className="font-normal text-slate-700">(optional, UK time)</span>
        </label>
        <p id="closes_at-hint" className="text-sm text-slate-700">Ranking closes by itself at this time. Leave empty to close it yourself.</p>
        <input id="closes_at" name="closes_at" type="datetime-local" defaultValue={closesAt} aria-describedby="closes_at-hint" className={cn(inputClass, "mt-2 max-w-xs")} />
      </div>
      <label className="flex items-start gap-3">
        <input type="checkbox" name="publish" defaultChecked={published} disabled={!hasPlaces && !published} className="mt-1 size-5 accent-navy disabled:opacity-50" />
        <span>
          <span className="block font-semibold text-ink">Show delegates their workshops</span>
          <span className="block text-sm text-slate-700">
            {hasPlaces ? "Each delegate sees their three workshops in My Hub, with the session, time and room for each." : "Available once you've run the allocation."}
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

const ordinal = (n: number) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;

type RoomW = { id: string; number: number; title: string; room: string | null; capacity: number | null };

/** The room each workshop runs in, and how many it holds in one session. */
export function WorkshopRoomsForm({ workshops }: { workshops: RoomW[] }) {
  const [r, action, pending] = useActionState(saveWorkshopRooms, null);
  const [rows, setRows] = useState(workshops);
  const set = (id: string, patch: Partial<RoomW>) => setRows((rs) => rs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const taken = rows.map((w) => w.room).filter(Boolean);
  const clash = taken.find((x, i) => taken.indexOf(x) !== i);
  const noRoom = rows.filter((w) => !w.room).length;
  const noSize = rows.filter((w) => w.capacity == null).length;
  return (
    <form action={action} className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[30rem] text-left text-sm">
          <thead>
            <tr className="border-b border-navy/10 text-xs uppercase tracking-[0.1em] text-slate-700">
              <th scope="col" className="py-2 pr-3 font-semibold">Workshop</th>
              <th scope="col" className="py-2 pr-3 font-semibold">Room</th>
              <th scope="col" className="py-2 font-semibold">Places each session</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy/10">
            {rows.map((w) => (
              <tr key={w.id}>
                <th scope="row" className="py-3 pr-3 font-semibold text-ink">
                  <input type="hidden" name="id" value={w.id} />
                  <span className="flex items-center gap-2.5">
                    <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ background: workshopColour(w.number).solid }} />
                    {w.title}
                  </span>
                </th>
                <td className="py-3 pr-3">
                  <select name={`room_${w.id}`} aria-label={`Room for ${w.title}`} value={w.room ?? ""} onChange={(e) => set(w.id, { room: e.target.value || null })} className={cn(inputClass.replace("w-full", "w-auto"), "px-3")}>
                    <option value="">Not set</option>
                    {WORKSHOP_ROOMS.map((room) => (
                      <option key={room} value={room}>
                        {room}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-3">
                  <input
                    name={`capacity_${w.id}`}
                    aria-label={`Places each session for ${w.title}`}
                    type="number"
                    min={1}
                    max={2000}
                    inputMode="numeric"
                    placeholder="No limit"
                    value={w.capacity ?? ""}
                    onChange={(e) => set(w.id, { capacity: e.target.value ? Number(e.target.value) : null })}
                    className={cn(inputClass.replace("w-full", "w-24"), "px-3")}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(clash || noRoom > 0 || noSize > 0) && (
        <ul className="space-y-1 rounded-md border border-warning/30 bg-warning/[0.07] p-3 text-sm text-ink">
          {clash && <li>{clash} is set for two workshops. All six run at the same time, so each needs its own room.</li>}
          {noRoom > 0 && <li>{noRoom === 1 ? "One workshop doesn't" : `${noRoom} workshops don't`} have a room yet. Delegates see the room with their places.</li>}
          {noSize > 0 && <li>{noSize === 1 ? "One workshop has" : `${noSize} workshops have`} no room size, so the allocation won&apos;t limit {noSize === 1 ? "it" : "them"}.</li>}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button className={btn.primary} disabled={pending}>
          {pending && <Loader2 aria-hidden className="size-4 animate-spin" />} Save rooms and sizes
        </button>
        <Result r={r} />
      </div>
    </form>
  );
}

/** Runs the allocation. */
export function RunAllocationForm({ unranked, hasPlaces, ready }: { unranked: number; hasPlaces: boolean; ready: boolean }) {
  const [r, action, pending] = useActionState(runAllocation, null);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (hasPlaces && !confirm("This replaces the current places, including any moves made by hand. Run it again?")) e.preventDefault();
      }}
      className="space-y-4"
    >
      <label className="flex items-start gap-3">
        <input type="checkbox" name="unranked" defaultChecked className="mt-1 size-5 accent-navy" />
        <span>
          <span className="block font-semibold text-ink">Also place delegates who haven&apos;t ranked ({unranked})</span>
          <span className="block text-sm text-slate-700">They go to the workshops with most space left, after everyone who ranked. Committee members are only placed if they ranked.</span>
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button className={btn.primary} disabled={pending || !ready}>
          {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Play aria-hidden className="size-4" />} {hasPlaces ? "Run the allocation again" : "Run the allocation"}
        </button>
        <Result r={r} />
      </div>
    </form>
  );
}

export type PlaceRow = {
  id: string;
  name: string;
  institution: string | null;
  ranked: boolean;
  committee: boolean;
  slots: { slot: number; workshopId: string | null; choice: number | null; manual: boolean }[];
};
type BoardW = { id: string; number: number; title: string };

/** Everyone's places, with a way to change anyone's workshop in any session. */
export function PlacesTable({ rows, workshops }: { rows: PlaceRow[]; workshops: BoardW[] }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "outside" | "missing" | "unranked">("all");
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<BoardResult>(null);
  const byId = useMemo(() => new Map(workshops.map((w) => [w.id, w])), [workshops]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (!t || r.name.toLowerCase().includes(t) || (r.institution ?? "").toLowerCase().includes(t)) &&
        (filter === "all" ||
          (filter === "unranked"
            ? !r.ranked
            : filter === "missing"
              ? r.slots.some((s) => !s.workshopId)
              : r.slots.some((s) => (s.choice && s.choice > 3) || s.manual))),
    );
  }, [rows, q, filter]);
  const change = (r: PlaceRow, slot: number, workshopId: string | null) => {
    setBusy(`${r.id}:${slot}`);
    start(async () => {
      const res = await setPlace(r.id, slot, workshopId);
      setMsg(res && res.ok ? { ok: true, message: `${r.name}: ${res.message}` } : res);
      setBusy(null);
    });
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-0 flex-1 sm:max-w-sm">
          <span className="sr-only">Search by name or university</span>
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or university" className={cn(inputClass, "pl-9")} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="font-semibold text-ink">Show</span>
          <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className={cn(inputClass.replace("w-full", "w-auto"), "px-3")}>
            <option value="all">Everyone</option>
            <option value="outside">Outside their top three, or moved by hand</option>
            <option value="missing">Missing a session</option>
            <option value="unranked">Didn&apos;t rank</option>
          </select>
        </label>
        <p className="text-sm text-slate-700" aria-live="polite">
          {shown.length} of {rows.length}
        </p>
      </div>
      <Result r={msg} />
      <div className="overflow-x-auto rounded-xl border border-navy/10">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <thead className="bg-paper/60">
            <tr className="text-xs uppercase tracking-[0.1em] text-slate-700">
              <th scope="col" className="px-4 py-3 font-semibold">Name</th>
              {[1, 2, 3].map((s) => (
                <th key={s} scope="col" className="px-4 py-3 font-semibold">
                  Session {s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-navy/10">
            {shown.map((r) => (
              <tr key={r.id} className="align-top">
                <th scope="row" className="px-4 py-3 font-normal">
                  <span className="block font-semibold text-ink">{r.name}</span>
                  <span className="block text-xs text-slate-700">
                    {[r.institution, r.committee ? "Committee" : null, r.ranked ? null : "Didn't rank"].filter(Boolean).join(" · ")}
                  </span>
                </th>
                {r.slots.map((s) => {
                  const w = s.workshopId ? byId.get(s.workshopId) : undefined;
                  const elsewhere = new Map(r.slots.filter((x) => x.slot !== s.slot && x.workshopId).map((x) => [x.workshopId!, x.slot]));
                  return (
                    <td key={s.slot} className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span aria-hidden className={cn("size-3 shrink-0 rounded-full", !w && "border-2 border-danger/60")} style={w ? { background: workshopColour(w.number).solid } : undefined} />
                        <select
                          aria-label={`${r.name}, session ${s.slot}`}
                          value={s.workshopId ?? ""}
                          disabled={pending}
                          onChange={(e) => change(r, s.slot, e.target.value || null)}
                          className={cn(inputClass.replace("w-full", "w-full max-w-[15rem]"), "min-h-10 px-2.5 py-1.5 text-sm", !w && "border-danger/50", busy === `${r.id}:${s.slot}` && "opacity-60")}
                        >
                          <option value="">Not placed</option>
                          {workshops.map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.number}. {x.title}
                              {elsewhere.has(x.id) ? ` (swap with session ${elsewhere.get(x.id)})` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                      <span className="mt-1 block pl-5 text-xs text-slate-700">
                        {s.choice ? `Their ${ordinal(s.choice)} choice` : w && r.ranked ? "" : w ? "Didn't rank" : ""}
                        {s.manual ? `${s.choice || (w && !r.ranked) ? " · " : ""}Moved by hand` : ""}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
