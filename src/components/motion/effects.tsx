"use client";
import { m, useReducedMotion, useScroll, useSpring, useTransform } from "motion/react";
import { usePathname } from "next/navigation";
import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

const ease = [0.16, 1, 0.3, 1] as const;
const inView = { once: true, margin: "0px 0px -12% 0px" } as const;

/**
 * Text that rises out of a mask, like a line of type being set.
 * `onMount` plays straight away (for page titles); otherwise it plays when scrolled into view.
 */
export function MaskRise({ children, delay = 0, onMount = false, className }: { children: ReactNode; delay?: number; onMount?: boolean; className?: string }) {
  const reduce = useReducedMotion();
  // The wrapper is watched, not the text: the text starts clipped by the mask, so it never "enters" the view itself.
  return (
    <m.span
      className={cn("block overflow-hidden pb-[0.1em]", className)}
      initial="hidden"
      {...(onMount ? { animate: "show" } : { whileInView: "show", viewport: inView })}
    >
      <m.span
        className="block"
        variants={{
          hidden: reduce ? { opacity: 0 } : { y: "105%" },
          show: { y: 0, opacity: 1, transition: { duration: reduce ? 0.3 : 1, delay, ease } },
        }}
      >
        {children}
      </m.span>
    </m.span>
  );
}

/** A short rule that draws itself from the left, used beside eyebrows. */
export function LineDraw({ className, delay = 0, onMount = false }: { className?: string; delay?: number; onMount?: boolean }) {
  return (
    <m.span
      aria-hidden
      className={cn("block h-px origin-left", className)}
      initial={{ scaleX: 0 }}
      {...(onMount ? { animate: { scaleX: 1 } } : { whileInView: { scaleX: 1 }, viewport: inView })}
      transition={{ duration: 0.9, delay, ease }}
    />
  );
}

/** A thin bar under the header showing how far down the page you are. */
export function ScrollProgress() {
  const path = usePathname();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 220, damping: 40, restDelta: 0.001 });
  if (/^\/(admin|portal|map|login|signup|auth|review)/.test(path)) return null;
  return <m.div aria-hidden style={{ scaleX }} className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 origin-left bg-gradient-to-r from-electric via-cyan to-violet" />;
}

/** Moves its children gently against the scroll for depth. */
export function Parallax({ children, distance = 60, axis = "y", className }: { children: ReactNode; distance?: number; axis?: "x" | "y"; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const v = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [distance, -distance]);
  return (
    <m.div ref={ref} style={axis === "x" ? { x: v } : { y: v }} className={className}>
      {children}
    </m.div>
  );
}

/** A vertical rule that fills as its list scrolls past, like a progress line through the day. */
export function ScrollLine({ className }: { className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 80%", "end 60%"] });
  const scaleY = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });
  return (
    <span ref={ref} aria-hidden className={cn("absolute w-px", className)}>
      <span className="absolute inset-0 bg-navy/10" />
      <m.span style={{ scaleY: reduce ? 1 : scaleY }} className="absolute inset-0 origin-top bg-gradient-to-b from-electric via-cyan to-violet" />
    </span>
  );
}

/**
 * A heartbeat trace across the hero: digital health, drawn in a single line.
 * It draws once, then a soft pulse travels along it. Static when motion is reduced.
 */
export function PulseLine({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  const beat = "h96 l8 -7 l8 7 h18 l6 9 l9 -58 l10 70 l7 -21 h26 q14 -16 28 0 h84";
  const d = `M0 60 ${beat} ${beat} ${beat} ${beat}`;
  return (
    <svg aria-hidden viewBox="0 0 1200 120" preserveAspectRatio="none" fill="none" className={cn("pointer-events-none", className)}>
      <defs>
        <linearGradient id="pulse-fade" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#c9d8ec" stopOpacity="0" />
          <stop offset="0.2" stopColor="#c9d8ec" stopOpacity="0.35" />
          <stop offset="0.8" stopColor="#c9d8ec" stopOpacity="0.35" />
          <stop offset="1" stopColor="#c9d8ec" stopOpacity="0" />
        </linearGradient>
      </defs>
      <m.path
        d={d}
        stroke="url(#pulse-fade)"
        strokeWidth="1.25"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 2.4, delay: 0.6, ease: "easeInOut" }}
      />
      {!reduce && (
        <path
          d={d}
          pathLength={1}
          stroke="#e8f0fb"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="pulse-tracer"
        />
      )}
    </svg>
  );
}

/**
 * Gives every `.spotlight` card inside it a soft glow that follows the pointer.
 * One listener for the whole group; touch screens are left alone.
 */
export function SpotlightGroup({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={className}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return;
        const card = (e.target as HTMLElement).closest<HTMLElement>(".spotlight");
        if (!card) return;
        const r = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${e.clientX - r.left}px`);
        card.style.setProperty("--my", `${e.clientY - r.top}px`);
      }}
    >
      {children}
    </div>
  );
}
