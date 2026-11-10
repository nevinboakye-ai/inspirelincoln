"use client";
import { AnimatePresence, motion } from "motion/react";
import { Plus, Minus } from "lucide-react";
import { THEME_TOPICS } from "@/content/theme-topics";
import { useState } from "react";
import { Reveal } from "@/components/motion/reveal";
import { cn } from "@/lib/cn";



function OrbitGraphic({ active }: { active: number | null }) {
  const n = THEME_TOPICS.length;
  return (
    <svg viewBox="-200 -200 400 400" className="h-full w-full" aria-hidden>
      <defs>
        <radialGradient id="core" r="1">
          <stop offset="0" stopColor="#39D5F2" stopOpacity="0.9" />
          <stop offset="0.4" stopColor="#3478F6" stopOpacity="0.35" />
          <stop offset="1" stopColor="#3478F6" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle r="60" fill="url(#core)" />
      {[90, 130, 170].map((r, i) => (
        <motion.circle
          key={r}
          r={r}
          fill="none"
          stroke="#F7F9FC"
          strokeOpacity={0.09 + i * 0.02}
          strokeDasharray={i === 1 ? "2 6" : undefined}
          animate={{ rotate: i % 2 ? -360 : 360 }}
          transition={{ duration: 80 + i * 30, repeat: Infinity, ease: "linear" }}
        />
      ))}
      <motion.g animate={{ rotate: 360 }} transition={{ duration: 120, repeat: Infinity, ease: "linear" }}>
        {THEME_TOPICS.map((_, i) => {
          const a = (i / n) * Math.PI * 2 - Math.PI / 2;
          const r = 130;
          const x = Math.cos(a) * r;
          const y = Math.sin(a) * r;
          const on = active === i;
          return (
            <g key={i}>
              <line x1={0} y1={0} x2={x} y2={y} stroke={on ? "#39D5F2" : "#F7F9FC"} strokeOpacity={on ? 0.8 : 0.08} strokeWidth={on ? 1.5 : 1} />
              <circle cx={x} cy={y} r={on ? 12 : 7} fill={on ? "#39D5F2" : "#122944"} stroke="#39D5F2" strokeOpacity={on ? 1 : 0.6} style={{ transition: "r 0.4s" }} />
              {on && <circle cx={x} cy={y} r={22} fill="none" stroke="#39D5F2" strokeOpacity={0.35} />}
            </g>
          );
        })}
      </motion.g>
      <text textAnchor="middle" y="-4" className="fill-paper font-display" fontSize="15" fontWeight="600">
        Innovation
      </text>
      <text textAnchor="middle" y="16" className="fill-cyan font-display" fontSize="11" letterSpacing="2">
        → EVIDENCE
      </text>
    </svg>
  );
}

export function ThemeSpotlight({ theme, statement, year }: { theme: string; statement: string; year: number }) {
  const [open, setOpen] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const highlighted = hover ?? open;

  return (
    <section aria-labelledby="theme-title" className="surface-dark relative overflow-hidden py-24 sm:py-32">
      <div aria-hidden className="grid-lines absolute inset-0 opacity-60" />
      <div aria-hidden className="absolute -left-40 top-20 size-[36rem] rounded-full bg-electric/15 blur-[140px]" />
      <div className="container-page relative">
        <div className="grid items-center gap-12 lg:grid-cols-12">
          <Reveal className="lg:col-span-6">
            <p className="eyebrow mb-6 flex items-center gap-3 text-cyan">
              <span aria-hidden className="h-px w-8 bg-cyan/60" /> {year} conference theme
            </p>
            <h2 id="theme-title" className="text-display-lg font-semibold">
              {theme.split(":")[0]}:
              <span className="block bg-gradient-to-r from-cyan to-violet-300 bg-clip-text text-transparent">{theme.split(":").slice(1).join(":").trim()}</span>
            </h2>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-paper/70">{statement}</p>
          </Reveal>
          <Reveal delay={0.2} className="mx-auto aspect-square w-full max-w-[460px] lg:col-span-6">
            <OrbitGraphic active={highlighted} />
          </Reveal>
        </div>

        <ul className="mt-16 grid gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
          {THEME_TOPICS.map((t, i) => {
            const isOpen = open === i;
            const Icon = t.icon;
            return (
              <li key={t.title} className="bg-navy">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={`topic-${i}`}
                  onClick={() => setOpen(isOpen ? null : i)}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  className={cn(
                    "group flex h-full w-full flex-col p-7 text-left transition-colors duration-300",
                    isOpen ? "bg-navy-700" : "hover:bg-navy-800",
                  )}
                >
                  <span className="flex w-full items-start justify-between gap-4">
                    <Icon aria-hidden className={cn("size-6 transition-colors", highlighted === i ? "text-cyan" : "text-paper/50")} />
                    <span className="flex size-8 items-center justify-center rounded-full border border-white/15 text-paper/70 group-hover:border-cyan/50 group-hover:text-cyan">
                      {isOpen ? <Minus className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}
                    </span>
                  </span>
                  <span className="mt-8 font-display text-xl font-medium leading-snug">{t.title}</span>
                  <span className="mt-2 text-sm leading-relaxed text-paper/60">{t.short}</span>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.span
                        id={`topic-${i}`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                        className="block overflow-hidden"
                      >
                        <span className="mt-4 block border-t border-white/10 pt-4 text-[0.95rem] leading-relaxed text-paper/80">{t.detail}</span>
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
