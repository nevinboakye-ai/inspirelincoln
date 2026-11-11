import type { LucideIcon } from "lucide-react";
import { CardDeck } from "@/components/ui/card-deck";
import { cn } from "@/lib/cn";

type Value = { icon: LucideIcon; name: string; body: string };

const shell = "relative flex h-full flex-col overflow-hidden rounded-2xl p-7 shadow-[0_1px_2px_rgba(12,24,44,0.12),0_30px_60px_-30px_rgba(0,0,0,0.6)] ring-1 ring-black/5 sm:p-10";

function Statement({ icon: Icon, label, text, num, tone }: { icon: LucideIcon; label: string; text: string; num: string; tone: "cyan" | "gold" }) {
  const s =
    tone === "cyan"
      ? { card: "bg-cyan text-ink", chip: "bg-navy/10 text-navy", eyebrow: "text-electric-600", num: "text-navy/[0.07]" }
      : { card: "bg-gold text-midnight", chip: "bg-midnight/10 text-midnight", eyebrow: "text-midnight/75", num: "text-midnight/[0.08]" };
  return (
    <article className={cn(shell, s.card)}>
      <span aria-hidden data-num={num} className={cn("pointer-events-none absolute right-6 top-4 font-display text-[5.5rem] leading-none before:content-[attr(data-num)] sm:text-[7rem]", s.num)} />
      <span aria-hidden className={cn("relative grid size-12 place-items-center rounded-full", s.chip)}>
        <Icon className="size-6" />
      </span>
      {/* The values card sets the deck's height, so the statement sits at the foot of the card. */}
      <div className="relative mt-auto pt-10">
        <h3 className={cn("eyebrow", s.eyebrow)}>{label}</h3>
        <p className="mt-4 font-display text-2xl font-medium leading-snug sm:text-[2rem]">{text}</p>
      </div>
    </article>
  );
}

/**
 * Our mission, our vision and our values as a stack of cards to swipe or
 * step through, like the story on the home page.
 */
export function PurposeDeck({ mission, vision, values, icons }: { mission: string; vision: string; values: Value[]; icons: { mission: LucideIcon; vision: LucideIcon } }) {
  return (
    <CardDeck
      label="Our mission, vision and values"
      tone="dark"
      cards={[
        { key: "mission", label: "Our mission", dot: "bg-cyan", card: <Statement icon={icons.mission} label="Our mission" text={mission} num="01" tone="cyan" /> },
        { key: "vision", label: "Our vision", dot: "bg-gold", card: <Statement icon={icons.vision} label="Our vision" text={vision} num="02" tone="gold" /> },
        {
          key: "values",
          label: "Our values",
          dot: "bg-paper",
          card: (
            <article className={cn(shell, "bg-paper text-ink")}>
              <span aria-hidden data-num="03" className="pointer-events-none absolute right-6 top-4 font-display text-[5.5rem] leading-none text-navy/[0.06] before:content-[attr(data-num)] sm:text-[7rem]" />
              <h3 className="eyebrow relative text-electric-600">Our values</h3>
              <ul className="relative mt-6 space-y-5">
                {values.map((v) => (
                  <li key={v.name} className="flex gap-4">
                    <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-navy/[0.07] text-electric-600">
                      <v.icon className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-display text-xl font-semibold leading-tight">{v.name}</p>
                      <p className="mt-1 text-[0.95rem] leading-relaxed text-slate-700">{v.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </article>
          ),
        },
      ]}
    />
  );
}
