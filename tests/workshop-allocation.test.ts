import { describe, expect, it } from "vitest";
import { allocate, isCompleteRanking, pairingProblems, type AllocPerson, type AllocWorkshop } from "@/lib/workshops/allocate";

const W = (cap: number | null = null): AllocWorkshop[] => [
  { id: "1a", slot: 1, stream: "a", capacity: cap },
  { id: "1b", slot: 1, stream: "b", capacity: cap },
  { id: "2a", slot: 2, stream: "a", capacity: cap },
  { id: "2b", slot: 2, stream: "b", capacity: cap },
  { id: "3a", slot: 3, stream: "a", capacity: cap },
  { id: "3b", slot: 3, stream: "b", capacity: cap },
];
const person = (id: string, ranking: string[] | null): AllocPerson => ({ id, ranking });
const got = (r: ReturnType<typeof allocate>, id: string) => [1, 2, 3].map((s) => r.placements.get(id)?.get(s)?.workshopId);

describe("workshop allocation", () => {
  it("gives everyone their preferred workshop in each session when there's room", () => {
    const r = allocate(W(), [person("p", ["2b", "1a", "3a", "1b", "2a", "3b"])], { seed: "x", includeUnranked: false });
    expect(got(r, "p")).toEqual(["1a", "2b", "3a"]);
    expect(r.placements.get("p")!.get(2)!.choice).toBe(1);
    expect(r.summary.allPreferred).toBe(1);
    expect(r.summary.gotFirst).toBe(1);
  });

  it("never goes over a room's capacity", () => {
    const people = Array.from({ length: 30 }, (_, i) => person(`p${i}`, ["1a", "2a", "3a", "1b", "2b", "3b"]));
    const r = allocate(W(15), people, { seed: "x", includeUnranked: false });
    for (const w of r.summary.workshops) expect(w.placed).toBeLessThanOrEqual(15);
    expect(r.unplaced).toHaveLength(0);
  });

  it("moves the people who mind least when a room is full", () => {
    // Both want 1a. "close" ranked 1b straight after; "far" ranked 1b last.
    const people = [person("close", ["1a", "1b", "2a", "2b", "3a", "3b"]), person("far", ["1a", "2a", "2b", "3a", "3b", "1b"])];
    const ws = W(10).map((w) => (w.id === "1a" ? { ...w, capacity: 1 } : w));
    const r = allocate(ws, people, { seed: "x", includeUnranked: false });
    expect(got(r, "far")[0]).toBe("1a");
    expect(got(r, "close")[0]).toBe("1b");
  });

  it("finds the lowest possible total of ranks", () => {
    // Brute force every split for small groups and compare.
    const ids = ["1a", "1b", "2a", "2b", "3a", "3b"];
    const shuffle = (seed: number) => {
      const a = [...ids];
      let s = seed;
      for (let i = a.length - 1; i > 0; i--) {
        s = (s * 9301 + 49297) % 233280;
        const j = Math.floor((s / 233280) * (i + 1));
        [a[i], a[j]] = [a[j]!, a[i]!];
      }
      return a;
    };
    for (let trial = 0; trial < 40; trial++) {
      const people = Array.from({ length: 8 }, (_, i) => person(`p${i}`, shuffle(trial * 31 + i)));
      const ws = W(4);
      const r = allocate(ws, people, { seed: `t${trial}`, includeUnranked: false });
      const total = people.reduce((t, p) => t + [...r.placements.get(p.id)!.values()].reduce((x, pl) => x + pl.choice!, 0), 0);
      // Best possible: per session, choose 4 people for A (2^8 combos).
      let best = 0;
      for (const s of [1, 2, 3]) {
        let bestSlot = Infinity;
        for (let mask = 0; mask < 256; mask++) {
          const inA = people.filter((_, i) => mask & (1 << i));
          if (inA.length !== 4) continue;
          const cost = people.reduce((t, p) => t + p.ranking!.indexOf(inA.includes(p) ? `${s}a` : `${s}b`) + 1, 0);
          bestSlot = Math.min(bestSlot, cost);
        }
        best += bestSlot;
      }
      expect(total).toBe(best);
    }
  });

  it("protects people already moved in another session", () => {
    // Everyone has the same gap in every session, so only fairness decides.
    const people = Array.from({ length: 4 }, (_, i) => person(`p${i}`, ["1a", "1b", "2a", "2b", "3a", "3b"]));
    const ws = W(10).map((w) => (w.stream === "a" ? { ...w, capacity: 3 } : w));
    const r = allocate(ws, people, { seed: "fair", includeUnranked: false });
    expect(r.moved).toHaveLength(3);
    expect(new Set(r.moved.map((m) => m.personId)).size).toBe(3);
    expect(r.summary.movedTwiceOrMore).toBe(0);
  });

  it("is the same every time for the same seed", () => {
    const people = Array.from({ length: 20 }, (_, i) => person(`p${i}`, ["1a", "2a", "3a", "1b", "2b", "3b"]));
    const a = allocate(W(10), people, { seed: "same", includeUnranked: false });
    const b = allocate(W(10), [...people].reverse(), { seed: "same", includeUnranked: false });
    for (const p of people) expect(got(a, p.id)).toEqual(got(b, p.id));
  });

  it("places people who haven't ranked where there's most room, only if asked", () => {
    const people = [person("r1", ["1a", "2a", "3a", "1b", "2b", "3b"]), person("r2", ["1a", "2a", "3a", "1b", "2b", "3b"]), person("u", null)];
    expect(allocate(W(5), people, { seed: "x", includeUnranked: false }).placements.has("u")).toBe(false);
    const r = allocate(W(5), people, { seed: "x", includeUnranked: true });
    expect(got(r, "u")).toEqual(["1b", "2b", "3b"]);
    expect(r.placements.get("u")!.get(1)!.choice).toBeNull();
  });

  it("reports people who can't be placed when both rooms are full", () => {
    const people = Array.from({ length: 5 }, (_, i) => person(`p${i}`, ["1a", "2a", "3a", "1b", "2b", "3b"]));
    const r = allocate(W(2), people, { seed: "x", includeUnranked: false });
    expect(r.unplaced.filter((u) => u.slot === 1)).toHaveLength(1);
    expect(r.summary.unplaced).toBe(3);
  });

  it("checks rankings and pairings", () => {
    const ids = ["1a", "1b", "2a", "2b", "3a", "3b"];
    expect(isCompleteRanking(["1a", "1b", "2a", "2b", "3a", "3b"], ids)).toBe(true);
    expect(isCompleteRanking(["1a", "1a", "2a", "2b", "3a", "3b"], ids)).toBe(false);
    expect(isCompleteRanking(["1a", "1b"], ids)).toBe(false);
    expect(pairingProblems(W())).toEqual([]);
    expect(pairingProblems(W().filter((w) => w.slot !== 3))).toEqual(["Session 3 has no workshops yet."]);
    expect(pairingProblems(W().map((w) => (w.id === "1b" ? { ...w, stream: "a" as const } : w)))[0]).toMatch(/two workshops marked A/);
  });
});
