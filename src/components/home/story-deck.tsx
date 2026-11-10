"use client";
import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { STORY } from "@/content/story";
import { STORY_STYLES, StoryCard } from "./story-card";
import { cn } from "@/lib/cn";

const SWIPE = 60;

/**
 * On phones the story is a stack of cards: the current chapter in front and
 * the next ones peeking out behind. Swipe, use the arrows, tap a dot, or use
 * the arrow keys. Cards behind are hidden from screen readers.
 */
export function StoryDeck() {
  const n = STORY.length;
  const [at, setAt] = useState(0);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; id: number; horizontal: boolean | null } | null>(null);
  const live = useRef<HTMLParagraphElement>(null);

  const go = (i: number) => {
    const next = (i + n) % n;
    setAt(next);
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
        e.currentTarget.setPointerCapture(e.pointerId);
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

  const arrow =
    "grid size-11 place-items-center rounded-full border border-navy/15 bg-white text-ink transition-colors hover:border-navy/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric-600";

  return (
    <div role="region" aria-roledescription="carousel" aria-label="Our story" onKeyDown={onKey}>
      <div
        className="relative grid touch-pan-y select-none pb-6 pr-3"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        {STORY.map((ch, i) => {
          const depth = (i - at + n) % n; // 0 = front
          const front = depth === 0;
          const tilt = front ? dx / 18 : 0;
          return (
            <div
              key={ch.label}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${n}: ${ch.label}`}
              aria-hidden={!front}
              inert={!front}
              className={cn(
                "col-start-1 row-start-1 will-change-transform motion-reduce:transition-none",
                !dragging && "transition-[transform,opacity] duration-500 ease-[var(--ease-out-expo)]",
                front ? "cursor-grab active:cursor-grabbing" : "pointer-events-none",
              )}
              style={{
                zIndex: n - depth,
                transform: front
                  ? `translateX(${dx}px) rotate(${tilt}deg)`
                  : `translate(${depth * 10}px, ${depth * 12}px) scale(${1 - depth * 0.05})`,
                transformOrigin: "50% 100%",
                opacity: depth > 2 ? 0 : 1,
              }}
            >
              <StoryCard index={i} label={ch.label} text={ch.text} className={cn(!front && "brightness-[0.97]")} />
            </div>
          );
        })}
      </div>

      <div className="mt-1 flex items-center justify-between gap-3">
        <button type="button" onClick={() => go(at - 1)} className={arrow} aria-label="Previous chapter">
          <ChevronLeft aria-hidden className="size-5" />
        </button>
        <div className="flex items-center gap-1">
          {STORY.map((ch, i) => (
            <button
              key={ch.label}
              type="button"
              onClick={() => go(i)}
              aria-label={`Chapter ${i + 1}: ${ch.label}`}
              aria-current={i === at ? "true" : undefined}
              className="grid size-11 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric-600"
            >
              <span
                aria-hidden
                className={cn(
                  "block h-2.5 rounded-full transition-all duration-300 motion-reduce:transition-none",
                  i === at ? cn("w-7", STORY_STYLES[i % STORY_STYLES.length].dot) : "w-2.5 bg-navy/20",
                )}
              />
            </button>
          ))}
        </div>
        <button type="button" onClick={() => go(at + 1)} className={arrow} aria-label="Next chapter">
          <ChevronRight aria-hidden className="size-5" />
        </button>
      </div>
      <p ref={live} aria-live="polite" className="sr-only">
        Chapter {at + 1} of {n}: {STORY[at].label}
      </p>
    </div>
  );
}
