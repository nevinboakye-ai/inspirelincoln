import Image from "next/image";
import type { ReactNode } from "react";
import { Reveal } from "@/components/motion/reveal";
import { cn } from "@/lib/cn";

/**
 * Dark editorial header for interior pages. Each page passes its own `visual`
 * so heroes share a system without looking identical.
 */
export function PageHero({
  eyebrow,
  title,
  intro,
  children,
  visual,
  className,
  size = "md",
}: {
  eyebrow: string;
  title: ReactNode;
  intro?: ReactNode;
  children?: ReactNode;
  visual?: ReactNode;
  className?: string;
  size?: "md" | "lg";
}) {
  return (
    <section className={cn("surface-midnight noise relative isolate overflow-hidden", size === "lg" ? "pt-40 pb-24 sm:pb-32" : "pt-36 pb-16 sm:pt-44 sm:pb-24", className)}>
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_80%_at_85%_0%,rgba(58,95,148,0.32),transparent_60%)]" />
        <div className="quarter-lattice absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        {visual ?? (
          <Image
            src="/brand/crest-white.png"
            alt=""
            width={338}
            height={397}
            className="absolute -right-16 top-1/2 hidden h-[130%] w-auto -translate-y-1/3 opacity-[0.05] lg:block"
          />
        )}
      </div>
      <div className="container-page relative">
        <Reveal>
          <p className="eyebrow flex items-center gap-4 border-t border-white/15 pt-4 text-cyan">
            <span aria-hidden className="font-display text-base normal-case italic tracking-normal text-paper/60">INSPIRE</span>
            {eyebrow}
          </p>
          <h1 className={cn("mt-8 max-w-5xl font-normal", size === "lg" ? "text-display-xl" : "text-display-lg")}>{title}</h1>
          {intro && <div className="mt-6 max-w-2xl text-lg leading-relaxed text-paper/70 sm:text-xl">{intro}</div>}
          {children}
        </Reveal>
      </div>
    </section>
  );
}
