import Link from "next/link";
import { ArrowRight, Network, Sprout, Telescope } from "lucide-react";
import { STORY } from "@/content/story";
import { Stagger, StaggerItem } from "@/components/motion/reveal";
import { LineDraw } from "@/components/motion/effects";
import { cn } from "@/lib/cn";

/** Three chapters of the INSPIRE story, each on its own coloured card. */
const STYLES = [
  { icon: Sprout, card: "bg-navy text-paper", eyebrow: "text-gold-300", body: "text-paper/80", num: "text-white/[0.07]", chip: "bg-white/10 text-gold-300" },
  { icon: Network, card: "bg-gold text-midnight", eyebrow: "text-midnight/70", body: "text-midnight/80", num: "text-midnight/[0.08]", chip: "bg-midnight/10 text-midnight" },
  { icon: Telescope, card: "bg-cyan text-ink", eyebrow: "text-electric-600", body: "text-slate-700", num: "text-navy/[0.07]", chip: "bg-navy/10 text-navy" },
];

export function OurStory() {
  return (
    <section aria-labelledby="story-title" className="bg-paper pb-12 sm:pb-24">
      <div className="container-page">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow flex items-center gap-3 text-electric-600">
              <LineDraw className="w-8 bg-electric-600/50" /> Our story
            </p>
            <h2 id="story-title" className="mt-3 text-display-sm font-normal text-ink">More than a decade of student research</h2>
          </div>
          <Link href="/about" className="group inline-flex min-h-11 items-center gap-2 font-ui text-sm font-semibold text-electric-600">
            About INSPIRE <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
        <Stagger className="mt-6 grid gap-3 sm:mt-10 sm:gap-4 md:grid-cols-3">
          {STORY.map((ch, i) => {
            const s = STYLES[i % STYLES.length];
            return (
              <StaggerItem key={ch.label} className="h-full">
                <article
                  className={cn(
                    "group relative flex h-full flex-col overflow-hidden rounded-xl p-6 shadow-[0_1px_2px_rgba(12,24,44,0.08),0_18px_40px_-28px_rgba(12,24,44,0.6)] ring-1 ring-black/5 transition-transform duration-500 ease-[var(--ease-out-expo)] hover:-translate-y-1 sm:p-7",
                    s.card,
                  )}
                >
                  <span aria-hidden className={cn("pointer-events-none absolute right-5 top-3 font-display text-[4.5rem] leading-none", s.num)}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span aria-hidden className={cn("relative grid size-11 place-items-center rounded-full transition-transform duration-500 group-hover:-rotate-6", s.chip)}>
                    <s.icon className="size-5" />
                  </span>
                  <h3 className={cn("eyebrow relative mt-6", s.eyebrow)}>{ch.label}</h3>
                  <p className={cn("relative mt-3 text-[0.95rem] leading-relaxed", s.body)}>{ch.text}</p>
                </article>
              </StaggerItem>
            );
          })}
        </Stagger>
      </div>
    </section>
  );
}
