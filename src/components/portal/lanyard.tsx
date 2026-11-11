"use client";
import { m, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { RotateCw } from "lucide-react";
import { useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { CardCountdown } from "./hub-motion";

export type LanyardTone = "delegate" | "poster" | "oral" | "committee";

const BAND: Record<LanyardTone, string> = {
  delegate: "bg-navy text-paper",
  poster: "bg-gold text-midnight",
  oral: "bg-cyan text-midnight",
  committee: "bg-midnight text-gold-300",
};

export interface LanyardProps {
  year: number;
  theme: string;
  name: string;
  detail: string | null;
  /** Every role they hold, most senior first. Each gets its own coloured band. */
  roles: { label: string; tone: LanyardTone }[];
  dateLabel: string;
  venue: string;
  /** Check-in QR code as an SVG string, once the place is confirmed. */
  qr: string | null;
  reference: string | null;
  checkedIn: boolean;
  /** The conference start, for the countdown printed on the card. */
  countdown?: { date: string; time: string | null };
  /** Shown to the site owner while the card is still switched off for everyone else. */
  previewNote?: string | null;
}

/**
 * The delegate card as an INSPIRE lanyard. It drops in on its strap, sways
 * gently, tilts with the pointer, and flips over to show the check-in code.
 * With reduced motion it simply appears and flips without movement.
 */
export function Lanyard(p: LanyardProps) {
  const reduce = useReducedMotion();
  const [flipped, setFlipped] = useState(false);
  const scene = useRef<HTMLDivElement>(null);
  const id = useId();
  const strapId = `strap-${id.replace(/:/g, "")}`;

  // Pointer tilt and the light that moves across the card.
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const rx = useSpring(useTransform(py, [0, 1], [7, -7]), { stiffness: 140, damping: 18 });
  const ry = useSpring(useTransform(px, [0, 1], [-9, 9]), { stiffness: 140, damping: 18 });
  const lx = useTransform(px, (v) => `${v * 100}%`);
  const ly = useTransform(py, (v) => `${v * 100}%`);
  const sheen = useMotionTemplate`radial-gradient(420px circle at ${lx} ${ly}, rgba(255,255,255,0.55), rgba(255,255,255,0) 45%)`;

  const move = (e: React.PointerEvent) => {
    if (reduce || e.pointerType === "touch" || !scene.current) return;
    const r = scene.current.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width);
    py.set((e.clientY - r.top) / r.height);
  };
  const leave = () => {
    px.set(0.5);
    py.set(0.5);
  };

  const long = p.name.length > 22;

  return (
    <div className="flex flex-col items-center">
      <div ref={scene} onPointerMove={move} onPointerLeave={leave} className="relative w-[18.5rem] [perspective:1400px] sm:w-[19.5rem]">
        {/* The strap, clip and card hang together and sway from the top. */}
        <m.div
          className="origin-top"
          initial={reduce ? false : { y: -90, rotate: -7, opacity: 0 }}
          animate={reduce ? { opacity: 1 } : { y: 0, rotate: [-7, 4, -2.2, 1.2, -0.6, 0], opacity: 1 }}
          transition={reduce ? { duration: 0.3 } : { y: { type: "spring", stiffness: 70, damping: 11 }, rotate: { duration: 2.4, ease: "easeOut" }, opacity: { duration: 0.4 } }}
        >
          <m.div
            className="origin-top"
            animate={reduce ? undefined : { rotate: [0, 0.9, 0, -0.9, 0] }}
            transition={reduce ? undefined : { duration: 7, repeat: Infinity, ease: "easeInOut", delay: 2.4 }}
          >
            {/* A short neck that fades in from above, so it never runs up into the page header. */}
            <svg aria-hidden viewBox="0 50 300 120" className="-mb-3 block w-full overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_45%)]">
              <defs>
                <linearGradient id={`${strapId}-r`} x1="0" x2="1">
                  <stop offset="0" stopColor="#14284a" />
                  <stop offset="0.5" stopColor="#1f3a64" />
                  <stop offset="1" stopColor="#14284a" />
                </linearGradient>
                <linearGradient id={`${strapId}-m`} x1="0" x2="1">
                  <stop offset="0" stopColor="#8d96a3" />
                  <stop offset="0.45" stopColor="#f1f3f6" />
                  <stop offset="1" stopColor="#7d8794" />
                </linearGradient>
                <path id={`${strapId}-a`} d="M96 -40 L141 128" />
                <path id={`${strapId}-b`} d="M204 -40 L159 128" />
              </defs>
              <path d="M80 -40 L112 -40 L150 128 L132 128 Z" fill={`url(#${strapId}-r)`} />
              <path d="M188 -40 L220 -40 L168 128 L150 128 Z" fill={`url(#${strapId}-r)`} />
              <path d="M80 -40 L132 128 M112 -40 L150 128 M188 -40 L150 128 M220 -40 L168 128" stroke="#d4af5a" strokeOpacity="0.55" strokeWidth="1" />
              {[`${strapId}-a`, `${strapId}-b`].map((ref) => (
                <text key={ref} fill="#e6c97f" fontSize="8.5" fontWeight="700" letterSpacing="2.4" dy="3" className="font-ui">
                  <textPath href={`#${ref}`} startOffset="0">
                    {!reduce && <animate attributeName="startOffset" from="-60" to="0" dur="9s" repeatCount="indefinite" />}
                    INSPIRE {p.year} · INSPIRE {p.year} · INSPIRE {p.year} ·
                  </textPath>
                </text>
              ))}
              {/* Clip */}
              <rect x="134" y="120" width="32" height="18" rx="5" fill={`url(#${strapId}-m)`} stroke="#6b7480" strokeWidth="0.8" />
              <circle cx="150" cy="148" r="9" fill="none" stroke={`url(#${strapId}-m)`} strokeWidth="4" />
              <rect x="144" y="152" width="12" height="18" rx="2.5" fill={`url(#${strapId}-m)`} stroke="#6b7480" strokeWidth="0.8" />
            </svg>

            <m.div style={reduce ? undefined : { rotateX: rx, rotateY: ry }} className="relative [transform-style:preserve-3d]">
              <m.div
                animate={{ rotateY: flipped ? 180 : 0 }}
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 90, damping: 15 }}
                className="relative aspect-[5/7.6] w-full [transform-style:preserve-3d]"
              >
                <Front {...p} long={long} hidden={flipped} sheen={reduce ? null : sheen} />
                <Back {...p} hidden={!flipped} />
              </m.div>
            </m.div>
          </m.div>
        </m.div>
      </div>

      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        aria-pressed={flipped}
        className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full border border-navy/15 bg-white px-5 font-ui text-sm font-semibold text-ink shadow-sm transition-colors hover:border-navy/35"
      >
        <RotateCw aria-hidden className={cn("size-4 transition-transform duration-500", flipped && "rotate-180")} />
        {flipped ? "Show the front" : p.qr ? "Show my check-in code" : "Turn the card over"}
      </button>
      {p.previewNote && <p className="mt-3 max-w-xs text-center text-xs text-slate">{p.previewNote}</p>}
    </div>
  );
}

