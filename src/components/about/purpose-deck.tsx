import type { LucideIcon } from "lucide-react";
import { CardDeck } from "@/components/ui/card-deck";
import { cn } from "@/lib/cn";

type Value = { icon: LucideIcon; name: string; body: string };

const shell = "relative flex h-full flex-col overflow-hidden rounded-2xl p-5 shadow-[0_1px_2px_rgba(12,24,44,0.12),0_30px_60px_-30px_rgba(0,0,0,0.6)] ring-1 ring-black/5 sm:p-6";

type Tone = "cyan" | "gold" | "paper";
const TONES: Record<Tone, { card: string; chip: string; eyebrow: string; num: string; dot: string }> = {
  cyan: { card: "bg-cyan text-ink", chip: "bg-navy/10 text-navy", eyebrow: "text-electric-600", num: "text-navy/[0.07]", dot: "bg-cyan" },
  gold: { card: "bg-gold text-midnight", chip: "bg-midnight/10 text-midnight", eyebrow: "text-midnight/75", num: "text-midnight/[0.08]", dot: "bg-gold" },
  paper: { card: "bg-paper text-ink", chip: "bg-navy/[0.07] text-electric-600", eyebrow: "text-electric-600", num: "text-navy/[0.06]", dot: "bg-paper" },
};

function Card({ icon: Icon, eyebrow, title, text, num, tone }: { icon: LucideIcon; eyebrow: string; title?: string; text: string; num: string; tone: Tone }) {
  const s = TONES[tone];
  return (
    <article className={cn(shell, s.card)}>
      <span aria-hidden data-num={num} className={cn("pointer-events-none absolute right-5 top-3 font-display text-[3.5rem] leading-none before:content-[attr(data-num)]", s.num)} />
      <span aria-hidden className={cn("relative grid size-10 place-items-center rounded-full", s.chip)}>
        <Icon className="size-5" />
      </span>
      <h3 className={cn("eyebrow relative mt-5", s.eyebrow)}>{eyebrow}</h3>
      {title && <p className="relative mt-2 font-display text-2xl font-semibold leading-tight">{title}</p>}
      <p className={cn("relative mt-2.5 font-display font-medium leading-snug", title ? "text-lg" : "text-xl sm:text-[1.4rem]")}>{text}</p>
    </article>
  );
}

/**
 * Our mission, our vision and our values as a stack of cards to swipe or
 * step through, like the story on the home page.
 */
export function PurposeDeck({ mission, vision, values, icons }: { mission: string; vision: string; values: Value[]; icons: { mission: LucideIcon; vision: LucideIcon } }) {
  const num = (i: number) => `${String(i + 1).padStart(2, "0")}`;
  return (
    <CardDeck
      label="Our mission, vision and values"
      tone="dark"
      cards={[
        { key: "mission", label: "Our mission", dot: TONES.cyan.dot, card: <Card icon={icons.mission} eyebrow="Our mission" text={mission} num={num(0)} tone="cyan" /> },
        { key: "vision", label: "Our vision", dot: TONES.gold.dot, card: <Card icon={icons.vision} eyebrow="Our vision" text={vision} num={num(1)} tone="gold" /> },
        ...values.map((v, i) => ({
          key: v.name,
          label: `Our values: ${v.name}`,
          dot: TONES.paper.dot,
          card: <Card icon={v.icon} eyebrow={`Our values · ${i + 1} of ${values.length}`} title={v.name} text={v.body} num={num(i + 2)} tone="paper" />,
        })),
      ]}
    />
  );
}
