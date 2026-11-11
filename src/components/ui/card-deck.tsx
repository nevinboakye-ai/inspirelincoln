"use client";
import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

const SWIPE = 60;

export type DeckCard = {
  key: string;
  /** Read out with the card's position, and used for its dot. */
  label: string;
  /** Colour of the active dot, as a Tailwind background class. */
  dot: string;
  card: ReactNode;
};

/**
 * A stack of cards: the current one in front and the next ones peeking out
 * behind. Swipe or drag it sideways, use the arrows, tap a dot, or use the
 * arrow keys. Cards behind are hidden from screen readers and can't be
 * focused, and a polite announcement says which card is showing.
 */
export function CardDeck({ cards, label, noun = "card", tone = "light", className }: { cards: DeckCard[]; label: string; noun?: string; tone?: "light" | "dark"; className?: string }) {
  const n = cards.length;
  const [at, setAt] = useState(0);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; id: number; horizontal: boolean | null } | null>(null);

  const go = (i: number) => {
    setAt((i + n) % n);
    setDx(0);
  };

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId, horizontal: null };
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    const mx = e.clientX - s.x;
    const my = e.clientY - s.y;
    // Decide once whether this is a sideways swipe or the page scrolling.
    if (s.horizontal === null && (Math.abs(mx) > 8 || Math.abs(my) > 8)) {
      s.horizontal = Math.abs(mx) > Math.abs(my);
      if (s.horizontal) {
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {}
        setDragging(true);
      }
    }
    if (s.horizontal) setDx(mx);
  };
  const onUp = () => {
    const s = start.current;
    start.current = null;
    if (!s?.horizontal) return;
    setDragging(false);
    if (dx <= -SWIPE) go(at + 1);
    else if (dx >= SWIPE) go(at - 1);
    else setDx(0);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      go(at + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(at - 1);
    }
  };

  const dark = tone === "dark";
  const ring = dark ? "focus-visible:outline-gold" : "focus-visible:outline-electric-600";
  const arrow = cn(
    "grid size-11 place-items-center rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
    dark ? "border-white/25 bg-white/5 text-paper hover:border-white/60 hover:bg-white/10" : "border-navy/15 bg-white text-ink hover:border-navy/40",
    ring,
  );
  const Noun = noun.charAt(0).toUpperCase() + noun.slice(1);

  return (
    <div role="region" aria-roledescription="carousel" aria-label={label} onKeyDown={onKey} className={className}>
      <div className="relative grid touch-pan-y select-none pb-6 pr-3" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        {cards.map((c, i) => {
          const depth = (i - at + n) % n; // 0 = front
          const front = depth === 0;
          const tilt = front ? dx / 18 : 0;
          return (
            <div
              key={c.key}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${n}: ${c.label}`}
              aria-hidden={!front}
              inert={!front}
              className={cn(
                "col-start-1 row-start-1 will-change-transform motion-reduce:transition-none",
                !dragging && "transition-[transform,opacity] duration-500 ease-[var(--ease-out-expo)]",
                front ? "cursor-grab active:cursor-grabbing" : "pointer-events-none",
              )}
              style={{
                zIndex: n - depth,
                transform: front ? `translateX(${dx}px) rotate(${tilt}deg)` : `translate(${depth * 10}px, ${depth * 12}px) scale(${1 - depth * 0.05})`,
                transformOrigin: "50% 100%",
                opacity: depth > 2 ? 0 : 1,
              }}
            >
              <div className={cn("h-full", !front && "brightness-[0.97]")}>{c.card}</div>
            </div>
          );
        })}
      </div>

      <div className="mt-1 flex items-center justify-between gap-3">
        <button type="button" onClick={() => go(at - 1)} className={arrow} aria-label={`Previous ${noun}`}>
          <ChevronLeft aria-hidden className="size-5" />
        </button>
        <div className={cn("flex items-center", n > 4 ? "gap-0" : "gap-1")}>
          {cards.map((c, i) => (
            <button
              key={c.key}
              type="button"
              onClick={() => go(i)}
              aria-label={`${Noun} ${i + 1}: ${c.label}`}
              aria-current={i === at ? "true" : undefined}
              // With many cards the dots get smaller targets (still above the 24px minimum) so they fit on a phone.
              className={cn("grid place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2", n > 4 ? "size-8" : "size-11", ring)}
            >
              <span
                aria-hidden
                className={cn(
                  "block h-2.5 rounded-full transition-all duration-300 motion-reduce:transition-none",
                  i === at ? cn(n > 4 ? "w-5" : "w-7", c.dot) : cn("w-2.5", dark ? "bg-white/30" : "bg-navy/20"),
                )}
              />
            </button>
          ))}
        </div>
        <button type="button" onClick={() => go(at + 1)} className={arrow} aria-label={`Next ${noun}`}>
          <ChevronRight aria-hidden className="size-5" />
        </button>
      </div>
      <p aria-live="polite" className="sr-only">
        {Noun} {at + 1} of {n}: {cards[at].label}
      </p>
    </div>
  );
}