function Face({ hidden, back, children, className }: { hidden: boolean; back?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div
      aria-hidden={hidden}
      inert={hidden}
      className={cn(
        "absolute inset-0 overflow-hidden rounded-[20px] shadow-[0_30px_60px_-28px_rgba(12,24,44,0.75),0_8px_18px_-10px_rgba(12,24,44,0.35)] [backface-visibility:hidden]",
        back && "[transform:rotateY(180deg)]",
        className,
      )}
    >
      {children}
      {/* Punched slot for the clip */}
      <span aria-hidden className="absolute left-1/2 top-3 h-3 w-16 -translate-x-1/2 rounded-full bg-black/25 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]" />
    </div>
  );
}

function Front({ year, name, detail, roles, dateLabel, venue, countdown, long, hidden, sheen }: LanyardProps & { long: boolean; hidden: boolean; sheen: ReturnType<typeof useMotionTemplate> | null }) {
  return (
    <Face hidden={hidden} className="bg-ivory text-ink ring-1 ring-black/5">
      <div className="relative bg-midnight px-6 pb-5 pt-10 text-paper">
        <div aria-hidden className="lanyard-grid pointer-events-none absolute inset-0 opacity-[0.18]" />
        <div className="relative flex items-center gap-3">
          <img src="/brand/crest-white.png" alt="" aria-hidden className="h-11 w-auto" />
          <div className="leading-none">
            <p className="font-display text-[1.55rem] tracking-tight">
              INSPIRE <span className="text-gold">{year}</span>
            </p>
            <p className="mt-1.5 font-ui text-[0.55rem] font-semibold uppercase tracking-[0.22em] text-paper/70">Medical Research Conference</p>
          </div>
        </div>
      </div>
      <div aria-hidden className="lanyard-foil h-1.5" />
      <div className="px-6 pt-5">
        <p className="font-ui text-[0.62rem] font-semibold uppercase leading-relaxed tracking-[0.18em] text-gold-700">
          Congratulations! You&apos;re attending INSPIRE Lincoln {year}
        </p>
        <p className={cn("mt-3 font-display leading-[1.05] text-ink", long ? "text-[1.6rem]" : "text-[2.05rem]")}>{name}</p>
        {detail && <p className="mt-2 text-sm leading-snug text-slate-700">{detail}</p>}
      </div>
      {countdown && (
        // Sits just above the role bands, however many there are.
        <div className="absolute inset-x-0 px-6" style={{ bottom: `${3.5 + bandHeight(roles) + 0.25}rem` }}>
          <CardCountdown date={countdown.date} time={countdown.time} />
        </div>
      )}
      <RoleBands roles={roles} />
      <div className="absolute inset-x-0 bottom-0 flex h-14 items-center justify-between gap-3 px-6 font-ui text-[0.68rem] text-slate-700">
        <span className="font-semibold text-ink">{dateLabel}</span>
        <span className="truncate text-right">{venue}</span>
      </div>
      {sheen && <m.div aria-hidden style={{ backgroundImage: sheen }} className="pointer-events-none absolute inset-0 mix-blend-soft-light" />}
    </Face>
  );
}

