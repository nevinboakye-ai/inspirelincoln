/**
 * Workshop allocation.
 *
 * The six workshops run in three sessions, two at a time (1A and 1B, 2A and
 * 2B, 3A and 3B), so everyone goes to one workshop in each session. Each
 * delegate ranks all six. In every session they go to whichever of the two
 * they ranked higher, unless that room is full.
 *
 * When a room is over capacity, someone has to move to the other workshop
 * in that session. We move the people who mind least: those who ranked the
 * two workshops closest together (for example 3rd and 4th, rather than 1st
 * and 6th). That gives the lowest possible total of ranks across everyone,
 * so as many people as possible get the workshops they ranked highest.
 *
 * Among people who mind equally, we protect anyone who has already been
 * moved in another session, so nobody is moved twice while others aren't
 * moved at all. Any remaining tie is broken by a fixed shuffle (the seed),
 * so no one is favoured for their name, sign-up date or when they ranked.
 *
 * People who haven't ranked can be added at the end, to whichever room in
 * each session has more space.
 */

export type AllocWorkshop = { id: string; slot: number; stream: "a" | "b"; capacity: number | null };
export type AllocPerson = { id: string; ranking: string[] | null };
export type Placement = { workshopId: string; choice: number | null };
export type AllocResult = {
  /** person id -> slot -> placement */
  placements: Map<string, Map<number, Placement>>;
  /** People who couldn't be placed in a session because both rooms were full. */
  unplaced: { personId: string; slot: number }[];
  /** People moved from the workshop they preferred in a session, by slot. */
  moved: { personId: string; slot: number }[];
  summary: AllocSummary;
};
export type AllocSummary = {
  people: number;
  ranked: number;
  /** Rankers who got the workshop they preferred in every session. */
  allPreferred: number;
  /** Rankers who got their first choice. */
  gotFirst: number;
  /** Rankers moved from their preferred workshop in one session, or in two or more. */
  movedOnce: number;
  movedTwiceOrMore: number;
  /** placements by choice number: index 0 = 1st choice ... 5 = 6th choice. */
  byChoice: number[];
  unplaced: number;
  workshops: { id: string; placed: number; capacity: number | null; wanted: number }[];
  seed: string;
};

