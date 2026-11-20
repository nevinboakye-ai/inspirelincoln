/**
 * Oral presentation rooms.
 *
 * The oral presentations run in two rooms at the same time. Each room takes
 * a set number of talks (its capacity). The allocation shares the oral
 * presenters between the rooms at random, as evenly as the capacities allow,
 * and gives each room a random running order.
 *
 * Anyone the committee has placed by hand is locked. Locked people keep
 * their room and their place in the running order; everyone else is shared
 * out around them. Someone locked out of every room ("Not in a room") stays
 * out. The same seed always gives the same answer, so a run can be checked.
 */

import { hash } from "@/lib/workshops/allocate";

export type OralRoom = { id: string; capacity: number | null };
export type OralPlacement = { key: string; roomId: string | null; position: number; locked: boolean };
export type OralResult = {
  /** Room id -> people in running order. */
  rooms: Map<string, string[]>;
  /** People not in a room: locked out, or left out by the caller. */
  unplaced: string[];
  /** Rooms with more talks than their capacity. */
  over: { roomId: string; count: number; capacity: number }[];
};

/** A fixed shuffle: the same seed and keys always give the same order. */
export function shuffle<T>(items: readonly T[], keyOf: (x: T) => string, seed: string): T[] {
  return [...items].sort((a, b) => hash(`${seed}:${keyOf(a)}`) - hash(`${seed}:${keyOf(b)}`) || keyOf(a).localeCompare(keyOf(b)));
}

/**
 * Shares people between rooms.
 *
 * @param people everyone to place, by key (their email)
 * @param current where people are now; only locked entries are kept
 * @param leaveOut people not to place unless they're locked in a room (for example, they can't attend)
 */
export function allocateOrals(
  rooms: readonly OralRoom[],
  people: readonly string[],
  current: readonly OralPlacement[],
  opts: { seed: string; leaveOut?: ReadonlySet<string> },
): OralResult {
  const ids = new Set(rooms.map((r) => r.id));
  const everyone = [...new Set(people)];
  const known = new Set(everyone);
  const locked = current.filter((p) => p.locked && known.has(p.key));
  const lockedIn = locked.filter((p) => p.roomId && ids.has(p.roomId));
  const keep = new Set(lockedIn.map((p) => p.key));
  // Locked out of every room stays out. Locked to a room that no longer exists counts as free.
  const lockedOut = new Set(locked.filter((p) => !p.roomId).map((p) => p.key));
  const free = shuffle(
    everyone.filter((k) => !keep.has(k) && !lockedOut.has(k) && !opts.leaveOut?.has(k)),
    (k) => k,
    opts.seed,
  );

  // Rooms without a capacity count as the size of the largest one that has one, so the split stays even.
  const set = rooms.map((r) => r.capacity).filter((c): c is number => c != null && c > 0);
  const capOf = (r: OralRoom) => (r.capacity != null && r.capacity > 0 ? r.capacity : set.length ? Math.max(...set) : 1);
  const count = new Map(rooms.map((r) => [r.id, lockedIn.filter((p) => p.roomId === r.id).length]));
  const chosen = new Map<string, string[]>(rooms.map((r) => [r.id, []]));
  for (const k of free) {
    if (!rooms.length) break;
    const pick = [...rooms].sort((a, b) => {
      const ca = count.get(a.id)!;
      const cb = count.get(b.id)!;
      const fullA = ca >= capOf(a) ? 1 : 0;
      const fullB = cb >= capOf(b) ? 1 : 0;
      return fullA - fullB || ca / capOf(a) - cb / capOf(b) || ca - cb || hash(`${opts.seed}:room:${k}:${a.id}`) - hash(`${opts.seed}:room:${k}:${b.id}`);
    })[0]!;
    chosen.get(pick.id)!.push(k);
    count.set(pick.id, count.get(pick.id)! + 1);
  }

  // Running order: locked people keep their place (or the nearest free one), the rest fill the gaps at random.
  const out = new Map<string, string[]>();
  for (const r of rooms) {
    const mine = lockedIn.filter((p) => p.roomId === r.id).sort((a, b) => a.position - b.position || a.key.localeCompare(b.key));
    const extra = shuffle(chosen.get(r.id)!, (k) => k, `${opts.seed}:order`);
    const n = mine.length + extra.length;
    const slots: (string | null)[] = new Array(n).fill(null);
    for (const p of mine) {
      const want = Math.min(Math.max(p.position, 1), n) - 1;
      let at = -1;
      for (let d = 0; d < n && at < 0; d++) {
        if (want + d < n && slots[want + d] === null) at = want + d;
        else if (want - d >= 0 && slots[want - d] === null) at = want - d;
      }
      slots[at] = p.key;
    }
    let i = 0;
    for (let s = 0; s < n; s++) if (slots[s] === null) slots[s] = extra[i++]!;
    out.set(r.id, slots as string[]);
  }

  const placed = new Set([...out.values()].flat());
  return {
    rooms: out,
    unplaced: everyone.filter((k) => !placed.has(k)),
    over: rooms.flatMap((r) => {
      const c = out.get(r.id)!.length;
      return r.capacity != null && c > r.capacity ? [{ roomId: r.id, count: c, capacity: r.capacity }] : [];
    }),
  };
}

/** The board as rows to save: one per person, numbered within each room. */
export function toPlacements(result: OralResult, lockedKeys: ReadonlySet<string>): OralPlacement[] {
  return [
    ...[...result.rooms].flatMap(([roomId, keys]) => keys.map((key, i) => ({ key, roomId, position: i + 1, locked: lockedKeys.has(key) }))),
    ...result.unplaced.map((key) => ({ key, roomId: null, position: 0, locked: lockedKeys.has(key) })),
  ];
}

/**
 * Moves one person to a room (or out of every room), at a place in the
 * running order (1 = first; past the end = last). The person is locked,
 * because they were placed by hand. Everyone else keeps their order.
 */
export function moveOral(board: readonly OralPlacement[], key: string, roomId: string | null, position = Infinity): OralPlacement[] {
  const me = board.find((p) => p.key === key) ?? { key, roomId: null, position: 0, locked: false };
  const rest = board.filter((p) => p.key !== key);
  const order = (id: string) => rest.filter((p) => p.roomId === id).sort((a, b) => a.position - b.position).map((p) => p.key);
  const rooms = [...new Set(rest.map((p) => p.roomId).filter((r): r is string => Boolean(r)).concat(roomId ? [roomId] : []))];
  const lists = new Map(rooms.map((id) => [id, order(id)]));
  if (roomId) {
    const list = lists.get(roomId)!;
    const at = Math.max(0, Math.min(list.length, Number.isFinite(position) ? position - 1 : list.length));
    list.splice(at, 0, key);
  }
  const lockOf = new Map(rest.map((p) => [p.key, p.locked]));
  lockOf.set(key, true);
  return [
    ...[...lists].flatMap(([id, keys]) => keys.map((k, i) => ({ key: k, roomId: id, position: i + 1, locked: lockOf.get(k)! }))),
    ...rest.filter((p) => !p.roomId).map((p) => ({ ...p, position: 0 })),
    ...(roomId ? [] : [{ ...me, roomId: null, position: 0, locked: true }]),
  ];
}

/** Locks or unlocks one person, leaving everything else as it is. */
export function lockOral(board: readonly OralPlacement[], key: string, locked: boolean): OralPlacement[] {
  const has = board.some((p) => p.key === key);
  return has ? board.map((p) => (p.key === key ? { ...p, locked } : p)) : [...board, { key, roomId: null, position: 0, locked }];
}
