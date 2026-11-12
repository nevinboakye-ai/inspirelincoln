import { describe, expect, it } from "vitest";
import { allocate, colourEdges, isCompleteRanking, type AllocPerson, type AllocWorkshop } from "@/lib/workshops/allocate";

const IDS = ["w1", "w2", "w3", "w4", "w5", "w6"];
const W = (cap: number | null = null, caps: Record<string, number> = {}): AllocWorkshop[] => IDS.map((id) => ({ id, capacity: caps[id] ?? cap }));
const person = (id: string, ranking: string[] | null): AllocPerson => ({ id, ranking });
const mine = (r: ReturnType<typeof allocate>, id: string) => [1, 2, 3].map((s) => r.placements.get(id)?.get(s)?.workshopId);
const setOf = (r: ReturnType<typeof allocate>, id: string) => mine(r, id).filter(Boolean).sort();

/** A deterministic pseudo-random ranking for each person. */
const shuffled = (seed: number) => {
  const a = [...IDS];
  let x = seed * 9301 + 49297;
  for (let i = a.length - 1; i > 0; i--) {
    x = (x * 9301 + 49297) % 233280;
    const j = Math.floor((x / 233280) * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
};

/** Checks every rule that must always hold. */
const valid = (r: ReturnType<typeof allocate>, ws: AllocWorkshop[]) => {
  for (const [, m] of r.placements) {
    const w = [...m.values()].map((p) => p.workshopId);
    expect(new Set(w).size).toBe(w.length); // never the same workshop twice
    for (const s of m.keys()) expect([1, 2, 3]).toContain(s);
  }
  for (const w of ws) {
    for (const s of [1, 2, 3]) {
      const n = [...r.placements.values()].filter((m) => m.get(s)?.workshopId === w.id).length;
      if (w.capacity != null) expect(n).toBeLessThanOrEqual(w.capacity);
    }
  }
};

describe("workshop allocation", () => {
  it("gives everyone their top three, one per session, when there's room", () => {
    const r = allocate(W(), [person("p", ["w4", "w1", "w6", "w2", "w3", "w5"])], { seed: "x", includeUnranked: false });
    expect(setOf(r, "p")).toEqual(["w1", "w4", "w6"]);
    expect(r.placements.get("p")!.size).toBe(3);
    expect(r.summary.allTop).toBe(1);
    expect(r.summary.gotFirst).toBe(1);
    expect(r.summary.byChoice.slice(0, 3)).toEqual([1, 1, 1]);
  });

  it("never puts more people in a room than it holds, in any session", () => {
    const ws = W(12);
    const people = Array.from({ length: 70 }, (_, i) => person(`p${i}`, shuffled(i)));
    const r = allocate(ws, people, { seed: "x", includeUnranked: false });
    valid(r, ws);
    expect(r.unplaced).toHaveLength(0);
  });

  it("still fits everyone when one workshop is far more popular than its room", () => {
    // Everyone ranks w1 first, but w1 only holds 5 a session (15 over the day).
    const ws = W(30, { w1: 5 });
    const people = Array.from({ length: 40 }, (_, i) => person(`p${i}`, ["w1", ...shuffled(i).filter((x) => x !== "w1")]));
    const r = allocate(ws, people, { seed: "x", includeUnranked: false });
    valid(r, ws);
    expect([...r.placements.values()].filter((m) => [...m.values()].some((p) => p.workshopId === "w1"))).toHaveLength(15);
    expect(r.summary.workshops.find((w) => w.id === "w1")!.perSession).toEqual([5, 5, 5]);
  });

  it("gives a 4th choice rather than a 6th when someone has to miss out", () => {
    // w3 holds one a session, so three over the day.
    const ws = W(10, { w3: 1 });
    const people = [person("a", ["w1", "w2", "w3", "w4", "w5", "w6"]), person("b", ["w3", "w1", "w2", "w4", "w5", "w6"]), person("c", ["w3", "w5", "w6", "w1", "w2", "w4"]), person("d", ["w2", "w3", "w1", "w6", "w5", "w4"])];
    const r = allocate(ws, people, { seed: "x", includeUnranked: false });
    valid(r, ws);
    // Four people want w3 in their top three, and it takes three over the day.
    const missed = people.filter((p) => !setOf(r, p.id).includes("w3"));
    expect(missed).toHaveLength(1);
    // Whoever misses it gets their 4th choice, not something lower.
    const rk = missed[0]!.ranking!;
    expect(setOf(r, missed[0]!.id)).toEqual([rk[0], rk[1], rk[3]].sort());
  });

  it("finds the lowest possible total of ranks", () => {
    // w1 holds one a session (3 over the day). Four people want it: three
    // ranked it 1st, one ranked it 3rd. The one who ranked it 3rd should miss out.
    const ws = W(10, { w1: 1 });
    const people = [
      person("x1", ["w1", "w2", "w3", "w4", "w5", "w6"]),
      person("x2", ["w1", "w3", "w4", "w2", "w5", "w6"]),
      person("x3", ["w1", "w4", "w5", "w2", "w3", "w6"]),
      person("low", ["w5", "w6", "w1", "w2", "w3", "w4"]),
    ];
    const r = allocate(ws, people, { seed: "x", includeUnranked: false });
    expect(setOf(r, "low")).toEqual(["w2", "w5", "w6"]);
    for (const id of ["x1", "x2", "x3"]) expect(setOf(r, id)).toContain("w1");
  });

  it("doesn't make the same person miss out twice while others keep all their top three", () => {
    // w1 and w2 each fit 3 over the day. Six people rank w1 and w2 in their top three.
    const ws = W(20, { w1: 1, w2: 1 });
    const people = Array.from({ length: 6 }, (_, i) => person(`p${i}`, ["w1", "w2", "w3", "w4", "w5", "w6"]));
    const r = allocate(ws, people, { seed: "s", includeUnranked: false });
    valid(r, ws);
    const misses = people.map((p) => 3 - setOf(r, p.id).filter((w) => ["w1", "w2", "w3"].includes(w!)).length);
    expect(Math.max(...misses)).toBe(1);
    expect(r.summary.missedTwoOrMore).toBe(0);
    expect(r.summary.missedOne).toBe(6);
  });

  it("is the same every time for the same seed, and fair between seeds", () => {
    const ws = W(10, { w1: 1 });
    const people = Array.from({ length: 6 }, (_, i) => person(`p${i}`, ["w1", "w2", "w3", "w4", "w5", "w6"]));
    const a = allocate(ws, people, { seed: "same", includeUnranked: false });
    const b = allocate(ws, people, { seed: "same", includeUnranked: false });
    expect(people.map((p) => mine(a, p.id))).toEqual(people.map((p) => mine(b, p.id)));
    // Across many seeds, everyone gets w1 sometimes.
    const lucky = new Set<string>();
    for (let s = 0; s < 40; s++) {
      const r = allocate(ws, people, { seed: `s${s}`, includeUnranked: false });
      for (const p of people) if (setOf(r, p.id).includes("w1")) lucky.add(p.id);
    }
    expect(lucky.size).toBe(6);
  });

  it("places people who haven't ranked only when asked, where there's most room", () => {
    const ws = W(10, { w1: 1, w2: 1, w3: 1 });
    const people = [person("r", ["w1", "w2", "w3", "w4", "w5", "w6"]), person("u", null)];
    expect(allocate(ws, people, { seed: "x", includeUnranked: false }).placements.has("u")).toBe(false);
    const r = allocate(ws, people, { seed: "x", includeUnranked: true });
    valid(r, ws);
    expect(setOf(r, "r")).toEqual(["w1", "w2", "w3"]);
    expect(setOf(r, "u")).toEqual(["w4", "w5", "w6"]);
    expect(r.placements.get("u")!.get(1)!.choice).toBeNull();
  });

  it("reports the sessions it couldn't fill when every room is full", () => {
    const ws = W(1);
    const people = Array.from({ length: 3 }, (_, i) => person(`p${i}`, shuffled(i)));
    const r = allocate(ws, people, { seed: "x", includeUnranked: false });
    valid(r, ws);
    // 6 rooms of 1 is 6 places a session: plenty for 3 people.
    expect(r.unplaced).toHaveLength(0);
    const crowd = Array.from({ length: 8 }, (_, i) => person(`c${i}`, shuffled(i)));
    const r2 = allocate(ws, crowd, { seed: "x", includeUnranked: false });
    valid(r2, ws);
    expect(r2.unplaced).toHaveLength(8 * 3 - 6 * 3);
  });

  it("ignores rankings that don't list every workshop", () => {
    expect(isCompleteRanking(["w1", "w2"], IDS)).toBe(false);
    expect(isCompleteRanking(IDS, IDS)).toBe(true);
    const r = allocate(W(), [person("p", ["w1", "w2"])], { seed: "x", includeUnranked: false });
    expect(r.summary.ranked).toBe(0);
  });

  it("colours a bipartite graph's edges with no clashes", () => {
    const edges: [number, number][] = [];
    for (let p = 0; p < 30; p++) for (const g of shuffled(p).slice(0, 3)) edges.push([p, 100 + Number(g.slice(1)) * 10 + (p % 5 < 3 ? 0 : 1)]);
    // Make sure no group node exceeds 3 edges by building groups explicitly.
    const groups = new Map<number, number>();
    const fixed = edges.map(([p, g]): [number, number] => {
      const n = groups.get(g) ?? 0;
      groups.set(g, n + 1);
      return [p, g * 100 + Math.floor(n / 3)];
    });
    const c = colourEdges(fixed, 3);
    const seen = new Set<string>();
    fixed.forEach(([u, v], e) => {
      for (const n of [u, v]) {
        const k = `${n}:${c[e]}`;
        expect(seen.has(k)).toBe(false);
        seen.add(k);
      }
    });
  });
});
