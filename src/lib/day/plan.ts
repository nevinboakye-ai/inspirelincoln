import type { MapPlace, Room, Session, SessionCategory } from "@/lib/types";

/**
 * A person's own programme for the day ("My day"), built from the public
 * programme plus what is only theirs: the workshop they were placed in for
 * each workshop session, and any session the committee put them in.
 *
 * Pure, so the hub, the scanner and the live alerts all agree, and so it
 * can be tested.
 */

export type AssignmentRole = "attending" | "presenting" | "judging" | "chairing" | "helping";
export const ASSIGNMENT_ROLES: AssignmentRole[] = ["presenting", "judging", "chairing", "helping", "attending"];
export const ASSIGNMENT_LABEL: Record<AssignmentRole, string> = {
  presenting: "You're presenting",
  judging: "You're judging",
  chairing: "You're chairing",
  helping: "You're helping",
  attending: "You're in this one",
};
/** The same, for someone else (the scanner and the committee pages). */
export const ASSIGNMENT_LABEL_THEM: Record<AssignmentRole, string> = {
  presenting: "Presenting",
  judging: "Judging",
  chairing: "Chairing",
  helping: "Helping",
  attending: "Attending",
};

export type DayWorkshop = { id: string; number: number; title: string; slug: string; room: string | null };
export type DayPlace = { slot: number; workshopId: string; choice?: number | null };
export type DayAssignment = { sessionId: string; role: AssignmentRole; note: string | null };
export type DayMark = { slot: number; workshopId: string; markedAt: string; markedBy?: string | null };

export type DayRoom = { name: string; building: string | null; floor: string | null; directions: string | null };
export type DayOption = { sessionId: string; title: string; room: DayRoom | null; mapHref: string | null };

export type DayItem = {
  /** Stable for the day: the session id. */
  id: string;
  sessionId: string;
  startsAt: string | null;
  endsAt: string | null;
  category: SessionCategory;
  /** What they're going to, e.g. the workshop's name rather than "Workshop session 1". */
  title: string;
  /** The programme's name for the slot, when the title is something more personal. */
  slotTitle: string | null;
  room: DayRoom | null;
  mapHref: string | null;
  /** Why this one is theirs, when it is. */
  personal: "workshop" | "assigned" | null;
  role: AssignmentRole | null;
  note: string | null;
  /** Workshop sessions only. */
  slot: number | null;
  workshop: DayWorkshop | null;
  choice: number | null;
  /** Marked at a workshop on the day. */
  mark: DayMark | null;
  /** Workshop session with no place yet: why. */
  pending: string | null;
  /** Two or more things at once, and they can go to either. */
  options: DayOption[];
};

export type DayInput = {
  sessions: Session[];
  rooms: Room[];
  workshops: DayWorkshop[];
  mapPlaces: Pick<MapPlace, "slug" | "name" | "code" | "roomId">[];
  places: DayPlace[];
  /** False while workshop places aren't out yet (delegates only see theirs once published). */
  placesPublished: boolean;
  assignments: DayAssignment[];
  marks?: DayMark[];
};

const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** A room by name, as the committee typed it for a workshop ("LMS0005", "INB Lecture Hall"). */
export function findRoom(rooms: Room[], name: string | null | undefined): Room | null {
  const n = norm(name);
  if (!n) return null;
  return rooms.find((r) => norm(r.name) === n) ?? rooms.find((r) => norm(r.name).startsWith(n) || n.startsWith(norm(r.name)) && norm(r.name).length >= 6) ?? null;
}

/** Where a room is on the campus map, if it's there. */
export function mapHrefFor(places: DayInput["mapPlaces"], room: Room | null, name?: string | null): string | null {
  if (room) {
    const p = places.find((x) => x.roomId === room.id);
    if (p) return `/map?place=${p.slug}`;
  }
  const n = norm(name ?? room?.name);
  if (!n) return null;
  const byName = places.find((x) => norm(x.code) === n || norm(x.name) === n);
  if (byName) return `/map?place=${byName.slug}`;
  return room ? `/map?room=${room.id}` : null;
}

const asDayRoom = (r: Room | null, fallbackName?: string | null): DayRoom | null =>
  r ? { name: r.name, building: r.building, floor: r.floor, directions: r.directions } : fallbackName ? { name: fallbackName, building: null, floor: null, directions: null } : null;

const byTime = (a: Session, b: Session) => {
  if (a.startsAt && b.startsAt) return a.startsAt.localeCompare(b.startsAt) || a.sort - b.sort;
  if (a.startsAt) return -1;
  if (b.startsAt) return 1;
  return a.sort - b.sort;
};

/** The workshop sessions in time order: the first is session 1. Matches the workshop places. */
export function workshopSlots(sessions: Session[]): Map<string, number> {
  const out = new Map<string, number>();
  sessions
    .filter((s) => s.category === "workshop")
    .sort(byTime)
    .forEach((s, i) => out.set(s.id, i + 1));
  return out;
}

