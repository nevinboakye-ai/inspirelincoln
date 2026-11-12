import type { Metadata } from "next";
import Link from "next/link";
import { Download, Eye } from "lucide-react";
import { requireAccess } from "@/lib/auth";
import { AdminHeader, Panel, btn } from "@/components/admin/ui";
import { ChoiceSettingsForm, PlacesTable, RunAllocationForm, WorkshopRoomsForm, type PlaceRow } from "@/components/admin/workshop-board";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/notice";
import { cn } from "@/lib/cn";
import { toZonedInputValue } from "@/lib/time";
import { SESSIONS } from "@/lib/workshops/allocate";
import { loadAllocationBoard } from "@/lib/workshops/admin";
import { rankingIsOpen } from "@/lib/workshops/choices";
import { workshopColour } from "@/lib/workshops/colours";

export const metadata: Metadata = { title: "Workshop places" };
export const dynamic = "force-dynamic";

const when = (d: string) =>
  new Date(d).toLocaleString("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);
const ordinal = (n: number) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;
const SLOTS = Array.from({ length: SESSIONS }, (_, i) => i + 1);

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border border-navy/10 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-700">{label}</p>
      <p className="mt-1 font-display text-3xl text-ink">{value}</p>
      {note && <p className="mt-1 text-xs text-slate-700">{note}</p>}
    </div>
  );
}

/** A thin horizontal bar against a track, with the numbers written beside it. */
function Meter({ value, max, over = false, label }: { value: number; max: number; over?: boolean; label: string }) {
  const w = max ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div>
      <div aria-hidden className="h-2 overflow-hidden rounded-full bg-paper-200">
        <div className={cn("h-full rounded-full", over ? "bg-warning" : "bg-navy")} style={{ width: `${w}%` }} />
      </div>
      <p className="mt-1 text-xs text-slate-700">{label}</p>
    </div>
  );
}

