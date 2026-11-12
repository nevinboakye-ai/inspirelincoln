/**
 * Workshop allocation.
 *
 * All six workshops run at the same time, in each of the three workshop
 * sessions, so everyone goes to three of the six: a different one in each
 * session. Each delegate ranks all six, and we aim to give them their top
 * three.
 *
 * It works in two steps.
 *
 * 1. Which three workshops each person gets. Over the day a workshop can
 *    take three times its room size (one room's worth per session). When
 *    more people want a workshop than that, some of them get a workshop
 *    from lower down their list instead. We choose the arrangement with the
 *    lowest total of ranks across everyone, so as many people as possible
 *    get the workshops they ranked highest. Being moved outside your top
 *    three a second or third time counts extra, so nobody misses out twice
 *    while others don't miss out at all. Any remaining tie is settled by a
 *    fixed shuffle (the seed), so no one is favoured for their name, sign-up
 *    date or when they ranked. This is a minimum-cost flow, so the answer is
 *    the best possible, not just a good guess.
 *
 * 2. Which session each person does each workshop in. Once no workshop has
 *    more than three rooms' worth of people, the sessions can always be
 *    arranged so that no room is over its size in any session (a classic
 *    result about colouring the edges of a bipartite graph). We spread each
 *    workshop's people as evenly as possible across the three sessions.
 *
 * People who haven't ranked can be added after everyone who has, to the
 * workshops with most space left.
 */

export type AllocWorkshop = { id: string; capacity: number | null };
export type AllocPerson = { id: string; ranking: string[] | null };
export type Placement = { workshopId: string; choice: number | null };
export type AllocResult = {
  /** person id -> session -> placement */
  placements: Map<string, Map<number, Placement>>;
  /** Sessions someone couldn't be placed in because every workshop was full. */
  unplaced: { personId: string; slot: number }[];
  summary: AllocSummary;
};
export type AllocSummary = {
  people: number;
  ranked: number;
  /** How many workshops each person goes to (the number of sessions). */
  sessions: number;
  /** Rankers who got all of their top three. */
  allTop: number;
  /** Rankers who got their first choice. */
  gotFirst: number;
  /** Rankers given one workshop from outside their top three, or two or more. */
  missedOne: number;
  missedTwoOrMore: number;
  /** Places by choice number: index 0 = 1st choice ... 5 = 6th choice. */
  byChoice: number[];
  unplaced: number;
  workshops: { id: string; placed: number; perSession: number[]; capacity: number | null; wanted: number }[];
  seed: string;
};

export const SESSIONS = 3;

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

/** Minimum-cost flow by successive shortest paths. Small graphs only (a few thousand edges). */
class Flow {
  to: number[] = [];
  cap: number[] = [];
  cost: number[] = [];
  head: number[];
  next: number[] = [];
  constructor(n: number) {
    this.head = new Array(n).fill(-1);
  }
  add(u: number, v: number, cap: number, cost: number) {
    const e = this.to.length;
    this.to.push(v, u);
    this.cap.push(cap, 0);
    this.cost.push(cost, -cost);
    this.next.push(this.head[u]!, this.head[v]!);
    this.head[u] = e;
    this.head[v] = e + 1;
    return e;
  }
  run(s: number, t: number) {
    const n = this.head.length;
    for (;;) {
      const dist = new Array(n).fill(Infinity);
      const prev = new Array(n).fill(-1);
      const inQ = new Array(n).fill(false);
      dist[s] = 0;
      const q = [s];
      inQ[s] = true;
      for (let qi = 0; qi < q.length; qi++) {
        const u = q[qi]!;
        inQ[u] = false;
        for (let e = this.head[u]!; e !== -1; e = this.next[e]!) {
          if (this.cap[e]! <= 0) continue;
          const v = this.to[e]!;
          const d = dist[u]! + this.cost[e]!;
          if (d < dist[v]!) {
            dist[v] = d;
            prev[v] = e;
            if (!inQ[v]) {
              inQ[v] = true;
              q.push(v);
            }
          }
        }
      }
      if (dist[t] === Infinity) return;
      let push = Infinity;
      for (let v = t; v !== s; v = this.to[prev[v]! ^ 1]!) push = Math.min(push, this.cap[prev[v]!]!);
      for (let v = t; v !== s; v = this.to[prev[v]! ^ 1]!) {
        this.cap[prev[v]!]! -= push;
        this.cap[prev[v]! ^ 1]! += push;
      }
    }
  }
}

