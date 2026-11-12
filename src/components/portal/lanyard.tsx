"use client";
import { animate, m, useMotionTemplate, useMotionValue, useMotionValueEvent, useReducedMotion, useSpring, useTransform, type AnimationPlaybackControls } from "motion/react";
import Link from "next/link";
import { Eye, RotateCw, Star } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { CardCountdown } from "./hub-motion";
import { SponsorLogo } from "@/components/sponsors/sponsor-logo";
import type { Sponsor } from "@/lib/types";

export type LanyardTone = "delegate" | "poster" | "oral" | "waitlist" | "committee" | "executive";

const BAND: Record<LanyardTone, string> = {
  delegate: "bg-navy text-paper",
  poster: "bg-gold text-midnight",
  oral: "bg-cyan text-midnight",
  waitlist: "bg-violet text-midnight",
  committee: "bg-midnight text-gold-300",
  // Gold foil edges and stars, so an executive role reads first from across a room.
  executive: "bg-midnight text-gold-300 border-y-[3px] border-gold shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]",
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
  /**
   * Their card QR code as an SVG string. Delegates scan it to see their card
   * and save them; check-in staff scan the same code on the day.
   */
  qr: string | null;
  /** The card code, spaced out for reading aloud or typing. */
  reference: string | null;
  checkedIn: boolean;
  /** Whether people who scan the code see their details. */
  shared?: boolean;
  /** Their own card page, to preview what people see. */
  previewHref?: string | null;
  /** The conference start, for the countdown printed on the card. */
  countdown?: { date: string; time: string | null };
  /** A short-lived link to their profile photo, if they've added one. */
  photo?: string | null;
  /** Their university's logo, if the committee has added one. */
  uniLogo?: string | null;
  /** Shown to the site owner while the card is still switched off for everyone else. */
  previewNote?: string | null;
  /** Sponsors printed small on the back of the card. */
  sponsors?: Pick<Sponsor, "id" | "name" | "logoUrl">[];
}

type Side = "front" | "back";

/** Which face is towards you at a given turn, in degrees. */
const sideAt = (deg: number): Side => (((Math.round(deg / 180) % 2) + 2) % 2 === 0 ? "front" : "back");
const nearestSide = (deg: number) => Math.round(deg / 180) * 180;

/** How far a drag must move before it turns the card rather than counting as a tap. */
const DRAG_START = 6;

/**
 * The delegate card as an INSPIRE lanyard. It drops in on its strap, sways
 * gently and tilts with the pointer. Drag it sideways with a finger or mouse
 * to turn it round in 3D: on release it settles on whichever side is nearer,
 * and a quick flick carries it over. A tap, or the button below, flips it.
 * With reduced motion it turns without the springy settle.
 */
