import Image from "next/image";
import type { ReactNode } from "react";
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
  size?: "sm" | "md" | "lg";
}) {
  return (
    <section className={cn("surface-midnight noise relative isolate overflow-hidden", size === "lg" ? "pt-40 pb-24 sm:pb-32" : size === "sm" ? "pt-32 pb-12 sm:pt-36 sm:pb-16" : "pt-36 pb-16 sm:pt-44 sm:pb-24", className)}>
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_80%_at_85%_0%,rgba(58,95,148,0.32),transparent_60%)]" />
        <div className="quarter-lattice absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        {visual ?? (
          <Image
            src="/brand/crest-white.png"
            alt=""
            width={338}
            height={397}
            className="animate-breathe absolute -right-16 top-1/2 hidden h-[130%] w-auto -translate-y-1/3 opacity-[0.05] lg:block"
          />
        )}
      </div>
      <div className="container-page relative">
        <span aria-hidden className="enter-draw block h-px bg-white/15" />
        <p className="enter-up eyebrow flex items-center gap-4 pt-4 text-cyan [animation-delay:60ms]">
          <span aria-hidden className="font-display text-base normal-case italic tracking-normal text-paper/60">INSPIRE</span>
          {eyebrow}
        </p>
        <h1 className={cn("mt-8 max-w-5xl font-normal", size === "lg" ? "text-display-xl" : "text-display-lg")}>
          <span className="block overflow-hidden pb-[0.1em]">
            <span className="enter-rise block [animation-delay:100ms]">{title}</span>
          </span>
        </h1>
        {(intro || children) && (
          <div className="enter-up [animation-delay:260ms]">
            {intro && <div className="mt-6 max-w-2xl text-lg leading-relaxed text-paper/70 sm:text-xl">{intro}</div>}
            {children}
          </div>
        )}
      </div>
    </section>
  );
}