/**
 * Colours the edges of a bipartite graph with k colours so that no node has
 * two edges of the same colour. Every node must have at most k edges.
 * Returns the colour of each edge.
 */
export function colourEdges(edges: readonly [number, number][], k: number): number[] {
  const colour = new Array<number>(edges.length).fill(-1);
  // at[node][c] = the edge of colour c at that node, or -1.
  const at = new Map<number, number[]>();
  const slots = (n: number) => {
    let a = at.get(n);
    if (!a) at.set(n, (a = new Array(k).fill(-1)));
    return a;
  };
  const other = (e: number, n: number) => (edges[e]![0] === n ? edges[e]![1] : edges[e]![0]);
  edges.forEach(([u, v], e) => {
    const su = slots(u);
    const sv = slots(v);
    const a = su.indexOf(-1);
    const b = sv.indexOf(-1);
    if (a < 0 || b < 0) throw new Error("A node has more edges than colours.");
    if (sv[a] !== -1) {
      // a is used at v: swap a and b along the path from v that alternates a, b, a, ...
      // In a bipartite graph it never comes back to u, so afterwards a is free at both ends.
      const path: number[] = [];
      let node = v;
      let c = a;
      while (slots(node)[c] !== -1) {
        const e2 = slots(node)[c]!;
        path.push(e2);
        node = other(e2, node);
        c = c === a ? b : a;
      }
      for (const e2 of path) {
        const [x, y] = edges[e2]!;
        slots(x)[colour[e2]!] = -1;
        slots(y)[colour[e2]!] = -1;
      }
      for (const e2 of path) {
        const [x, y] = edges[e2]!;
        colour[e2] = colour[e2] === a ? b : a;
        slots(x)[colour[e2]!] = e2;
        slots(y)[colour[e2]!] = e2;
      }
    }
    colour[e] = a;
    su[a] = e;
    sv[a] = e;
  });
  return colour;
}