/** A small, stable hash (FNV-1a), so the shuffle is the same every time for the same seed. */
export function hash(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Checks a ranking lists every workshop exactly once. */
export function isCompleteRanking(ranking: readonly string[], workshopIds: readonly string[]) {
  return ranking.length === workshopIds.length && new Set(ranking).size === ranking.length && ranking.every((id) => workshopIds.includes(id));
}

/** Which slots are ready to allocate: exactly one A and one B, or a single workshop. Returns problems to show the committee. */
export function pairingProblems(workshops: readonly AllocWorkshop[], slots = [1, 2, 3]) {
  const problems: string[] = [];
  for (const s of slots) {
    const here = workshops.filter((w) => w.slot === s);
    if (here.length === 0) problems.push(`Session ${s} has no workshops yet.`);
    else if (here.length > 2) problems.push(`Session ${s} has ${here.length} workshops. Each session runs two at a time.`);
    else if (here.length === 2 && here[0]!.stream === here[1]!.stream) problems.push(`Session ${s} has two workshops marked ${here[0]!.stream.toUpperCase()}. Mark one A and one B.`);
  }
  return problems;
}

export function allocate(workshops: readonly AllocWorkshop[], people: readonly AllocPerson[], opts: { seed: string; includeUnranked: boolean }): AllocResult {
  const slots = [...new Set(workshops.map((w) => w.slot))].sort((a, b) => a - b);
  const placements = new Map<string, Map<number, Placement>>();
  const unplaced: AllocResult["unplaced"] = [];
  const moved: AllocResult["moved"] = [];
  const timesMoved = new Map<string, number>();
  const tie = (id: string) => hash(`${opts.seed}:${id}`);
  const rankers = people.filter((p) => p.ranking && p.ranking.length);
  const rankOf = new Map(rankers.map((p) => [p.id, new Map(p.ranking!.map((w, i) => [w, i + 1]))]));
  const place = (pid: string, slot: number, workshopId: string) => {
    if (!placements.has(pid)) placements.set(pid, new Map());
    placements.get(pid)!.set(slot, { workshopId, choice: rankOf.get(pid)?.get(workshopId) ?? null });
  };

  // How over-subscribed each session is, so the most contested are settled
  // first and later sessions can protect the people moved there.
  const pressure = (slot: number) => {
    const here = workshops.filter((w) => w.slot === slot);
    return Math.max(
      0,
      ...here.map((w) => {
        if (w.capacity == null) return 0;
        const want = rankers.filter((p) => preferredIn(p.id, here) === w.id).length;
        return (want - w.capacity) / w.capacity;
      }),
    );
  };
  const preferredIn = (pid: string, here: readonly AllocWorkshop[]) => {
    const r = rankOf.get(pid)!;
    return [...here].sort((a, b) => (r.get(a.id) ?? 99) - (r.get(b.id) ?? 99))[0]!.id;
  };

  for (const slot of [...slots].sort((a, b) => pressure(b) - pressure(a) || a - b)) {
    const here = workshops.filter((w) => w.slot === slot).sort((a, b) => a.stream.localeCompare(b.stream));
    const room = new Map(here.map((w) => [w.id, [] as string[]]));
    for (const p of rankers) room.get(preferredIn(p.id, here))!.push(p.id);

    // The cost to someone of moving from their preferred workshop to the other one.
    const gap = (pid: string, from: string) => {
      const r = rankOf.get(pid)!;
      const other = here.find((w) => w.id !== from);
      return other ? (r.get(other.id) ?? 99) - (r.get(from) ?? 99) : Infinity;
    };
    const order = (from: string) => (a: string, b: string) =>
      gap(a, from) - gap(b, from) || (timesMoved.get(a) ?? 0) - (timesMoved.get(b) ?? 0) || tie(a) - tie(b) || a.localeCompare(b);

    for (const w of here) {
      const cap = w.capacity ?? Infinity;
      const list = room.get(w.id)!;
      if (list.length <= cap) continue;
      const other = here.find((x) => x.id !== w.id);
      list.sort(order(w.id));
      const excess = list.length - cap;
      const movers = list.splice(0, excess);
      for (const pid of movers) {
        const otherList = other ? room.get(other.id)! : null;
        if (other && otherList!.length < (other.capacity ?? Infinity)) {
          otherList!.push(pid);
          moved.push({ personId: pid, slot });
          timesMoved.set(pid, (timesMoved.get(pid) ?? 0) + 1);
        } else unplaced.push({ personId: pid, slot });
      }
    }

    if (opts.includeUnranked) {
      for (const p of [...people.filter((x) => !rankOf.has(x.id))].sort((a, b) => tie(a.id) - tie(b.id) || a.id.localeCompare(b.id))) {
        const open = here
          .map((w) => ({ w, free: (w.capacity ?? Infinity) - room.get(w.id)!.length, n: room.get(w.id)!.length }))
          .filter((x) => x.free > 0)
          .sort((a, b) => (a.free === b.free ? a.n - b.n : b.free - a.free) || a.w.stream.localeCompare(b.w.stream));
        if (open[0]) room.get(open[0].w.id)!.push(p.id);
        else unplaced.push({ personId: p.id, slot });
      }
    }

    for (const [wid, list] of room) for (const pid of list) place(pid, slot, wid);
  }

  const byChoice = [0, 0, 0, 0, 0, 0];
  let allPreferred = 0;
  let gotFirst = 0;
  let movedOnce = 0;
  let movedTwiceOrMore = 0;
  for (const p of rankers) {
    const mine = placements.get(p.id);
    for (const pl of mine?.values() ?? []) if (pl.choice) byChoice[Math.min(pl.choice, 6) - 1]! += 1;
    const m = timesMoved.get(p.id) ?? 0;
    const lost = unplaced.filter((u) => u.personId === p.id).length;
    if (m === 0 && lost === 0) allPreferred++;
    if (m === 1) movedOnce++;
    if (m >= 2) movedTwiceOrMore++;
    if ([...(mine?.values() ?? [])].some((pl) => pl.choice === 1)) gotFirst++;
  }

  return {
    placements,
    unplaced,
    moved,
    summary: {
      people: placements.size,
      ranked: rankers.length,
      allPreferred,
      gotFirst,
      movedOnce,
      movedTwiceOrMore,
      byChoice,
      unplaced: unplaced.length,
      workshops: workshops.map((w) => ({
        id: w.id,
        capacity: w.capacity,
        placed: [...placements.values()].filter((m) => m.get(w.slot)?.workshopId === w.id).length,
        wanted: rankers.filter((p) => preferredIn(p.id, workshops.filter((x) => x.slot === w.slot)) === w.id).length,
      })),
      seed: opts.seed,
    },
  };
}
