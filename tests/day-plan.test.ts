import { describe, expect, it } from "vitest";
import { buildDay, dueAlert, sharedTitle, whereNow, type DayInput } from "@/lib/day/plan";
import type { Room, Session } from "@/lib/types";

const S = (id: string, title: string, category: Session["category"], start: string, end: string, roomId: string | null = null): Session => ({
  id, slug: id, title, category, startsAt: `2026-11-21T${start}:00Z`, endsAt: `2026-11-21T${end}:00Z`, roomId, description: "", objectives: [], capacity: null, workshopId: null, speakerIds: [], isProvisional: false, sort: 0,
});
const rooms: Room[] = [
  { id: "r-inb", name: "INB0114 Lecture Theatre", building: "Isaac Newton Building (INB)", floor: null, directions: "Follow the signs", capacity: null },
  { id: "r-lms5", name: "LMS0005", building: "Lincoln Medical School", floor: "Ground floor", directions: null, capacity: null },
  { id: "r-lms8", name: "LMS0008", building: "Lincoln Medical School", floor: null, directions: null, capacity: null },
];
const sessions = [
  S("welcome", "Welcome", "keynote", "09:00", "09:15", "r-inb"),
  S("oral-inb", "Oral presentations: INB", "research", "10:30", "11:30", "r-inb"),
  S("oral-lms", "Oral presentations: LMS0005", "research", "10:30", "11:30", "r-lms5"),
  S("ws2", "Workshop session 2", "workshop", "13:30", "14:15"),
  S("ws1", "Workshop session 1", "workshop", "12:45", "13:30"),
  S("ws3", "Workshop session 3", "workshop", "14:40", "15:25"),
];
const base: DayInput = {
  sessions, rooms,
  workshops: [
    { id: "w1", number: 1, title: "Research", slug: "research", room: "LMS0005" },
    { id: "w2", number: 2, title: "Portfolio", slug: "portfolio", room: "LMS0008" },
  ],
  mapPlaces: [{ slug: "lms0005", name: "LMS0005", code: "LMS0005", roomId: "r-lms5" }],
  places: [{ slot: 1, workshopId: "w2", choice: 1 }, { slot: 2, workshopId: "w1", choice: 3 }],
  placesPublished: true,
  assignments: [],
};

describe("buildDay", () => {
  it("puts each workshop session in time order with their own workshop and room", () => {
    const day = buildDay(base);
    const ws = day.filter((i) => i.category === "workshop");
    expect(ws.map((i) => i.slot)).toEqual([1, 2, 3]);
    expect(ws[0]!.title).toBe("Portfolio");
    expect(ws[0]!.room?.name).toBe("LMS0008");
    expect(ws[1]!.mapHref).toBe("/map?place=lms0005");
    expect(ws[1]!.choice).toBe(3);
    expect(ws[2]!.workshop).toBeNull();
    expect(ws[2]!.pending).toMatch(/No workshop place/);
  });
  it("offers both rooms when two things run at once", () => {
    const oral = buildDay(base).find((i) => i.startsAt?.includes("10:30"))!;
    expect(oral.title).toBe("Oral presentations");
    expect(oral.options.map((o) => o.room?.name)).toEqual(["INB0114 Lecture Theatre", "LMS0005"]);
  });
  it("shows only the room someone was placed in", () => {
    const oral = buildDay({ ...base, assignments: [{ sessionId: "oral-lms", role: "presenting", note: "You're third" }] }).find((i) => i.startsAt?.includes("10:30"))!;
    expect(oral.options).toEqual([]);
    expect(oral.room?.name).toBe("LMS0005");
    expect(oral.role).toBe("presenting");
  });
  it("hides places until they're published", () => {
    const ws = buildDay({ ...base, places: [], placesPublished: false }).filter((i) => i.category === "workshop");
    expect(ws.every((i) => i.pending?.includes("once places are published"))).toBe(true);
  });
});

describe("timing", () => {
  const day = buildDay(base);
  const at = (t: string) => new Date(`2026-11-21T${t}:00Z`).getTime();
  it("knows what's now and next", () => {
    const { current, next } = whereNow(day, at("12:50"));
    expect(current?.title).toBe("Portfolio");
    expect(next?.title).toBe("Research");
  });
  it("alerts a few minutes before, and prefers what's about to start", () => {
    expect(dueAlert(day, at("12:30"), 10)).toBeNull();
    expect(dueAlert(day, at("12:36"), 10)?.title).toBe("Portfolio");
    expect(dueAlert(day, at("13:22"), 10)?.title).toBe("Research");
    expect(dueAlert(day, at("13:00"), 10)).toBeNull();
  });
  it("shares a title", () => {
    expect(sharedTitle(["Talks: A", "Talks: B"])).toBe("Talks");
    expect(sharedTitle(["Lunch", "Posters"])).toBe("Lunch or Posters");
  });
});
