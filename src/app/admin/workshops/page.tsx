import type { Metadata } from "next";
import Link from "next/link";
import { Download, Eye } from "lucide-react";
import { requireAccess } from "@/lib/auth";
import { AdminHeader, Panel, btn } from "@/components/admin/ui";
import { ChoiceSettingsForm, PlacesTable, RunAllocationForm, WorkshopSessionsForm, type PlaceRow } from "@/components/admin/workshop-board";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/notice";
import { cn } from "@/lib/cn";
import { toZonedInputValue } from "@/lib/time";
import { pairingProblems } from "@/lib/workshops/allocate";
import { loadAllocationBoard } from "@/lib/workshops/admin";
import { pairLabel, rankingIsOpen } from "@/lib/workshops/choices";

export const metadata: Metadata = { title: "Workshop places" };
export const dynamic = "force-dynamic";

const when = (d: string) =>
  new Date(d).toLocaleString("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

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
        <Notice tone="warning">Workshop places aren&apos;t set up yet. Run setup SQL 29 in Supabase first.</Notice>
      </div>
    );
  }

  const open = rankingIsOpen(b.settings);
  const confirmed = b.people.filter((p) => !p.committee);
  const ranked = b.people.filter((p) => p.ranking);
  const rankedDelegates = confirmed.filter((p) => p.ranking).length;
  const notRanked = confirmed.filter((p) => !p.ranking);
  const placed = b.workshops.filter((w) => w.slot && w.stream);
  const problems = pairingProblems(placed.map((w) => ({ id: w.id, slot: w.slot!, stream: w.stream!, capacity: w.capacity })));
  const ready = placed.length === b.workshops.length && !problems.length;
  const hasPlaces = b.allPlaces.length > 0;
  const time = (slot: number | null) => b.sessions.find((s) => s.slot === slot)?.time ?? null;

  // What people want: how many picked each workshop over the other one in its session.
  const demand = b.workshops.map((w) => {
    const partner = b.workshops.find((x) => x.slot && x.slot === w.slot && x.id !== w.id);
    const prefer = partner ? ranked.filter((p) => p.ranking!.indexOf(w.id) < p.ranking!.indexOf(partner.id)).length : ranked.length;
    return {
      w,
      prefer,
      placed: b.allPlaces.filter((p) => p.workshopId === w.id).length,
    };
  });

  const placeRows: PlaceRow[] = [...new Set(b.allPlaces.map((p) => p.userId))]
    .map((id) => {
      const person = b.people.find((p) => p.id === id);
      return {
        id,
        name: person?.name ?? "Former account",
        institution: person?.institution ?? null,
        ranked: Boolean(person?.ranking),
        committee: Boolean(person?.committee),
        slots: [1, 2, 3].map((slot) => {
          const p = b.allPlaces.find((x) => x.userId === id && x.slot === slot);
          return { slot, workshopId: p?.workshopId ?? null, choice: p?.choice ?? null, manual: Boolean(p?.manual) };
        }),
      };
    })
    .sort((a, b2) => a.name.localeCompare(b2.name));

  const s = b.lastRun?.summary;
  // Whether a place is the workshop that person picked in that session.
  const pickFor = (userId: string, slot: number) => {
    const person = b.people.find((p) => p.id === userId);
    if (!person?.ranking) return null;
    const pair = b.workshops.filter((w) => w.slot === slot);
    return [...pair].sort((x, y) => person.ranking!.indexOf(x.id) - person.ranking!.indexOf(y.id))[0]?.id ?? null;
  };
  const chosenPlaces = b.allPlaces.filter((p) => pickFor(p.userId, p.slot));
  const honoured = chosenPlaces.filter((p) => pickFor(p.userId, p.slot) === p.workshopId).length;
  const rankedPlaced = new Set(chosenPlaces.map((p) => p.userId));
  const preferredEverywhere = [...rankedPlaced].filter((id) => [1, 2, 3].every((slot) => b.allPlaces.some((p) => p.userId === id && p.slot === slot && p.workshopId === pickFor(id, slot)))).length;
  const bySession = [1, 2, 3].map((slot) => {
    const here = chosenPlaces.filter((p) => p.slot === slot);
    return { slot, total: here.length, honoured: here.filter((p) => pickFor(p.userId, p.slot) === p.workshopId).length };
  });
  const unplaced = ((s as unknown as { unplacedPeople?: { personId: string; slot: number }[] })?.unplacedPeople ?? []).filter(
    (u) => !b.allPlaces.some((p) => p.userId === u.personId && p.slot === u.slot),
  );

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Workshop places"
        description="In My Hub, delegates pick A or B in each of the three workshop sessions. The allocation then gives everyone one workshop per session, honouring as many picks as the room sizes allow."
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
        <Stat label="Choices" value={open ? "Open" : "Closed"} note={open && b.settings.closesAt ? `Closes ${when(b.settings.closesAt)}` : undefined} />
        <Stat label="Delegates who've chosen" value={`${rankedDelegates} of ${confirmed.length}`} note={`${pct(rankedDelegates, confirmed.length)}%`} />
        <Stat label="Places" value={hasPlaces ? `${new Set(b.allPlaces.map((p) => p.userId)).size}` : "Not run yet"} note={b.lastRun ? `Last run ${when(b.lastRun.at)}${b.lastRun.by ? ` by ${b.lastRun.by}` : ""}` : undefined} />
        <Stat label="Shown to delegates" value={b.settings.resultsPublished ? "Yes" : "No"} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Panel title="Workshop choices">
          <ChoiceSettingsForm open={b.settings.rankingOpen} closesAt={toZonedInputValue(b.settings.closesAt)} published={b.settings.resultsPublished} hasPlaces={hasPlaces} />
        </Panel>
        <Panel title="Sessions and room sizes">
          <p className="mb-4 text-sm text-slate-700">
            Two workshops run at the same time in each session. Set which pair up, and how many people each room holds. To rename a workshop or change its description, go to{" "}
            <Link href="/admin/content/workshops" className="font-semibold text-electric-600 underline underline-offset-4">
              Website, Workshops
            </Link>
            .
          </p>
          <WorkshopSessionsForm
            workshops={b.workshops.map((w) => ({ id: w.id, title: w.title, slot: w.slot, stream: w.stream, capacity: w.capacity }))}
            sessions={b.sessions.map((x) => ({ slot: x.slot, time: x.time }))}
          />
        </Panel>
      </div>

      <Panel title="What delegates want">
        {ranked.length === 0 ? (
          <p className="text-sm text-slate-700">Nobody has chosen yet. Results appear here as people save their choices.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((slot) => {
              const pair = demand.filter((d) => d.w.slot === slot).sort((x, y) => (x.w.stream ?? "").localeCompare(y.w.stream ?? ""));
              return (
                <section key={slot} aria-labelledby={`demand-${slot}`} className="rounded-xl border border-navy/10 p-4">
                  <h3 id={`demand-${slot}`} className="text-sm font-semibold text-ink">
                    Session {slot}
                    {time(slot) ? <span className="font-normal text-slate-700"> · {time(slot)}</span> : null}
                  </h3>
                  {pair.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-700">No workshops set for this session.</p>
                  ) : (
                    <ul className="mt-3 space-y-4">
                      {pair.map((d) => {
                        const cap = d.w.capacity;
                        const over = cap != null && d.prefer > cap;
                        return (
                          <li key={d.w.id}>
                            <p className="flex items-baseline justify-between gap-2 text-sm">
                              <span className="font-semibold text-ink">
                                {pairLabel(d.w)}: {d.w.title}
                              </span>
                            </p>
                            <div className="mt-2">
                              <Meter
                                value={d.prefer}
                                max={cap ?? Math.max(1, ranked.length)}
                                over={over}
                                label={`${d.prefer} picked it${cap ? `, room holds ${cap}` : ", no room size set"}${over ? ". Some will need to move." : ""}`}
                              />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </Panel>

      <Panel title="Allocation">
        {!ready && (
          <div className="mb-4">
            <Notice tone="warning" title="Sessions aren't ready">
              {problems[0] ?? "Put every workshop in a session, as A or B, before running the allocation."}
            </Notice>
          </div>
        )}
        <p className="mb-4 max-w-3xl text-sm text-slate-700">
          In each session, everyone goes to the workshop they picked. If a room is full, some people move to the other workshop in that session. People already moved in another session are protected, so nobody is moved twice while others aren&apos;t moved at all, and any remaining ties are settled by a fair shuffle. This honours as many picks as the room sizes allow.
        </p>
        <RunAllocationForm unranked={notRanked.length} hasPlaces={hasPlaces} ready={ready} />

        {hasPlaces && (
          <div className="mt-6 space-y-5 border-t border-navy/10 pt-6">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Stat label="Got their pick in every session" value={`${pct(preferredEverywhere, rankedPlaced.size)}%`} note={`${preferredEverywhere} of ${rankedPlaced.size} who chose`} />
              <Stat label="Picks honoured" value={`${pct(honoured, chosenPlaces.length)}%`} note={`${honoured} of ${chosenPlaces.length} places`} />
              <Stat label="Moved to the other workshop" value={`${chosenPlaces.length - honoured}`} note="Because their pick was full, or moved by hand" />
              <Stat label="Couldn't be placed" value={`${unplaced.length}`} note={unplaced.length ? "Both rooms were full. Raise a room size and run again." : "Everyone has a place"} />
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <section aria-labelledby="by-session" className="rounded-xl border border-navy/10 p-4">
                <h3 id="by-session" className="text-sm font-semibold text-ink">Picks honoured in each session</h3>
                <ul className="mt-3 space-y-2.5">
                  {bySession.map((x) => (
                    <li key={x.slot} className="grid grid-cols-[5.5rem_1fr_5rem] items-center gap-3 text-sm">
                      <span className="text-slate-700">Session {x.slot}</span>
                      <span aria-hidden className="h-2 overflow-hidden rounded-full bg-paper-200">
                        <span className="block h-full rounded-full bg-navy" style={{ width: `${x.total ? (x.honoured / x.total) * 100 : 0}%` }} />
                      </span>
                      <span className="text-right font-semibold tabular-nums text-ink">
                        {x.honoured} of {x.total}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
              <section aria-labelledby="by-room" className="rounded-xl border border-navy/10 p-4">
                <h3 id="by-room" className="text-sm font-semibold text-ink">Each workshop</h3>
                <ul className="mt-3 space-y-3">
                  {demand
                    .filter((d) => d.w.slot)
                    .sort((x, y) => (pairLabel(x.w) ?? "").localeCompare(pairLabel(y.w) ?? ""))
                    .map((d) => (
                      <li key={d.w.id}>
                        <p className="text-sm font-semibold text-ink">
                          {pairLabel(d.w)}: {d.w.title}
                        </p>
                        <Meter
                          value={d.placed}
                          max={d.w.capacity ?? Math.max(1, d.placed)}
                          over={d.w.capacity != null && d.placed > d.w.capacity}
                          label={`${d.placed} placed${d.w.capacity ? ` of ${d.w.capacity}` : ""}${d.w.capacity != null && d.placed > d.w.capacity ? `, ${d.placed - d.w.capacity} over the room size because of moves by hand` : ""}`}
                        />
                      </li>
                    ))}
                </ul>
              </section>
            </div>
          </div>
        )}
      </Panel>

      {hasPlaces && (
        <Panel title="Everyone's places">
          <p className="mb-4 text-sm text-slate-700">To move someone, press the other workshop in that session. Moves are saved straight away and marked &ldquo;Moved by hand&rdquo;.</p>
          <PlacesTable
            rows={placeRows}
            workshops={b.workshops.filter((w) => w.slot && w.stream).map((w) => ({ id: w.id, title: w.title, slot: w.slot!, pair: pairLabel(w)! }))}
          />
        </Panel>
      )}

      {notRanked.length > 0 && (
        <Panel title={`Delegates who haven't chosen (${notRanked.length})`}>
          <ul className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {notRanked.map((p) => (
              <li key={p.id} className="min-w-0 truncate">
                <span className="text-ink">{p.name}</span>
                {p.institution && <span className="text-slate-700"> · {p.institution}</span>}
              </li>
            ))}
          </ul>
          {open && <p className="mt-4 text-sm text-slate-700">They see &ldquo;Choose your workshops&rdquo; at the top of My Hub. You could remind them with a group email.</p>}
        </Panel>
      )}
      {b.people.some((p) => p.committee && p.ranking) && (
        <p className="text-sm text-slate-700">
          <Badge tone="neutral">Note</Badge> Committee members who chose are included in the allocation.
        </p>
      )}
    </div>
  );
}