export function allocate(workshops: readonly AllocWorkshop[], people: readonly AllocPerson[], opts: { seed: string; includeUnranked: boolean; sessions?: number }): AllocResult {
  const K = Math.min(opts.sessions ?? SESSIONS, workshops.length);
  const ids = workshops.map((w) => w.id);
  const tie = (id: string) => hash(`${opts.seed}:${id}`);
  const rankers = people.filter((p) => p.ranking && isCompleteRanking(p.ranking, ids));
  const rankOf = new Map(rankers.map((p) => [p.id, new Map(p.ranking!.map((w, i) => [w, i + 1]))]));
  const others = opts.includeUnranked ? people.filter((p) => !rankOf.has(p.id)) : [];
  const room = (w: AllocWorkshop) => (w.capacity == null ? Infinity : w.capacity * K);

  // Step 1: which K workshops each ranker gets.
  // Nodes: 0 source, 1 sink, then workshops, then two per person (their top K, and the rest).
  const W = workshops.length;
  const wNode = (i: number) => 2 + i;
  const pNode = (j: number) => 2 + W + 2 * j;
  const flow = new Flow(2 + W + 2 * rankers.length);
  const RANK = 1000; // one place down someone's list
  const EXTRA_MISS = 3 * RANK; // a second (or third) workshop from outside someone's top K
  workshops.forEach((w, i) => flow.add(wNode(i), 1, Math.min(room(w), rankers.length * K), 0));
  const choiceEdges: { person: number; workshop: number; edge: number }[] = [];
  rankers.forEach((p, j) => {
    const top = pNode(j);
    const rest = top + 1;
    flow.add(0, top, K, 0);
    // Ties between people who'd mind equally: a fixed shuffle, worth less than one rank.
    const t = tie(p.id) % 500;
    for (let k = 0; k < K; k++) flow.add(top, rest, 1, k * EXTRA_MISS + t);
    p.ranking!.forEach((wid, r) => {
      const i = ids.indexOf(wid);
      const edge = flow.add(r < K ? top : rest, wNode(i), 1, (r + 1) * RANK);
      choiceEdges.push({ person: j, workshop: i, edge });
    });
  });
  flow.run(0, 1);

  const sets = new Map<string, number[]>();
  const used = new Array<number>(W).fill(0);
  for (const c of choiceEdges) {
    if (flow.cap[c.edge] !== 0) continue;
    const pid = rankers[c.person]!.id;
    if (!sets.has(pid)) sets.set(pid, []);
    sets.get(pid)!.push(c.workshop);
    used[c.workshop]! += 1;
  }

  // People who haven't ranked: the workshops with most space left, after everyone who has.
  for (const p of [...others].sort((a, b) => tie(a.id) - tie(b.id) || a.id.localeCompare(b.id))) {
    const pick = workshops
      .map((w, i) => ({ i, free: room(w) - used[i]! }))
      .filter((x) => x.free > 0)
      .sort((a, b) => (a.free === b.free ? used[a.i]! - used[b.i]! || a.i - b.i : b.free - a.free))
      .slice(0, K)
      .map((x) => x.i);
    if (!pick.length) continue;
    sets.set(p.id, pick);
    for (const i of pick) used[i]! += 1;
  }

  // Step 2: which session for each. Split each workshop's people into groups
  // of K; within a group everyone is in a different session, so each session
  // gets at most one person per group, which is at most the room size.
  const placed = [...sets.keys()].sort((a, b) => tie(`s:${a}`) - tie(`s:${b}`) || a.localeCompare(b));
  const personIndex = new Map(placed.map((id, n) => [id, n]));
  const seen = new Array<number>(W).fill(0);
  const edges: [number, number][] = [];
  const edgeInfo: { pid: string; w: number }[] = [];
  const groupBase = placed.length;
  const groupIds = new Map<string, number>();
  for (const pid of placed) {
    for (const i of sets.get(pid)!) {
      const g = Math.floor(seen[i]! / K);
      seen[i]! += 1;
      const key = `${i}:${g}`;
      if (!groupIds.has(key)) groupIds.set(key, groupBase + groupIds.size);
      edges.push([personIndex.get(pid)!, groupIds.get(key)!]);
      edgeInfo.push({ pid, w: i });
    }
  }
  const colours = colourEdges(edges, K);

  const placements = new Map<string, Map<number, Placement>>();
  edgeInfo.forEach(({ pid, w }, e) => {
    if (!placements.has(pid)) placements.set(pid, new Map());
    const wid = workshops[w]!.id;
    placements.get(pid)!.set(colours[e]! + 1, { workshopId: wid, choice: rankOf.get(pid)?.get(wid) ?? null });
  });
  const unplaced: AllocResult["unplaced"] = [];
  for (const p of [...rankers, ...others]) {
    const mine = placements.get(p.id);
    for (let s = 1; s <= K; s++) if (!mine?.has(s)) unplaced.push({ personId: p.id, slot: s });
  }

  const byChoice = new Array<number>(Math.max(6, W)).fill(0);
  let allTop = 0;
  let gotFirst = 0;
  let missedOne = 0;
  let missedTwoOrMore = 0;
  for (const p of rankers) {
    const mine = [...(placements.get(p.id)?.values() ?? [])];
    for (const pl of mine) if (pl.choice) byChoice[pl.choice - 1]! += 1;
    const missed = K - mine.filter((pl) => pl.choice != null && pl.choice <= K).length;
    if (missed === 0) allTop++;
    if (missed === 1) missedOne++;
    if (missed >= 2) missedTwoOrMore++;
    if (mine.some((pl) => pl.choice === 1)) gotFirst++;
  }

  return {
    placements,
    unplaced,
    summary: {
      people: placements.size,
      ranked: rankers.length,
      sessions: K,
      allTop,
      gotFirst,
      missedOne,
      missedTwoOrMore,
      byChoice,
      unplaced: unplaced.length,
      workshops: workshops.map((w) => {
        const perSession = Array.from({ length: K }, (_, s) => [...placements.values()].filter((m) => m.get(s + 1)?.workshopId === w.id).length);
        return {
          id: w.id,
          capacity: w.capacity,
          placed: perSession.reduce((a, b) => a + b, 0),
          perSession,
          wanted: rankers.filter((p) => (rankOf.get(p.id)!.get(w.id) ?? 99) <= K).length,
        };
      }),
      seed: opts.seed,
    },
  };
}
