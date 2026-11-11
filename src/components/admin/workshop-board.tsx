"use client";
import { useActionState, useMemo, useState, useTransition } from "react";
import { Loader2, Play, Search } from "lucide-react";
import { moveAllocation, runAllocation, saveChoiceSettings, saveWorkshopSessions, type BoardResult } from "@/app/admin/workshops/actions";
import { btn } from "@/components/admin/ui";
import { inputClass } from "@/components/forms/field";
import { cn } from "@/lib/cn";
import { pairingProblems } from "@/lib/workshops/allocate";

function Result({ r }: { r: BoardResult }) {
  if (!r) return null;
  return (
    <p role={r.ok ? "status" : "alert"} className={cn("text-sm font-medium", r.ok ? "text-success" : "text-danger")}>
      {r.ok ? r.message : r.error}
    </p>
  );
}

const ordinal = (n: number) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;

/** Open or close ranking, set when it closes, and publish places. */
export function ChoiceSettingsForm({ open, closesAt, published, hasPlaces }: { open: boolean; closesAt: string; published: boolean; hasPlaces: boolean }) {
  const [r, action, pending] = useActionState(saveChoiceSettings, null);
  return (
    <form action={action} className="space-y-4">
      <label className="flex items-start gap-3">
        <input type="checkbox" name="open" defaultChecked={open} className="mt-1 size-5 accent-navy" />
        <span>
          <span className="block font-semibold text-ink">Open ranking to delegates</span>
          <span className="block text-sm text-slate-700">Everyone with a confirmed place sees &ldquo;Choose your workshops&rdquo; at the top of My Hub and can change their order until it closes.</span>
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
            {hasPlaces ? "Each delegate sees their three workshops in My Hub, with times and rooms." : "Available once you've run the allocation."}
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

type SessW = { id: string; title: string; slot: number | null; stream: "a" | "b" | null; capacity: number | null };

/** Which session each workshop runs in, A or B, and room sizes. */
export function WorkshopSessionsForm({ workshops, sessions }: { workshops: SessW[]; sessions: { slot: number; time: string | null }[] }) {
  const [r, action, pending] = useActionState(saveWorkshopSessions, null);
  const [rows, setRows] = useState(workshops);
  const set = (id: string, patch: Partial<SessW>) => setRows((rs) => rs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const problems = pairingProblems(rows.filter((w) => w.slot && w.stream).map((w) => ({ id: w.id, slot: w.slot!, stream: w.stream!, capacity: w.capacity })));
  const unset = rows.filter((w) => !w.slot || !w.stream).length;
  const label = (s: number) => {
    const start = sessions.find((x) => x.slot === s)?.time?.split(" to ")[0];
    return `Session ${s}${start ? `, ${start}` : ""}`;
  };
  return (
    <form action={action} className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[30rem] text-left text-sm">
          <thead>
            <tr className="border-b border-navy/10 text-xs uppercase tracking-[0.1em] text-slate-700">
              <th scope="col" className="py-2 pr-3 font-semibold">Workshop</th>
              <th scope="col" className="py-2 pr-3 font-semibold">Session</th>
              <th scope="col" className="py-2 pr-3 font-semibold">A or B</th>
              <th scope="col" className="py-2 font-semibold">Room size</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy/10">
            {rows.map((w) => (
              <tr key={w.id}>
                <th scope="row" className="py-3 pr-3 font-semibold text-ink">
                  <input type="hidden" name="id" value={w.id} />
                  {w.title}
                </th>
                <td className="py-3 pr-3">
                  <select name={`slot_${w.id}`} aria-label={`Session for ${w.title}`} value={w.slot ?? ""} onChange={(e) => set(w.id, { slot: Number(e.target.value) || null })} className={cn(inputClass.replace("w-full", "w-auto"), "px-3")}>
                    <option value="">Not set</option>
                    {[1, 2, 3].map((s) => (
                      <option key={s} value={s}>
                        {label(s)}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-3 pr-3">
                  <select name={`stream_${w.id}`} aria-label={`A or B for ${w.title}`} value={w.stream ?? ""} onChange={(e) => set(w.id, { stream: (e.target.value || null) as "a" | "b" | null })} className={cn(inputClass.replace("w-full", "w-auto"), "px-3")}>
                    <option value="">Not set</option>
                    <option value="a">A</option>
                    <option value="b">B</option>
                  </select>
                </td>
                <td className="py-3">
                  <input
                    name={`capacity_${w.id}`}
                    aria-label={`Room size for ${w.title}`}
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
      {(problems.length > 0 || unset > 0) && (
        <ul className="space-y-1 rounded-md border border-warning/30 bg-warning/[0.07] p-3 text-sm text-ink">
          {unset > 0 && <li>{unset === 1 ? "One workshop doesn't" : `${unset} workshops don't`} have a session yet.</li>}
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button className={btn.primary} disabled={pending}>
          {pending && <Loader2 aria-hidden className="size-4 animate-spin" />} Save sessions and room sizes
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
          <span className="block text-sm text-slate-700">They go wherever there&apos;s most room, after everyone who ranked. Committee members are only placed if they ranked.</span>
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button className={btn.primary} disabled={pending || !ready}>
          {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Play aria-hidden className="size-4" />} {hasPlaces ? "Run the allocation again" : "Run the allocation"}
        </button>
        {!ready && <p className="text-sm text-slate-700">Put every workshop in a session first.</p>}
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

/** Everyone's places, with a way to move someone to the other workshop in a session. */
export function PlacesTable({ rows, workshops }: { rows: PlaceRow[]; workshops: { id: string; title: string; slot: number; pair: string }[] }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "moved" | "unranked">("all");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<BoardResult>(null);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (!t || r.name.toLowerCase().includes(t) || (r.institution ?? "").toLowerCase().includes(t)) &&
        (filter === "all" || (filter === "unranked" ? !r.ranked : r.slots.some((s) => s.choice && s.choice > 3) || r.slots.some((s) => s.manual))),
    );
  }, [rows, q, filter]);
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
            <option value="moved">Below their top three, or moved by hand</option>
            <option value="unranked">Didn&apos;t rank</option>
          </select>
        </label>
        <p className="text-sm text-slate-700" aria-live="polite">
          {shown.length} of {rows.length}
        </p>
      </div>
      <Result r={msg} />
      <div className="overflow-x-auto rounded-xl border border-navy/10">
        <table className="w-full min-w-[48rem] text-left text-sm">
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
                  const here = workshops.filter((w) => w.slot === s.slot);
                  return (
                    <td key={s.slot} className="px-4 py-3">
                      <div role="group" aria-label={`${r.name}, session ${s.slot}`} className={cn("inline-flex rounded-md border bg-white p-0.5", s.workshopId ? "border-navy/15" : "border-danger/50")}>
                        {here.map((w) => {
                          const on = w.id === s.workshopId;
                          return (
                            <button
                              key={w.id}
                              type="button"
                              aria-pressed={on}
                              aria-label={`${w.pair}: ${w.title}`}
                              disabled={pending}
                              onClick={() => {
                                if (on) return;
                                start(async () => setMsg(await moveAllocation(r.id, w.id)));
                              }}
                              className={cn(
                                "min-h-9 min-w-12 rounded-[5px] px-3 font-ui text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-electric/30 disabled:cursor-wait",
                                on ? "bg-navy text-paper" : "text-slate-700 hover:bg-paper-200",
                              )}
                            >
                              {w.pair}
                            </button>
                          );
                        })}
                      </div>
                      <span className="mt-1.5 block text-sm leading-snug text-ink">{here.find((w) => w.id === s.workshopId)?.title ?? "Not placed"}</span>
                      <span className="mt-1 block text-xs text-slate-700">
                        {s.choice ? `Their ${ordinal(s.choice)} choice` : r.ranked ? "" : "No ranking"}
                        {s.manual ? `${s.choice || !r.ranked ? " · " : ""}Moved by hand` : ""}
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
