"use client";
import { motion } from "motion/react";
import { useState } from "react";
import { Reveal } from "@/components/motion/reveal";
import { cn } from "@/lib/cn";

const PILLARS = [
  { key: "discover", title: "Discover", body: "Explore emerging research and ideas, from the lab bench to the bedside and beyond.", colour: "#39D5F2" },
  { key: "connect", title: "Connect", body: "Build relationships with clinicians, researchers and peers who share your curiosity.", colour: "#3478F6" },
  { key: "advance", title: "Advance", body: "Develop the skills and confidence to contribute to medicine through research.", colour: "#8578F9" },
] as const;

function PillarVisual({ kind, active, colour }: { kind: (typeof PILLARS)[number]["key"]; active: boolean; colour: string }) {
  if (kind === "discover") {
    // A scanning lens sweeping across a field of data points.
    const points = [
      [30, 40], [62, 24], [90, 58], [48, 78], [120, 34], [140, 72], [104, 92], [24, 96], [150, 20], [76, 110],
    ];
    return (
      <svg viewBox="0 0 170 130" className="h-full w-full" aria-hidden>
        {points.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={2.2} fill={colour} opacity={0.35} />
        ))}
        <motion.g animate={{ x: active ? [0, 80, 20, 0] : 0, y: active ? [0, 20, 40, 0] : 0 }} transition={{ duration: 3.2, repeat: active ? Infinity : 0, ease: "easeInOut" }}>
          <circle cx={50} cy={50} r={26} fill={colour} fillOpacity={0.08} stroke={colour} strokeOpacity={0.8} />
          <line x1={69} y1={69} x2={84} y2={84} stroke={colour} strokeWidth={3} strokeLinecap="round" />
          <circle cx={50} cy={50} r={3} fill={colour} />
        </motion.g>
      </svg>
    );
  }
  if (kind === "connect") {
    const nodes = [
      [30, 30], [85, 18], [140, 36], [52, 88], [118, 96], [85, 62],
    ];
    const edges = [
      [0, 5], [1, 5], [2, 5], [3, 5], [4, 5], [0, 1], [1, 2], [3, 4], [0, 3], [2, 4],
    ];
    return (
      <svg viewBox="0 0 170 120" className="h-full w-full" aria-hidden>
        {edges.map(([a, b], i) => (
          <motion.line
            key={i}
            x1={nodes[a][0]}
            y1={nodes[a][1]}
            x2={nodes[b][0]}
            y2={nodes[b][1]}
            stroke={colour}
            strokeWidth={1.2}
            initial={false}
            animate={{ pathLength: active || i < 5 ? 1 : 0, opacity: active ? 0.85 : i < 5 ? 0.35 : 0 }}
            transition={{ duration: 0.6, delay: active ? i * 0.06 : 0 }}
          />
        ))}
        {nodes.map(([x, y], i) => (
          <motion.circle key={i} cx={x} cy={y} r={i === 5 ? 7 : 5} fill={i === 5 ? colour : "#071426"} stroke={colour} strokeWidth={1.5} animate={{ scale: active ? [1, 1.25, 1] : 1 }} transition={{ duration: 0.8, delay: i * 0.08 }} />
        ))}
      </svg>
    );
  }
  // Advance: ascending trajectory with milestones.
  return (
    <svg viewBox="0 0 170 120" className="h-full w-full" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.rect
          key={i}
          x={18 + i * 30}
          width={18}
          rx={4}
          fill={colour}
          initial={false}
          animate={{ y: 110 - (active ? 22 + i * 18 : 14 + i * 10), height: active ? 22 + i * 18 : 14 + i * 10, opacity: 0.25 + i * 0.12 }}
          transition={{ type: "spring", stiffness: 160, damping: 18, delay: i * 0.05 }}
        />
      ))}
      <motion.path
        d="M20 96 C 60 86, 90 60, 150 14"
        fill="none"
        stroke={colour}
        strokeWidth={2}
        strokeLinecap="round"
        initial={false}
        animate={{ pathLength: active ? 1 : 0.55 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      />
      <motion.circle cx={150} cy={14} r={4} fill={colour} animate={{ opacity: active ? 1 : 0 }} />
    </svg>
  );
}

export function Intro() {
  const [active, setActive] = useState<number | null>(null);
  return (
    <section id="introduction" aria-labelledby="intro-title" className="relative overflow-hidden bg-paper py-24 sm:py-32">
      <div aria-hidden className="grid-lines-light absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent_70%)]" />
      <div className="container-page relative">
        <div className="grid gap-12 lg:grid-cols-12">
          <Reveal className="lg:col-span-7">
            <p className="eyebrow mb-6 flex items-center gap-3 text-electric-600">
              <span aria-hidden className="h-px w-8 bg-electric-600/50" /> About INSPIRE
            </p>
            <h2 id="intro-title" className="text-display-lg font-semibold text-ink">
              More than a conference.{" "}
              <span className="text-slate">A platform for the next generation of medical research.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.15} className="lg:col-span-5 lg:pt-16">
            <p className="text-lg leading-relaxed text-slate-700">
              For more than a decade, INSPIRE has brought together medical students who are curious about research. We
              exist to help students explore research, develop academically, connect with researchers and clinicians, and
              gain the confidence to contribute to scientific and medical progress.
            </p>
            <p className="mt-5 text-lg leading-relaxed text-slate-700">
              The conference is where that community meets each year: a day that celebrates the intersection of medicine,
              research, innovation and opportunity.
            </p>
          </Reveal>
        </div>

        <ul className="mt-20 grid gap-4 md:grid-cols-3">
          {PILLARS.map((p, i) => (
            <li key={p.key}>
             <Reveal delay={i * 0.1} className="h-full">
              <div
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                className={cn(
                  "group relative flex h-full flex-col overflow-hidden rounded-lg border bg-white p-8 transition-[border-color,box-shadow,transform] duration-500",
                  active === i ? "-translate-y-1 border-navy/20 shadow-[0_24px_60px_-28px_rgba(7,20,38,0.35)]" : "border-navy/10",
                )}
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-display text-sm text-slate">0{i + 1}</span>
                  <span aria-hidden className="h-px w-16" style={{ background: p.colour }} />
                </div>
                <div className="mt-6 h-32 rounded-md bg-navy p-3">
                  <PillarVisual kind={p.key} active={active === i} colour={p.colour} />
                </div>
                <h3 className="mt-8 text-display-sm font-semibold text-ink">{p.title}</h3>
                <p className="mt-3 leading-relaxed text-slate-700">{p.body}</p>
              </div>
             </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
