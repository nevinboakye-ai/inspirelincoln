"use client";
import { useActionState, useMemo, useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, GripVertical, Loader2, Lock, LockOpen, Shuffle, TriangleAlert, UserX } from "lucide-react";
import { runOralAllocation, saveOralBoard, saveOralRooms, saveOralSettings, type OralResult } from "@/app/admin/orals/actions";
import { btn } from "@/components/admin/ui";
import { inputClass } from "@/components/forms/field";
import { cn } from "@/lib/cn";
import { lockOral, moveOral, type OralPlacement } from "@/lib/orals/allocate";

export type BoardRoom = { id: string; name: string; building: string | null; time: string | null; capacity: number | null; seats?: number | null };
export type BoardPerson = {
  key: string;
  name: string;
  institution: string | null;
  title: string | null;
  hasAccount: boolean;
  attendance: "confirmed" | "unavailable" | null;
};

/** A colour for each room, so the two are easy to tell apart. White text on each passes WCAG AA. */
const ROOM_COLOURS = [
  { solid: "#2F5FD0", tint: "#EEF3FD" },
  { solid: "#0B7A93", tint: "#E9F5F8" },
  { solid: "#7048C8", tint: "#F3EFFC" },
  { solid: "#A35512", tint: "#FBF2E9" },
];
export const roomColour = (i: number) => ROOM_COLOURS[i % ROOM_COLOURS.length]!;
const NONE = "none";

function Result({ r }: { r: OralResult }) {
  if (!r) return null;
  return (
    <p role={r.ok ? "status" : "alert"} className={cn("text-sm font-medium", r.ok ? "text-success" : "text-danger")}>
      {r.ok ? r.message : r.error}
    </p>
  );
}