export default async function WorkshopPlacesPage() {
  const { db, user } = await requireAccess("allocate_workshops", "/admin/workshops");
  const b = await loadAllocationBoard(db, user.id);

  if (!b.settings.ready || b.peopleError) {
    return (
      <div>
        <AdminHeader title="Workshop places" />
        <Notice tone="warning">Workshop places aren&apos;t set up yet. Run setup SQL 29 and 35 in Supabase first.</Notice>
      </div>
    );
  }

  const open = rankingIsOpen(b.settings);
  const confirmed = b.people.filter((p) => !p.committee);
  const ranked = b.people.filter((p) => p.ranking);
  const rankedDelegates = confirmed.filter((p) => p.ranking).length;
  const notRanked = confirmed.filter((p) => !p.ranking);
  const ready = b.workshops.length >= SESSIONS;
  const hasPlaces = b.allPlaces.length > 0;
  const sessionLabel = (slot: number) => {
    const t = b.sessions.find((x) => x.slot === slot)?.time;
    return `Session ${slot}${t ? `, ${t}` : ""}`;
  };

  // What people want: how many have each workshop in their top three, and how many put it first.
  const demand = b.workshops.map((w) => ({
    w,
    top: ranked.filter((p) => p.ranking!.indexOf(w.id) < SESSIONS).length,
    first: ranked.filter((p) => p.ranking![0] === w.id).length,
    fits: w.capacity != null ? w.capacity * SESSIONS : null,
  }));

  // Everyone with a place, plus confirmed delegates and anyone who ranked but has none, so they can be placed by hand.
  const placedIds = new Set(b.allPlaces.map((p) => p.userId));
  const rowIds = [...placedIds, ...b.people.filter((p) => !placedIds.has(p.id) && (!p.committee || p.ranking)).map((p) => p.id)];
  const placeRows: PlaceRow[] = rowIds
    .map((id) => {
      const person = b.people.find((p) => p.id === id);
      return {
        id,
        name: person?.name ?? "Former account",
        institution: person?.institution ?? null,
        ranked: Boolean(person?.ranking),
        committee: Boolean(person?.committee),
        slots: SLOTS.map((slot) => {
          const p = b.allPlaces.find((x) => x.userId === id && x.slot === slot);
          return { slot, workshopId: p?.workshopId ?? null, choice: p?.choice ?? null, manual: Boolean(p?.manual) };
        }),
      };
    })
    .sort((a, b2) => a.name.localeCompare(b2.name));

  // How the current places (including moves by hand) match what people ranked.
  const rankerIds = new Set(ranked.map((p) => p.id));
  const rankerPlaces = b.allPlaces.filter((p) => rankerIds.has(p.userId));
  const inTop = rankerPlaces.filter((p) => p.choice != null && p.choice <= SESSIONS).length;
  const rankedPlaced = [...new Set(rankerPlaces.map((p) => p.userId))];
  const allTop = rankedPlaced.filter((id) => rankerPlaces.filter((p) => p.userId === id && p.choice != null && p.choice <= SESSIONS).length === SESSIONS).length;
  const byChoice = b.workshops.map((_, i) => rankerPlaces.filter((p) => p.choice === i + 1).length);
  const maxChoice = Math.max(1, ...byChoice);
  const gaps = placeRows.filter((r) => placedIds.has(r.id)).reduce((n, r) => n + r.slots.filter((x) => !x.workshopId).length, 0);
  const count = (wid: string, slot: number) => b.allPlaces.filter((p) => p.workshopId === wid && p.slot === slot).length;

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Workshop places"
        description="All six workshops run in each of the three sessions, so every delegate goes to three of the six. Delegates rank all six in My Hub, and the allocation gives each person as many of their top three as the rooms allow, then spreads them across the sessions. You can change anyone's places by hand afterwards."
        actions={
          <>
            <Link href="/portal#workshops" className={btn.secondary}>
              <Eye aria-hidden className="size-4" /> {open ? "See it on My Hub" : "Preview what delegates see"}
            </Link>
            {hasPlaces && (
              <a href="/admin/workshops/export" className={btn.secondary}>
                <Download aria-hidden className="size-4" /> Download places (CSV)
              </a>
            )}
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Ranking" value={open ? "Open" : "Closed"} note={open && b.settings.closesAt ? `Closes ${when(b.settings.closesAt)}` : undefined} />
        <Stat label="Delegates who've ranked" value={`${rankedDelegates} of ${confirmed.length}`} note={`${pct(rankedDelegates, confirmed.length)}%`} />
        <Stat label="People placed" value={hasPlaces ? `${placedIds.size}` : "Not run yet"} note={b.lastRun ? `Last run ${when(b.lastRun.at)}${b.lastRun.by ? ` by ${b.lastRun.by}` : ""}` : undefined} />
        <Stat label="Shown to delegates" value={b.settings.resultsPublished ? "Yes" : "No"} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Panel title="Workshop ranking">
          <ChoiceSettingsForm open={b.settings.rankingOpen} closesAt={toZonedInputValue(b.settings.closesAt)} published={b.settings.resultsPublished} hasPlaces={hasPlaces} />
        </Panel>
        <Panel title="Rooms and room sizes">
          <p className="mb-4 text-sm text-slate-700">
            Each workshop keeps its room all day. The room size is how many people it holds in one session. To rename a workshop or change its description, open its info card in My Hub, or go to{" "}
            <Link href="/admin/content/workshops" className="font-semibold text-electric-600 underline underline-offset-4">
              Website, Workshops
            </Link>
            .
          </p>
          <WorkshopRoomsForm workshops={b.workshops.map((w) => ({ id: w.id, number: w.number, title: w.title, room: w.room, capacity: w.capacity }))} />
        </Panel>
      </div>

      <Panel title="What delegates want">
        {ranked.length === 0 ? (
          <p className="text-sm text-slate-700">Nobody has ranked yet. Results appear here as people save their rankings.</p>
        ) : (
          <>
            <p className="mb-4 text-sm text-slate-700">
              How many people have each workshop in their top three, against how many it can take over the day (its room size, three times over).
            </p>
            <ul className="grid gap-x-8 gap-y-5 md:grid-cols-2">
              {demand.map((d) => {
                const over = d.fits != null && d.top > d.fits;
                return (
                  <li key={d.w.id}>
                    <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                      <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ background: workshopColour(d.w.number).solid }} />
                      {d.w.title}
                    </p>
                    <div className="mt-2">
                      <Meter
                        value={d.top}
                        max={d.fits ?? Math.max(1, ranked.length)}
                        over={over}
                        label={`${d.top} in their top three, ${d.first} ranked it 1st. ${d.fits != null ? `Takes ${d.fits} over the day.` : "No room size set."}${over ? " Some will get a lower choice." : ""}`}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Panel>

      <Panel title="Allocation">
        {!ready && (
          <div className="mb-4">
            <Notice tone="warning" title="Not enough workshops">
              Publish at least {SESSIONS} workshops before running the allocation.
            </Notice>
          </div>
        )}
        <p className="mb-4 max-w-3xl text-sm text-slate-700">
          Everyone gets three different workshops, one in each session. The allocation aims for each person&apos;s top three. Where a workshop is too popular for its room, the people who ranked it lowest get their next choice instead, and nobody is given a second lower choice while others still have all of their top three. Any remaining ties are settled by a fair shuffle. Then it spreads each workshop&apos;s people evenly across the three sessions, so no room is ever over its size.
        </p>
        <RunAllocationForm unranked={notRanked.length} hasPlaces={hasPlaces} ready={ready} />

        {hasPlaces && (
          <div className="mt-6 space-y-5 border-t border-navy/10 pt-6">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Stat label="Got all of their top three" value={`${pct(allTop, rankedPlaced.length)}%`} note={`${allTop} of ${rankedPlaced.length} who ranked`} />
              <Stat label="Places from people's top three" value={`${pct(inTop, rankerPlaces.length)}%`} note={`${inTop} of ${rankerPlaces.length} places`} />
              <Stat label="Outside their top three" value={`${rankerPlaces.length - inTop}`} note="Because a room was full, or moved by hand" />
              <Stat label="Empty sessions" value={`${gaps}`} note={gaps ? "People placed in fewer than three sessions. Raise a room size and run again, or place them below." : "Everyone placed has all three"} />
            </div>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
              <section aria-labelledby="by-choice" className="rounded-xl border border-navy/10 p-4">
                <h3 id="by-choice" className="text-sm font-semibold text-ink">Places by where people ranked them</h3>
                <ul className="mt-3 space-y-2.5">
                  {byChoice.map((n, i) => (
                    <li key={i} className="grid grid-cols-[4.5rem_1fr_3rem] items-center gap-3 text-sm">
                      <span className="text-slate-700">{ordinal(i + 1)} choice</span>
                      <span aria-hidden className="h-2 overflow-hidden rounded-full bg-paper-200">
                        <span className={cn("block h-full rounded-full", i < SESSIONS ? "bg-navy" : "bg-slate")} style={{ width: `${(n / maxChoice) * 100}%` }} />
                      </span>
                      <span className="text-right font-semibold tabular-nums text-ink">{n}</span>
                    </li>
                  ))}
                </ul>
              </section>
              <section aria-labelledby="by-room" className="rounded-xl border border-navy/10 p-4">
                <h3 id="by-room" className="text-sm font-semibold text-ink">Each room, each session</h3>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[26rem] text-left text-sm">
                    <thead>
                      <tr className="text-xs uppercase tracking-[0.1em] text-slate-700">
                        <th scope="col" className="py-1.5 pr-3 font-semibold">Workshop</th>
                        {SLOTS.map((slot) => (
                          <th key={slot} scope="col" className="px-2 py-1.5 text-right font-semibold">
                            <abbr title={sessionLabel(slot)} className="no-underline">S{slot}</abbr>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-navy/10">
                      {b.workshops.map((w) => (
                        <tr key={w.id}>
                          <th scope="row" className="py-2 pr-3 font-normal">
                            <span className="flex items-center gap-2">
                              <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: workshopColour(w.number).solid }} />
                              <span className="min-w-0">
                                <span className="block text-ink">{w.title}</span>
                                {w.room && <span className="block text-xs text-slate-700">{w.room}</span>}
                              </span>
                            </span>
                          </th>
                          {SLOTS.map((slot) => {
                            const n = count(w.id, slot);
                            const over = w.capacity != null && n > w.capacity;
                            return (
                              <td key={slot} className={cn("px-2 py-2 text-right tabular-nums", over ? "font-semibold text-danger" : "text-ink")}>
                                {n}
                                {w.capacity != null && <span className="text-slate-700">/{w.capacity}</span>}
                                {over && <span className="sr-only"> (over the room size)</span>}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </div>
        )}
      </Panel>

      {hasPlaces && (
        <Panel title="Everyone's places">
          <p className="mb-4 text-sm text-slate-700">
            Change anyone&apos;s workshop in any session with the menus. Choosing a workshop they already do in another session swaps the two sessions. Changes are saved straight away and marked &ldquo;Moved by hand&rdquo;. Running the allocation again replaces them.
          </p>
          <PlacesTable rows={placeRows} workshops={b.workshops.map((w) => ({ id: w.id, number: w.number, title: w.title }))} />
        </Panel>
      )}

      {notRanked.length > 0 && (
        <Panel title={`Delegates who haven't ranked (${notRanked.length})`}>
          <ul className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {notRanked.map((p) => (
              <li key={p.id} className="min-w-0 truncate">
                <span className="text-ink">{p.name}</span>
                {p.institution && <span className="text-slate-700"> · {p.institution}</span>}
              </li>
            ))}
          </ul>
          {open && <p className="mt-4 text-sm text-slate-700">They see &ldquo;Rank your workshops&rdquo; at the top of My Hub. You could remind them with a group email.</p>}
        </Panel>
      )}
      {b.people.some((p) => p.committee && p.ranking) && (
        <p className="text-sm text-slate-700">
          <Badge tone="neutral">Note</Badge> Committee members who ranked are included in the allocation.
        </p>
      )}
    </div>
  );
}