export function Lanyard(p: LanyardProps) {
  const reduce = useReducedMotion();
  const scene = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
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

  // The turn, in degrees. Every half turn shows the other side.
  const spin = useMotionValue(0);
  const [facing, setFacing] = useState<Side>("front");
  useMotionValueEvent(spin, "change", (v) => setFacing(sideAt(v)));
  const settling = useRef<AnimationPlaybackControls | null>(null);
  const drag = useRef<{ id: number; x: number; y: number; from: number; turning: boolean; trail: { t: number; spin: number }[] } | null>(null);

  const settle = (to: number, velocity = 0) => {
    settling.current?.stop();
    settling.current = animate(spin, to, reduce ? { duration: 0 } : { type: "spring", stiffness: 140, damping: 19, velocity });
  };
  /** Turn to the other side: forwards from the front, back again from the back. */
  const flip = () => {
    const at = nearestSide(spin.get());
    settle(at + (sideAt(at) === "front" ? 180 : -180));
  };

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    settling.current?.stop();
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, from: spin.get(), turning: false, trail: [{ t: e.timeStamp, spin: spin.get() }] };
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.turning) {
      if (Math.abs(dx) < DRAG_START || Math.abs(dx) < Math.abs(dy)) {
        // Mostly up and down: leave it to the page to scroll.
        if (Math.abs(dy) > DRAG_START * 2) drag.current = null;
        return;
      }
      d.turning = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
      px.set(0.5);
      py.set(0.5);
    }
    // Dragging across the whole card turns it half way round.
    const width = card.current?.offsetWidth || 300;
    const next = d.from + (dx / width) * 180;
    d.trail.push({ t: e.timeStamp, spin: next });
    if (d.trail.length > 12) d.trail.shift();
    spin.set(next);
  };
  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (!d.turning) return flip(); // A tap
    const now = spin.get();
    // How fast it was turning over the last tenth of a second, in degrees a
    // second. Phones often send only a few moves for a quick flick, so this
    // looks back over a short window rather than at the last step alone.
    const recent = d.trail.filter((p) => e.timeStamp - p.t <= 100);
    const first = recent[0] ?? d.trail[d.trail.length - 1];
    const speed = recent.length > 1 ? ((now - first.spin) / Math.max(e.timeStamp - first.t, 16)) * 1000 : 0;
    // A quick flick carries it over; otherwise it goes back to the nearer side.
    const aimed = nearestSide(now + speed * 0.12);
    const base = nearestSide(now);
    settle(Math.min(base + 180, Math.max(base - 180, aimed)), speed);
  };
  const onCancel = () => {
    if (drag.current?.turning) settle(nearestSide(spin.get()));
    drag.current = null;
  };
  // Touch input is captured to the element under the finger. Moving that
  // capture to the card makes the old target lose it, which must not end the
  // drag: only a lost capture on the card itself does.
  const onLostCapture = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onCancel();
  };

  // Once the card is turning, stop the page from scrolling under the finger
  // (Safari doesn't always honour touch-action on 3D-transformed elements).
  useEffect(() => {
    const el = card.current;
    if (!el) return;
    const hold = (e: TouchEvent) => {
      if (drag.current?.turning && e.cancelable) e.preventDefault();
    };
    el.addEventListener("touchmove", hold, { passive: false });
    return () => el.removeEventListener("touchmove", hold);
  }, []);

  const move = (e: React.PointerEvent) => {
    if (reduce || e.pointerType === "touch" || drag.current?.turning || !scene.current) return;
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
                ref={card}
                style={{ rotateY: spin }}
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onCancel}
                onLostPointerCapture={onLostCapture}
                onDragStart={(e) => e.preventDefault()}
                className="relative aspect-[5/7.6] w-full cursor-grab touch-pan-y select-none [-webkit-tap-highlight-color:transparent] [transform-style:preserve-3d] active:cursor-grabbing"
              >
                <Front {...p} long={long} hidden={facing !== "front"} sheen={reduce ? null : sheen} />
                <Back {...p} hidden={facing !== "back"} />
              </m.div>
            </m.div>
          </m.div>
        </m.div>
      </div>

      <button
        type="button"
        onClick={flip}
        aria-pressed={facing === "back"}
        className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full border border-navy/15 bg-white px-5 font-ui text-sm font-semibold text-ink shadow-sm transition-colors hover:border-navy/35"
      >
        <RotateCw aria-hidden className={cn("size-4 transition-transform duration-500", facing === "back" && "rotate-180")} />
        {facing === "back" ? "Show the front" : p.qr ? "Show my QR code" : "Turn the card over"}
      </button>
      <p className="mt-2 text-xs text-slate-700">Or drag the card, or tap it, to turn it round.</p>
      {p.previewHref && (
        <Link href={p.previewHref} className="mt-2 inline-flex min-h-11 items-center gap-1.5 font-ui text-sm font-semibold text-electric-600 underline-offset-4 hover:underline">
          <Eye aria-hidden className="size-4" /> See what people see when they scan it
        </Link>
      )}
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

