import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";

/** A calm placeholder for a part of the site that isn't open yet. */
export function ComingSoon({ eyebrow, children, as: Tag = "h1" }: { eyebrow: string; children: ReactNode; as?: "h1" | "h2" }) {
  return (
    <section aria-labelledby="soon-title" className="relative overflow-hidden rounded-xl bg-midnight p-8 text-center text-paper sm:p-14">
      <img src="/brand/crest-white.png" alt="" aria-hidden className="pointer-events-none absolute -bottom-12 left-1/2 h-64 w-auto -translate-x-1/2 opacity-[0.05]" />
      <div className="relative">
        <span className="mx-auto grid size-14 place-items-center rounded-full border border-gold/40 bg-gold/10 text-gold">
          <Sparkles aria-hidden className="size-6" />
        </span>
        <p className="eyebrow mt-6 text-gold">{eyebrow}</p>
        <Tag id="soon-title" className="mt-3 font-display text-4xl">Coming soon</Tag>
        <p className="mx-auto mt-4 max-w-md text-paper/75">{children}</p>
      </div>
    </section>
  );
}