export function buildDay(input: DayInput): DayItem[] {
  const { rooms, workshops, mapPlaces, places, placesPublished, assignments, marks = [] } = input;
  const sessions = [...input.sessions].sort(byTime);
  const slots = workshopSlots(sessions);
  const assigned = new Map(assignments.map((a) => [a.sessionId, a]));
  const roomOf = (s: Session) => rooms.find((r) => r.id === s.roomId) ?? null;

  const base = (s: Session): DayItem => {
    const room = roomOf(s);
    const a = assigned.get(s.id);
    return {
      id: s.id,
      sessionId: s.id,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      category: s.category,
      title: s.title,
      slotTitle: null,
      room: asDayRoom(room),
      mapHref: room ? mapHrefFor(mapPlaces, room) : null,
      personal: a ? "assigned" : null,
      role: a?.role ?? null,
      note: a?.note ?? null,
      slot: null,
      workshop: null,
      choice: null,
      mark: null,
      pending: null,
      options: [],
    };
  };

  const workshopItem = (s: Session): DayItem => {
    const item = base(s);
    const slot = slots.get(s.id) ?? null;
    item.slot = slot;
    const place = slot != null ? places.find((p) => p.slot === slot) : undefined;
    const w = place ? workshops.find((x) => x.id === place.workshopId) : undefined;
    item.mark = (slot != null && marks.find((m) => m.slot === slot)) || null;
    if (w) {
      const room = findRoom(rooms, w.room) ?? roomOf(s);
      item.title = w.title;
      item.slotTitle = s.title;
      item.workshop = w;
      item.choice = place?.choice ?? null;
      item.room = asDayRoom(findRoom(rooms, w.room), w.room) ?? asDayRoom(room);
      item.mapHref = mapHrefFor(mapPlaces, room, w.room);
      item.personal = "workshop";
    } else {
      item.pending = placesPublished ? "No workshop place for this session. Ask a committee member on the day." : "Your workshop and room show here once places are published.";
    }
    return item;
  };

  // Group things that start at the same moment: two talks at once means a choice, unless they've been placed in one.
  const out: DayItem[] = [];
  const seen = new Set<string>();
  for (const s of sessions) {
    if (seen.has(s.id)) continue;
    const together = s.startsAt ? sessions.filter((x) => x.startsAt === s.startsAt && !seen.has(x.id) && x.category !== "workshop") : [s];
    if (s.category === "workshop" || together.length <= 1) {
      seen.add(s.id);
      out.push(s.category === "workshop" ? workshopItem(s) : base(s));
      continue;
    }
    together.forEach((x) => seen.add(x.id));
    const mine = together.find((x) => assigned.has(x.id));
    if (mine) {
      out.push(base(mine));
      continue;
    }
    const first = base(together[0]!);
    first.title = sharedTitle(together.map((x) => x.title));
    first.room = null;
    first.mapHref = null;
    first.endsAt = together.map((x) => x.endsAt).filter(Boolean).sort().at(-1) ?? first.endsAt;
    first.options = together.map((x) => {
      const r = roomOf(x);
      return { sessionId: x.id, title: x.title, room: asDayRoom(r), mapHref: r ? mapHrefFor(mapPlaces, r) : null };
    });
    out.push(first);
  }
  return out;
}

/** "Oral presentations: INB" and "Oral presentations: LMS0005" read as "Oral presentations". */
export function sharedTitle(titles: string[]): string {
  const heads = titles.map((t) => t.split(/[:–—-]\s/)[0]!.trim());
  return heads.every((h) => h === heads[0]) && heads[0] ? heads[0] : titles.join(" or ");
}

/** Where someone is meant to be at a moment: the item running now and the next one to start. */
export function whereNow(items: DayItem[], now: number) {
  const timed = items.filter((i) => i.startsAt);
  const t = (iso: string | null) => (iso ? new Date(iso).getTime() : NaN);
  const current = timed.find((i) => t(i.startsAt) <= now && (i.endsAt ? now < t(i.endsAt) : now < t(i.startsAt) + 30 * 60_000)) ?? null;
  const next = timed.find((i) => t(i.startsAt) > now) ?? null;
  return { current, next };
}

/** Where an item happens, in a few words: "LMS0005, Lincoln Medical School". */
export function placeLine(room: DayRoom | null): string | null {
  if (!room) return null;
  return [room.name, room.building && !norm(room.name).startsWith(norm(room.building).slice(0, 3)) ? room.building : null, room.floor].filter(Boolean).join(", ");
}

/** The item a live alert should be about right now, if any. */
export function dueAlert(items: DayItem[], now: number, leadMinutes: number, graceMinutes = 5): DayItem | null {
  const lead = leadMinutes * 60_000;
  const grace = graceMinutes * 60_000;
  const due = items.filter((i) => {
    if (!i.startsAt) return false;
    const s = new Date(i.startsAt).getTime();
    const e = i.endsAt ? new Date(i.endsAt).getTime() : s + grace;
    return now >= s - lead && now < Math.min(s + grace, e);
  });
  // The one starting soonest: if one has started and another is about to, the next one matters more.
  return due.sort((a, b) => b.startsAt!.localeCompare(a.startsAt!))[0] ?? null;
}