function Back({ year, theme, qr, reference, checkedIn, hidden }: LanyardProps & { hidden: boolean }) {
  return (
    <Face back hidden={hidden} className="bg-midnight text-paper ring-1 ring-gold/40">
      <div aria-hidden className="lanyard-grid pointer-events-none absolute inset-0 opacity-[0.12]" />
      <div className="relative flex h-full flex-col items-center px-6 pb-6 pt-11 text-center">
        <p className="font-ui text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-gold">Check-in · INSPIRE {year}</p>
        <p className="mt-1.5 text-[0.7rem] leading-snug text-paper/60">{theme}</p>
        {qr ? (
          <>
            <div className="relative mt-5 w-[78%]">
              <div className="rounded-xl bg-white p-2.5 ring-2 ring-gold/60" role="img" aria-label="Your check-in QR code" dangerouslySetInnerHTML={{ __html: qr }} />
              {checkedIn && (
                <span className="absolute -right-3 -top-3 rotate-12 rounded-md border-2 border-success bg-white px-2 py-1 font-ui text-[0.65rem] font-bold uppercase tracking-[0.16em] text-success shadow">
                  Checked in
                </span>
              )}
            </div>
            {reference && <p className="mt-3 font-mono text-xs tracking-[0.2em] text-paper/70">{reference}</p>}
            <p className="mt-auto text-sm leading-snug text-paper/80">
              {checkedIn ? "You're checked in. Enjoy the conference." : "Show this at registration. Turn your screen brightness up to make it quicker to scan."}
            </p>
            <p className="mt-2 text-[0.68rem] text-paper/55">The code holds a reference number only, no personal details.</p>
          </>
        ) : (
          <>
            <div aria-hidden className="mt-6 grid aspect-square w-[70%] place-items-center rounded-xl border border-dashed border-paper/25">
              <img src="/brand/crest-white.png" alt="" className="h-16 w-auto opacity-40" />
            </div>
            <p className="mt-auto text-sm leading-snug text-paper/80">Your check-in code will appear here closer to the event.</p>
          </>
        )}
      </div>
    </Face>
  );
}

/** Height of the role bands in rem: one role fills 3rem, more roles get a 1.75rem stripe each. */
function bandHeight(roles: LanyardProps["roles"]) {
  const n = roles.length > 3 ? 1 : Math.max(roles.length, 1);
  return n === 1 ? 3 : n * 1.75;
}

/**
 * The coloured role bands across the foot of the card, like the stripes on a
 * printed lanyard. One role fills the band; two or three share it as stacked
 * stripes, each in that role's colour. More than three share a single band.
 */
function RoleBands({ roles }: { roles: LanyardProps["roles"] }) {
  const list = roles.length ? roles : [{ label: "Delegate", tone: "delegate" as const }];
  const bands = list.length > 3 ? [{ label: list.map((r) => r.label).join(" · "), tone: list[0].tone }] : list;
  const many = bands.length > 1 || list.length > 3;
  return (
    <ul aria-label={list.length > 1 ? "Your roles" : "Your role"} className="absolute inset-x-0 bottom-14 flex flex-col" style={{ height: `${bandHeight(roles)}rem` }}>
      {bands.map((r, i) => (
        <li
          key={`${r.label}-${i}`}
          className={cn(
            "flex min-h-0 flex-1 items-center justify-center px-3 text-center font-ui font-bold uppercase leading-none",
            many ? "text-[0.7rem] tracking-[0.22em]" : "text-sm tracking-[0.28em]",
            i > 0 && "border-t border-white/25",
            BAND[r.tone],
          )}
        >
          <span className="truncate">{r.label}</span>
        </li>
      ))}
    </ul>
  );
}
