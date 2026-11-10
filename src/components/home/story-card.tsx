import { Network, Sprout, Telescope } from "lucide-react";
import { cn } from "@/lib/cn";

/** Three chapters of the INSPIRE story, each on its own coloured card. */
export const STORY_STYLES = [
  { icon: Sprout, card: "bg-navy text-paper", eyebrow: "text-gold-300", body: "text-paper/80", num: "text-white/[0.07]", chip: "bg-white/10 text-gold-300", dot: "bg-navy" },
  { icon: Network, card: "bg-gold text-midnight", eyebrow: "text-midnight/70", body: "text-midnight/80", num: "text-midnight/[0.08]", chip: "bg-midnight/10 text-midnight", dot: "bg-gold-600" },
  { icon: Telescope, card: "bg-cyan text-ink", eyebrow: "text-electric-600", body: "text-slate-700", num: "text-navy/[0.07]", chip: "bg-navy/10 text-navy", dot: "bg-electric-600" },
];

export function StoryCard({ index, label, text, className }: { index: number; label: string; text: string; className?: string }) {
  const s = STORY_STYLES[index % STORY_STYLES.length];
  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-xl p-6 shadow-[0_1px_2px_rgba(12,24,44,0.08),0_18px_40px_-28px_rgba(12,24,44,0.6)] ring-1 ring-black/5 sm:p-7",
        s.card,
        className,
      )}
    >
      {/* Decorative chapter number, drawn with CSS so it isn't read out or treated as text. */}
      <span
        aria-hidden
        data-num={String(index + 1).padStart(2, "0")}
        className={cn("pointer-events-none absolute right-5 top-3 font-display text-[4.5rem] leading-none before:content-[attr(data-num)]", s.num)}
      />
      <span aria-hidden className={cn("relative grid size-11 place-items-center rounded-full transition-transform duration-500 group-hover:-rotate-6", s.chip)}>
        <s.icon className="size-5" />
      </span>
      <h3 className={cn("eyebrow relative mt-6", s.eyebrow)}>{label}</h3>
      <p className={cn("relative mt-3 text-[0.95rem] leading-relaxed", s.body)}>{text}</p>
    </article>
  );
}