function Front({ year, name, detail, photo, uniLogo, roles, dateLabel, venue, countdown, long, hidden, sheen }: LanyardProps & { long: boolean; hidden: boolean; sheen: ReturnType<typeof useMotionTemplate> | null }) {
  return (
    <Face hidden={hidden} className="bg-ivory text-ink ring-1 ring-black/5">
      <div className="relative bg-midnight px-6 pb-5 pt-10 text-paper">
        <div aria-hidden className="lanyard-grid pointer-events-none absolute inset-0 opacity-[0.18]" />
        <div className="relative flex items-center gap-3">
          <img src="/brand/conference-mark-white.png" alt="" aria-hidden className="h-11 w-auto" />
          <div className="leading-none">
            <p className="font-display text-[1.55rem] tracking-tight">
              INSPIRE <span className="text-gold">{year}</span>
            </p>
            <p className="mt-1.5 font-ui text-[0.5rem] font-semibold uppercase tracking-[0.16em] text-paper/70">National Medical Research Conference</p>
          </div>
        </div>
      </div>
      <div aria-hidden className="lanyard-foil h-1.5" />
      <div className="px-6 pt-5">
        <p className="font-ui text-[0.62rem] font-semibold uppercase leading-relaxed tracking-[0.18em] text-gold-700">
          Congratulations! You&apos;re attending INSPIRE Lincoln {year}
        </p>
        <div className="mt-3 flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className={cn("font-display leading-[1.05] text-ink [overflow-wrap:anywhere]", long || (photo && name.length > 16) ? "text-[1.6rem]" : "text-[2.05rem]")}>{name}</p>
            {detail && (
              <p className="mt-2 flex items-center gap-2 text-sm leading-snug text-slate-700">
                {uniLogo && (
                  // The university is named right beside it.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={uniLogo} alt="" aria-hidden draggable={false} className="h-6 w-auto max-w-12 shrink-0 object-contain" />
                )}
                <span>{detail}</span>
              </p>
            )}
          </div>
          {photo && (
            // The name is right beside it, so the photo itself needs no description.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" aria-hidden draggable={false} className="size-[4.75rem] shrink-0 rounded-full object-cover ring-[3px] ring-gold/70 ring-offset-2 ring-offset-ivory" />
          )}
        </div>
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

function Back({ year, qr, reference, checkedIn, shared = true, sponsors = [], hidden }: LanyardProps & { hidden: boolean }) {
  return (
    <Face back hidden={hidden} className="bg-midnight text-paper ring-1 ring-gold/40">
      <div aria-hidden className="lanyard-grid pointer-events-none absolute inset-0 opacity-[0.12]" />
      <div className="relative flex h-full flex-col items-center px-6 pb-6 pt-11 text-center">
        <p className="font-ui text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-gold">Scan me · INSPIRE {year}</p>
        <p className="mt-1.5 text-[0.7rem] leading-snug text-paper/65">To connect, and to check in on the day</p>
        {qr ? (
          <>
            <div className={cn("relative mt-4", sponsors.length ? "mt-3 w-[66%]" : "w-[80%]")}>
              <div className="rounded-xl bg-white p-2.5 ring-2 ring-gold/60" role="img" aria-label={`Your Delegate Card QR code${reference ? `, code ${reference}` : ""}`} dangerouslySetInnerHTML={{ __html: qr }} />
              {checkedIn && (
                <span className="absolute -right-3 -top-3 rotate-12 rounded-md border-2 border-success bg-white px-2 py-1 font-ui text-[0.65rem] font-bold uppercase tracking-[0.16em] text-success shadow">
                  Checked in
                </span>
              )}
            </div>
            {reference && <p className="mt-3 font-mono text-xs tracking-[0.16em] text-paper/75">{reference}</p>}
            <p className="mt-auto text-[0.8rem] leading-snug text-paper/85">
              {checkedIn
                ? "You're checked in. Enjoy the conference."
                : shared
                  ? "Delegates scan this to see your card and save you. Show it at registration to check in."
                  : "Sharing is off, so people who scan see nothing about you. Show it at registration to check in."}
            </p>
            <p className="mt-2 text-[0.66rem] text-paper/60">The code is a private link. It holds no personal details.</p>
          </>
        ) : (
          <>
            <div aria-hidden className="mt-6 grid aspect-square w-[70%] place-items-center rounded-xl border border-dashed border-paper/25">
              <img src="/brand/conference-mark-white.png" alt="" className="h-16 w-auto opacity-40" />
            </div>
            <p className="mt-auto text-sm leading-snug text-paper/80">Your QR code will appear here once your place is confirmed.</p>
          </>
        )}
        {sponsors.length > 0 && (
          <div className="-mb-2 mt-2.5 flex w-full items-center justify-center gap-2 border-t border-white/10 pt-2">
            <p className="shrink-0 font-ui text-[0.45rem] font-semibold uppercase leading-tight tracking-[0.18em] text-paper/50">Supported<br />by</p>
            <ul className="flex flex-wrap items-center justify-center gap-1.5">
              {sponsors.map((s) => (
                <li key={s.id}>
                  <SponsorLogo sponsor={s} size="xs" />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Face>
  );
}

/**
 * The stripes to draw. Up to three roles get a stripe each; beyond that the
 * rest share one. An executive role always keeps a stripe of its own.
 */
function bandsOf(roles: LanyardProps["roles"]) {
  const list = roles.length ? roles : [{ label: "Delegate", tone: "delegate" as const }];
  const exec = list.filter((r) => r.tone === "executive");
  const rest = list.filter((r) => r.tone !== "executive");
  return rest.length <= 3 ? list : [...exec, { label: rest.map((r) => r.label).join(" · "), tone: rest[0].tone }];
}

/**
 * Height of the role bands in rem: one role fills 3rem (3.5rem if it's
 * executive), more roles get a 1.75rem stripe each and executive 2.5rem.
 */
function bandHeight(roles: LanyardProps["roles"]) {
  const bands = bandsOf(roles);
  if (bands.length === 1) return bands[0].tone === "executive" ? 3.5 : 3;
  return bands.reduce((h, r) => h + (r.tone === "executive" ? 2.5 : 1.75), 0);
}

/**
 * The coloured role bands across the foot of the card, like the stripes on a
 * printed lanyard, each in that role's colour. Executive roles get a taller
 * stripe with gold edges and stars.
 */
function RoleBands({ roles }: { roles: LanyardProps["roles"] }) {
  const list = roles.length ? roles : [{ label: "Delegate", tone: "delegate" as const }];
  const bands = bandsOf(roles);
  const many = bands.length > 1;
  return (
    <ul aria-label={list.length > 1 ? "Your roles" : "Your role"} className="absolute inset-x-0 bottom-14 flex flex-col" style={{ height: `${bandHeight(roles)}rem` }}>
      {bands.map((r, i) => (
        <li
          key={`${r.label}-${i}`}
          className={cn(
            "flex min-h-0 items-center justify-center gap-2 px-3 text-center font-ui font-bold uppercase leading-none",
            r.tone === "executive" ? cn("flex-[1.43] tracking-[0.16em]", r.label.length > 16 ? "text-[0.8rem]" : "text-[0.95rem]") : cn("flex-1", many ? "text-[0.7rem] tracking-[0.22em]" : "text-sm tracking-[0.28em]"),
            i > 0 && r.tone !== "executive" && bands[i - 1].tone !== "executive" && "border-t border-white/25",
            BAND[r.tone],
          )}
        >
          {r.tone === "executive" && <Star aria-hidden className="size-3.5 shrink-0 fill-gold text-gold" />}
          <span className="truncate">{r.label}</span>
          {r.tone === "executive" && <Star aria-hidden className="size-3.5 shrink-0 fill-gold text-gold" />}
        </li>
      ))}
    </ul>
  );
}