/** How many talks each room takes. */
export function OralRoomsForm({ rooms, withSeats = false }: { rooms: BoardRoom[]; withSeats?: boolean }) {
  const [r, action, pending] = useActionState(saveOralRooms, null);
  return (
    <form action={action} className="space-y-4">
      <ul className="grid gap-3">
        {rooms.map((room, i) => (
          <li key={room.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-navy/10 p-3">
            <input type="hidden" name="id" value={room.id} />
            <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ background: roomColour(i).solid }} />
            <span className="min-w-0 flex-1 basis-40">
              <span className="block font-semibold text-ink">{room.name}</span>
              <span className="block text-xs text-slate-700">{[room.building, room.time].filter(Boolean).join(" · ")}</span>
            </span>
            <label className="flex shrink-0 items-center gap-2 text-sm">
              <span className="text-slate-700">Talks</span>
              <input
                name={`capacity_${room.id}`}
                aria-label={`Number of talks in ${room.name}`}
                type="number"
                min={1}
                max={50}
                inputMode="numeric"
                placeholder="Any"
                defaultValue={room.capacity ?? ""}
                className={cn(inputClass.replace("w-full", "w-20"), "px-3 py-2")}
              />
            </label>
            {withSeats && (
              <label className="flex shrink-0 items-center gap-2 text-sm">
                <span className="text-slate-700">Seats</span>
                <input
                  name={`seats_${room.id}`}
                  aria-label={`Audience seats in ${room.name}`}
                  type="number"
                  min={1}
                  max={2000}
                  inputMode="numeric"
                  placeholder="Any"
                  defaultValue={room.seats ?? ""}
                  className={cn(inputClass.replace("w-full", "w-24"), "px-3 py-2")}
                />
              </label>
            )}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <button className={btn.secondary} disabled={pending}>
          {pending && <Loader2 aria-hidden className="size-4 animate-spin" />} {withSeats ? "Save talks and seats" : "Save numbers of talks"}
        </button>
        <Result r={r} />
      </div>
    </form>
  );
}

/** Show or hide each presenter's room. */
export function OralPublishForm({ published, hasPlaces }: { published: boolean; hasPlaces: boolean }) {
  const [r, action, pending] = useActionState(saveOralSettings, null);
  return (
    <form action={action} className="space-y-4">
      <label className="flex items-start gap-3">
        <input type="checkbox" name="publish" defaultChecked={published} disabled={!hasPlaces && !published} className="mt-1 size-5 shrink-0 accent-navy disabled:opacity-50" />
        <span>
          <span className="block font-semibold text-ink">Show presenters their room</span>
          <span className="block text-sm text-slate-700">
            {hasPlaces
              ? "Each oral presenter sees their room, building, time and talk number in My Hub and in their day, and the “where to go next” alert sends them to the right room. Judges see the room and talk number beside each talk. Any change you make afterwards shows straight away."
              : "Available once presenters are in rooms."}
          </span>
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button className={btn.primary} disabled={pending}>
          {pending && <Loader2 aria-hidden className="size-4 animate-spin" />} Save
        </button>
        <Result r={r} />
      </div>
    </form>
  );
}

type Target = { roomId: string | null; index: number };

/**
 * The two rooms side by side, and everyone not in a room yet. Move people
 * with the menu on each card, the arrows, or by dragging the handle (mouse
 * or touch). Anything moved by hand is locked, so allocating at random again
 * keeps it.
 */
export function OralBoardEditor({
  rooms,
  people,
  board: initialBoard,
  version: initialVersion,
  unavailable,
}: {
  rooms: BoardRoom[];
  people: BoardPerson[];
  board: OralPlacement[];
  version: number;
  unavailable: number;
}) {
  const [board, setBoard] = useState(initialBoard);
  const [version, setVersion] = useState(initialVersion);
  const [msg, setMsg] = useState<OralResult>(null);
  const [saving, start] = useTransition();
  const [runResult, runAction, running] = useActionState(runOralAllocation, null);
  const [drag, setDrag] = useState<{ key: string; target: Target | null } | null>(null);
  const [announce, setAnnounce] = useState("");
  const cols = useRef(new Map<string, HTMLElement>());
  const cards = useRef(new Map<string, HTMLElement>());

  // A newer board from the server (a random run, or someone else's change): show it.
  const [seenVersion, setSeenVersion] = useState(initialVersion);
  if (initialVersion !== seenVersion) {
    setSeenVersion(initialVersion);
    if (initialVersion !== version) {
      setBoard(initialBoard);
      setVersion(initialVersion);
    }
  }
  const [seenRun, setSeenRun] = useState(runResult);
  if (runResult !== seenRun) {
    setSeenRun(runResult);
    if (runResult?.ok && runResult.board && runResult.version != null) {
      setBoard(runResult.board);
      setVersion(runResult.version);
    }
  }

  const byKey = useMemo(() => new Map(people.map((p) => [p.key, p])), [people]);
  const roomIds = useMemo(() => new Set(rooms.map((r) => r.id)), [rooms]);
  const where = useMemo(() => new Map(board.map((p) => [p.key, p])), [board]);
  const inRoom = (id: string) =>
    board
      .filter((p) => p.roomId === id && byKey.has(p.key))
      .sort((a, b) => a.position - b.position)
      .map((p) => p.key);
  // Not in a room: everyone presenting who isn't in one, in name order.
  const tray = people.filter((p) => !where.get(p.key)?.roomId || !roomIds.has(where.get(p.key)!.roomId!)).map((p) => p.key);
  const placedCount = people.length - tray.length;
  const lockedCount = board.filter((p) => p.locked && byKey.has(p.key)).length;
  const unlockedPlaced = board.some((p) => !p.locked && p.roomId && byKey.has(p.key));
  const busy = saving || running;
  const roomName = (id: string | null) => (id ? (rooms.find((r) => r.id === id)?.name ?? "a room") : "Not in a room");

  const save = (next: OralPlacement[], said: string) => {
    const prev = board;
    setBoard(next);
    setAnnounce(said);
    setMsg(null);
    start(async () => {
      const res = await saveOralBoard(version, next);
      if (res?.ok && res.version != null) {
        setVersion(res.version);
        setMsg({ ok: true, message: said });
      } else {
        setBoard(prev);
        setMsg(res ?? { ok: false, error: "We couldn't save that. Please try again." });
      }
    });
  };
  const move = (key: string, roomId: string | null, position?: number) => {
    const name = byKey.get(key)?.name ?? "They";
    const next = moveOral(board, key, roomId, position);
    const pos = next.find((p) => p.key === key)?.position;
    save(next, roomId ? `${name} moved to ${roomName(roomId)}, talk ${pos}, and locked.` : `${name} taken out of the rooms, and locked out of the random allocation.`);
  };
  const toggleLock = (key: string) => {
    const now = !where.get(key)?.locked;
    save(lockOral(board, key, now), `${byKey.get(key)?.name} ${now ? "locked" : "unlocked"}.`);
  };
  const unlockAll = () => save(board.map((p) => ({ ...p, locked: false })), "Everyone unlocked. Allocating at random now reshuffles everyone.");
  const emptyRooms = () => {
    if (!confirm("Take everyone out of both rooms and unlock them?")) return;
    save(board.map((p) => ({ ...p, roomId: null, position: 0, locked: false })), "Both rooms emptied.");
  };

  // Dragging by the handle, with a mouse or a finger.
  const targetAt = (x: number, y: number, key: string): Target | null => {
    let best: { id: string; d: number } | null = null;
    for (const [id, el] of cols.current) {
      const r = el.getBoundingClientRect();
      const dx = x < r.left ? r.left - x : x > r.right ? x - r.right : 0;
      const dy = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
      const d = Math.hypot(dx, dy);
      if (!best || d < best.d) best = { id, d };
    }
    if (!best || best.d > 60) return null;
    const roomId = best.id === NONE ? null : best.id;
    if (!roomId) return { roomId: null, index: 0 };
    const others = inRoom(roomId).filter((k) => k !== key);
    let index = others.length;
    for (let i = 0; i < others.length; i++) {
      const r = cards.current.get(others[i]!)?.getBoundingClientRect();
      if (r && y < r.top + r.height / 2) {
        index = i;
        break;
      }
    }
    return { roomId, index };
  };
  const onGrab = (key: string) => (e: React.PointerEvent) => {
    if (busy) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ key, target: null });
  };
  const onDragMove = (e: React.PointerEvent) => {
    if (!drag) return;
    // Scroll the page when dragging near the top or bottom of the screen.
    if (e.clientY < 70) window.scrollBy(0, -14);
    else if (e.clientY > window.innerHeight - 70) window.scrollBy(0, 14);
    const t = targetAt(e.clientX, e.clientY, drag.key);
    if (t?.roomId !== drag.target?.roomId || t?.index !== drag.target?.index) setDrag({ key: drag.key, target: t });
  };
  const onDrop = () => {
    if (!drag) return;
    const { key, target } = drag;
    setDrag(null);
    if (!target) return;
    const cur = where.get(key);
    const curRoom = cur?.roomId && roomIds.has(cur.roomId) ? cur.roomId : null;
    if (!target.roomId) {
      if (curRoom) move(key, null);
      return;
    }
    // Same place as before: nothing to do.
    if (curRoom === target.roomId && inRoom(curRoom).indexOf(key) === target.index) return;
    move(key, target.roomId, target.index + 1);
  };

  const card = (key: string, roomId: string | null, index: number, total: number, colour: { solid: string; tint: string } | null) => {
    const p = byKey.get(key)!;
    const at = where.get(key);
    const locked = Boolean(at?.locked);
    const dragged = drag?.key === key;
    const lineBefore = drag && !dragged && drag.target?.roomId === roomId && roomId && inRoom(roomId).filter((k) => k !== drag.key).indexOf(key) === drag.target.index;
    return (
      <li
        key={key}
        ref={(el) => {
          if (el) cards.current.set(key, el);
          else cards.current.delete(key);
        }}
        className="relative"
      >
        {lineBefore && <span aria-hidden className="absolute -top-1.5 left-2 right-2 h-1 rounded-full bg-electric-600" />}
        <div
          className={cn(
            "flex gap-2 rounded-xl border bg-white p-2.5 pr-3 transition-[opacity,box-shadow]",
            dragged ? "border-electric-600 opacity-50 shadow-lg" : "border-navy/10",
            p.attendance === "unavailable" && "border-warning/50",
          )}
        >
          <button
            type="button"
            onPointerDown={onGrab(key)}
            aria-label={`Drag ${p.name}`}
            tabIndex={-1}
            title="Drag to another room or place"
            className="-my-1 grid w-7 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-slate hover:bg-paper-200 hover:text-ink active:cursor-grabbing"
          >
            <GripVertical aria-hidden className="size-4" />
          </button>
          {colour && (
            <span aria-hidden className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full font-ui text-sm font-bold text-white" style={{ background: colour.solid }}>
              {index + 1}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-semibold leading-snug text-ink">{p.name}</span>
              {roomId && <span className="sr-only">, talk {index + 1} of {total}</span>}
              {locked && (
                <span className="inline-flex items-center gap-1 rounded-full bg-navy/[0.07] px-2 py-0.5 text-[0.7rem] font-semibold text-navy">
                  <Lock aria-hidden className="size-3" /> Locked
                </span>
              )}
              {p.attendance === "unavailable" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-[0.7rem] font-semibold text-[#7a4a00]">
                  <TriangleAlert aria-hidden className="size-3" /> Can&apos;t attend
                </span>
              )}
              {p.attendance === null && p.hasAccount && <span className="rounded-full bg-paper-200 px-2 py-0.5 text-[0.7rem] font-medium text-slate-700">Not confirmed yet</span>}
              {!p.hasAccount && <span className="rounded-full bg-paper-200 px-2 py-0.5 text-[0.7rem] font-medium text-slate-700">No account yet</span>}
            </p>
            {(p.title || p.institution) && (
              <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-slate-700">{[p.institution, p.title].filter(Boolean).join(" · ")}</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <label className="min-w-0 flex-1 basis-40">
                <span className="sr-only">Room for {p.name}</span>
                <select
                  value={roomId ?? NONE}
                  disabled={busy}
                  onChange={(e) => move(key, e.target.value === NONE ? null : e.target.value)}
                  className={cn(inputClass, "min-h-10 px-2.5 py-1.5 text-sm")}
                >
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.id === roomId ? r.name : `Move to ${r.name}`}
                    </option>
                  ))}
                  <option value={NONE}>{roomId ? "Take out of the rooms" : "Not in a room"}</option>
                </select>
              </label>
              {roomId && (
                <>
                  <button
                    type="button"
                    disabled={busy || index === 0}
                    onClick={() => move(key, roomId, index)}
                    aria-label={`Move ${p.name} earlier`}
                    className="grid size-10 place-items-center rounded-lg border border-navy/15 text-ink hover:border-navy/40 disabled:opacity-35"
                  >
                    <ArrowUp aria-hidden className="size-4" />
                  </button>
                  <button
                    type="button"
                    disabled={busy || index === total - 1}
                    onClick={() => move(key, roomId, index + 2)}
                    aria-label={`Move ${p.name} later`}
                    className="grid size-10 place-items-center rounded-lg border border-navy/15 text-ink hover:border-navy/40 disabled:opacity-35"
                  >
                    <ArrowDown aria-hidden className="size-4" />
                  </button>
                </>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => toggleLock(key)}
                aria-pressed={locked}
                aria-label={locked ? `Unlock ${p.name}` : `Lock ${p.name} where they are`}
                title={locked ? "Locked: allocating at random keeps them here. Tap to unlock." : "Lock here, so allocating at random keeps them"}
                className={cn(
                  "grid size-10 place-items-center rounded-lg border disabled:opacity-35",
                  locked ? "border-navy bg-navy text-paper" : "border-navy/15 text-slate hover:border-navy/40 hover:text-ink",
                )}
              >
                {locked ? <Lock aria-hidden className="size-4" /> : <LockOpen aria-hidden className="size-4" />}
              </button>
            </div>
          </div>
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-5" onPointerMove={onDragMove} onPointerUp={onDrop} onPointerCancel={() => setDrag(null)}>
      <p aria-live="polite" className="sr-only">
        {announce}
      </p>

      <form
        action={runAction}
        onSubmit={(e) => {
          if (unlockedPlaced && !confirm("This reshuffles everyone who isn't locked. Locked people keep their room and place. Allocate at random?")) e.preventDefault();
        }}
        className="flex flex-col gap-3 rounded-xl border border-navy/10 bg-paper/50 p-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <input type="hidden" name="version" value={version} />
        <div className="min-w-0 space-y-2">
          <p className="text-sm text-slate-700">
            Shares everyone who isn&apos;t locked between the rooms at random, filling each room up to its number of talks, in a random running order.
            {lockedCount > 0 && <strong className="font-semibold text-ink"> {lockedCount} locked {lockedCount === 1 ? "pick stays" : "picks stay"} where you put {lockedCount === 1 ? "it" : "them"}.</strong>}
          </p>
          {unavailable > 0 && (
            <label className="flex items-start gap-2.5 text-sm">
              <input type="checkbox" name="leave_out_unavailable" defaultChecked className="mt-0.5 size-5 shrink-0 accent-navy" />
              <span className="text-ink">
                Leave out the {unavailable === 1 ? "presenter who has" : `${unavailable} presenters who have`} said they can&apos;t attend
              </span>
            </label>
          )}
        </div>
        <button className={cn(btn.primary, "shrink-0")} disabled={busy || rooms.length < 2 || people.length === 0}>
          {running ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Shuffle aria-hidden className="size-4" />}
          {placedCount ? "Allocate at random again" : "Allocate at random"}
        </button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-700">
          <strong className="font-semibold text-ink">{placedCount}</strong> of {people.length} in a room
          {lockedCount > 0 && <> · {lockedCount} locked</>}
          {saving && (
            <span className="ml-2 inline-flex items-center gap-1 text-slate-700">
              <Loader2 aria-hidden className="size-3.5 animate-spin" /> Saving
            </span>
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          {lockedCount > 0 && (
            <button type="button" onClick={unlockAll} disabled={busy} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-electric-600 hover:bg-paper-200 disabled:opacity-50">
              <LockOpen aria-hidden className="size-4" /> Unlock everyone
            </button>
          )}
          {placedCount > 0 && (
            <button type="button" onClick={emptyRooms} disabled={busy} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-danger hover:bg-danger/[0.05] disabled:opacity-50">
              <UserX aria-hidden className="size-4" /> Empty both rooms
            </button>
          )}
        </div>
      </div>
      <Result r={msg ?? runResult} />

      <div className={cn("grid gap-4 lg:grid-cols-2", drag && "select-none")}>
        {rooms.map((room, i) => {
          const keys = inRoom(room.id);
          const colour = roomColour(i);
          const over = room.capacity != null && keys.length > room.capacity;
          const short = room.capacity != null && keys.length < room.capacity;
          const target = drag?.target?.roomId === room.id;
          return (
            <section
              key={room.id}
              ref={(el) => {
                if (el) cols.current.set(room.id, el);
                else cols.current.delete(room.id);
              }}
              aria-label={`${room.name}, ${keys.length} ${keys.length === 1 ? "talk" : "talks"}`}
              className={cn("rounded-2xl border-2 p-3 transition-colors sm:p-4", target ? "border-electric-600" : "border-transparent")}
              style={{ background: colour.tint }}
            >
              <header className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
                    <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ background: colour.solid }} />
                    {room.name}
                  </h3>
                  <p className="text-xs text-slate-700">{[room.building, room.time].filter(Boolean).join(" · ")}</p>
                </div>
                <p className={cn("shrink-0 rounded-full px-2.5 py-1 text-sm font-semibold tabular-nums", over ? "bg-danger text-white" : "bg-white text-ink")}>
                  {keys.length}
                  {room.capacity != null && <span className={over ? "" : "text-slate-700"}> / {room.capacity}</span>}
                  <span className="sr-only"> talks{over ? ", over the number of talks this room takes" : ""}</span>
                </p>
              </header>
              {over && (
                <p className="mb-3 rounded-lg bg-white/80 px-3 py-2 text-sm text-danger">
                  {keys.length - room.capacity!} more than the {room.capacity} talks this room takes. Move someone to the other room, or change the number of talks below.
                </p>
              )}
              {keys.length ? (
                <ol className="space-y-2.5">
                  {keys.map((k, n) => card(k, room.id, n, keys.length, colour))}
                  {target && drag && drag.target!.index >= keys.filter((k) => k !== drag.key).length && <li aria-hidden className="h-1 rounded-full bg-electric-600" />}
                </ol>
              ) : (
                <p className="rounded-xl border-2 border-dashed border-navy/15 bg-white/60 p-6 text-center text-sm text-slate-700">
                  No one here yet. Allocate at random, or choose this room on someone&apos;s card.
                </p>
              )}
              {short && keys.length > 0 && (
                <p className="mt-3 text-xs text-slate-700">
                  {room.capacity! - keys.length} {room.capacity! - keys.length === 1 ? "slot" : "slots"} free.
                </p>
              )}
            </section>
          );
        })}
      </div>

      <section
        ref={(el) => {
          if (el) cols.current.set(NONE, el);
          else cols.current.delete(NONE);
        }}
        aria-label="Not in a room"
        className={cn("rounded-2xl border-2 border-dashed p-3 sm:p-4", drag?.target && !drag.target.roomId ? "border-electric-600 bg-electric/[0.04]" : "border-navy/15")}
      >
        <h3 className="font-display text-lg font-semibold text-ink">
          Not in a room <span className="font-ui text-sm font-semibold text-slate-700">({tray.length})</span>
        </h3>
        <p className="mb-3 text-sm text-slate-700">
          {tray.length
            ? "Allocating at random places these people, except anyone locked out (locked here) or left out because they can't attend."
            : "Every oral presenter is in a room."}
        </p>
        {tray.length > 0 && <ul className="grid gap-2.5 lg:grid-cols-2">{tray.map((k) => card(k, null, 0, 0, null))}</ul>}
      </section>
    </div>
  );
}
