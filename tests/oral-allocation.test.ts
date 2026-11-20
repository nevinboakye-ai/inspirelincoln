import { describe, expect, it } from "vitest";
import { allocateOrals, lockOral, moveOral, toPlacements, type OralPlacement, type OralRoom } from "@/lib/orals/allocate";

const ROOMS: OralRoom[] = [
  { id: "inb", capacity: 5 },
  { id: "lms", capacity: 4 },
];
const NINE = Array.from({ length: 9 }, (_, i) => `p${i + 1}@x.test`);
const sizes = (r: ReturnType<typeof allocateOrals>) => ROOMS.map((x) => r.rooms.get(x.id)!.length);
const everyoneOnce = (r: ReturnType<typeof allocateOrals>, people: string[]) => {
  const all = [...[...r.rooms.values()].flat(), ...r.unplaced];
  expect(all.sort()).toEqual([...people].sort());
};

describe("oral room allocation", () => {
  it("fills each room to its number of talks: five and four", () => {
    for (let i = 0; i < 50; i++) {
      const r = allocateOrals(ROOMS, NINE, [], { seed: `s${i}` });
      expect(sizes(r)).toEqual([5, 4]);
      expect(r.unplaced).toEqual([]);
      expect(r.over).toEqual([]);
      everyoneOnce(r, NINE);
    }
  });

  it("is random, but the same seed gives the same answer", () => {
    const a = allocateOrals(ROOMS, NINE, [], { seed: "one" });
    const b = allocateOrals(ROOMS, NINE, [], { seed: "one" });
    expect([...a.rooms]).toEqual([...b.rooms]);
    const firsts = new Set(Array.from({ length: 40 }, (_, i) => allocateOrals(ROOMS, NINE, [], { seed: `x${i}` }).rooms.get("inb")!.join()));
    expect(firsts.size).toBeGreaterThan(30);
    // Everyone ends up in each room some of the time.
    const inInb = new Map(NINE.map((k) => [k, 0]));
    for (let i = 0; i < 400; i++) for (const k of allocateOrals(ROOMS, NINE, [], { seed: `y${i}` }).rooms.get("inb")!) inInb.set(k, inInb.get(k)! + 1);
    for (const n of inInb.values()) expect(n).toBeGreaterThan(150); // about 5 in 9 of 400 = 222
  });

  it("splits evenly when no room has a number of talks", () => {
    const rooms = [
      { id: "a", capacity: null },
      { id: "b", capacity: null },
    ];
    const r = allocateOrals(rooms, NINE, [], { seed: "even" });
    expect(rooms.map((x) => r.rooms.get(x.id)!.length).sort()).toEqual([4, 5]);
  });

  it("keeps locked people in their room and place, and shuffles the rest around them", () => {
    const current: OralPlacement[] = [
      { key: "p1@x.test", roomId: "lms", position: 2, locked: true },
      { key: "p2@x.test", roomId: "inb", position: 1, locked: true },
      { key: "p3@x.test", roomId: "inb", position: 3, locked: false },
    ];
    for (let i = 0; i < 30; i++) {
      const r = allocateOrals(ROOMS, NINE, current, { seed: `l${i}` });
      expect(r.rooms.get("lms")![1]).toBe("p1@x.test");
      expect(r.rooms.get("inb")![0]).toBe("p2@x.test");
      expect(sizes(r)).toEqual([5, 4]);
      everyoneOnce(r, NINE);
    }
  });

  it("keeps people locked out of the rooms out, and leaves out those asked", () => {
    const current: OralPlacement[] = [{ key: "p9@x.test", roomId: null, position: 0, locked: true }];
    const r = allocateOrals(ROOMS, NINE, current, { seed: "out", leaveOut: new Set(["p8@x.test"]) });
    expect(r.unplaced.sort()).toEqual(["p8@x.test", "p9@x.test"]);
    expect(sizes(r).reduce((a, b) => a + b)).toBe(7);
    // Seven people into five and four slots: as even as the rooms allow.
    expect(r.rooms.get("inb")!.length).toBeGreaterThanOrEqual(3);
    expect(r.rooms.get("lms")!.length).toBeGreaterThanOrEqual(3);
  });

  it("still places a person locked out but also left out (they're simply not placed)", () => {
    const r = allocateOrals(ROOMS, ["a@x.test"], [{ key: "a@x.test", roomId: null, position: 0, locked: true }], { seed: "z" });
    expect(r.unplaced).toEqual(["a@x.test"]);
  });

  it("places extra people over capacity and reports it", () => {
    const eleven = [...NINE, "p10@x.test", "p11@x.test"];
    const r = allocateOrals(ROOMS, eleven, [], { seed: "over" });
    expect(sizes(r).reduce((a, b) => a + b)).toBe(11);
    expect(r.over.length).toBeGreaterThan(0);
    everyoneOnce(r, eleven);
  });

  it("treats a lock on a room that's gone as free, and keeps a lock past the end in the room", () => {
    const current: OralPlacement[] = [
      { key: "p1@x.test", roomId: "gone", position: 1, locked: true },
      { key: "p2@x.test", roomId: "lms", position: 99, locked: true },
    ];
    const r = allocateOrals(ROOMS, NINE, current, { seed: "g" });
    everyoneOnce(r, NINE);
    expect(r.rooms.get("lms")).toContain("p2@x.test");
    expect(r.unplaced).toEqual([]);
  });

  it("two locks asking for the same place both stay in the room", () => {
    const current: OralPlacement[] = [
      { key: "p1@x.test", roomId: "lms", position: 1, locked: true },
      { key: "p2@x.test", roomId: "lms", position: 1, locked: true },
    ];
    const r = allocateOrals(ROOMS, NINE, current, { seed: "same" });
    const lms = r.rooms.get("lms")!;
    expect(lms.slice(0, 2).sort()).toEqual(["p1@x.test", "p2@x.test"]);
    everyoneOnce(r, NINE);
  });

  it("turns a result into numbered rows, keeping locks", () => {
    const r = allocateOrals(ROOMS, NINE, [{ key: "p1@x.test", roomId: "inb", position: 2, locked: true }], { seed: "rows" });
    const rows = toPlacements(r, new Set(["p1@x.test"]));
    expect(rows).toHaveLength(9);
    expect(rows.find((x) => x.key === "p1@x.test")).toEqual({ key: "p1@x.test", roomId: "inb", position: 2, locked: true });
    expect(rows.filter((x) => x.roomId === "inb").map((x) => x.position)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("moving people by hand", () => {
  const board: OralPlacement[] = [
    { key: "a", roomId: "inb", position: 1, locked: false },
    { key: "b", roomId: "inb", position: 2, locked: false },
    { key: "c", roomId: "inb", position: 3, locked: false },
    { key: "d", roomId: "lms", position: 1, locked: false },
    { key: "e", roomId: null, position: 0, locked: false },
  ];
  const order = (b: OralPlacement[], room: string) => b.filter((p) => p.roomId === room).sort((x, y) => x.position - y.position).map((p) => p.key);

  it("moves someone to the other room, at the end, and locks them", () => {
    const next = moveOral(board, "b", "lms");
    expect(order(next, "inb")).toEqual(["a", "c"]);
    expect(order(next, "lms")).toEqual(["d", "b"]);
    expect(next.find((p) => p.key === "b")!.locked).toBe(true);
    expect(next.find((p) => p.key === "a")!.locked).toBe(false);
    expect(next.filter((p) => p.roomId === "inb").map((p) => p.position).sort()).toEqual([1, 2]);
  });

  it("moves someone earlier or later in the running order", () => {
    expect(order(moveOral(board, "c", "inb", 1), "inb")).toEqual(["c", "a", "b"]);
    expect(order(moveOral(board, "a", "inb", 3), "inb")).toEqual(["b", "c", "a"]);
    expect(order(moveOral(board, "a", "inb", 2), "inb")).toEqual(["b", "a", "c"]);
  });

  it("places someone from outside the rooms at a chosen place", () => {
    const next = moveOral(board, "e", "lms", 1);
    expect(order(next, "lms")).toEqual(["e", "d"]);
    expect(next).toHaveLength(5);
  });

  it("takes someone out of the rooms, locked out", () => {
    const next = moveOral(board, "a", null);
    expect(order(next, "inb")).toEqual(["b", "c"]);
    expect(next.find((p) => p.key === "a")).toEqual({ key: "a", roomId: null, position: 0, locked: true });
    expect(next).toHaveLength(5);
  });

  it("adds someone not on the board yet", () => {
    const next = moveOral(board, "new", "inb", 2);
    expect(order(next, "inb")).toEqual(["a", "new", "b", "c"]);
  });

  it("locks and unlocks without moving anyone", () => {
    const next = lockOral(board, "d", true);
    expect(next.find((p) => p.key === "d")).toEqual({ key: "d", roomId: "lms", position: 1, locked: true });
    expect(lockOral(next, "d", false).find((p) => p.key === "d")!.locked).toBe(false);
    expect(lockOral(board, "zz", true)).toHaveLength(6);
  });
});

describe("sharing out the audience", () => {
  const crowd = Array.from({ length: 200 }, (_, i) => `d${i}@x.test`);
  it("shares in proportion to the seats", () => {
    const r = allocateOrals([{ id: "inb", capacity: 150 }, { id: "lms", capacity: 50 }], crowd, [], { seed: "seats" });
    expect(r.rooms.get("inb")!.length).toBe(150);
    expect(r.rooms.get("lms")!.length).toBe(50);
  });
  it("splits evenly when seats aren't set", () => {
    const r = allocateOrals([{ id: "inb", capacity: null }, { id: "lms", capacity: null }], crowd, [], { seed: "even" });
    expect(r.rooms.get("inb")!.length).toBe(100);
    expect(r.rooms.get("lms")!.length).toBe(100);
  });
  it("keeps proportions when there are more people than seats", () => {
    const r = allocateOrals([{ id: "inb", capacity: 90 }, { id: "lms", capacity: 30 }], crowd, [], { seed: "over" });
    expect(r.rooms.get("inb")!.length).toBe(150);
    expect(r.rooms.get("lms")!.length).toBe(50);
  });
  it("leaves out groups not chosen, but keeps their locked places", () => {
    const current = [{ key: "d0@x.test", roomId: "lms", position: 0, locked: true }];
    const leaveOut = new Set(crowd.slice(0, 100));
    const r = allocateOrals([{ id: "inb", capacity: null }, { id: "lms", capacity: null }], crowd, current, { seed: "g", leaveOut });
    expect(r.rooms.get("lms")).toContain("d0@x.test");
    expect(r.unplaced).toHaveLength(99);
  });
});
