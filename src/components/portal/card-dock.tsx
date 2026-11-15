"use client";
import { useId, useState } from "react";
import { ChevronDown, QrCode } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * The Delegate Card on My Hub. On wide screens it always hangs in the side
 * column. On phones and tablets it folds into a slim bar so the things to do
 * come first; tapping the bar drops the card in.
 */
export function CardDock({ year, name, role, photo, gold = false, children }: { year: number; name: string; role: string; photo: string | null; /** The committee's card is gold rather than navy. */ gold?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [drops, setDrops] = useState(0);
  const id = useId();
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          if (!open) setDrops((n) => n + 1);
          setOpen(!open);
        }}
        className={cn(
          "relative flex w-full items-center gap-3 overflow-hidden rounded-xl py-2.5 pl-3 pr-3.5 text-left xl:hidden",
          gold ? "bg-[linear-gradient(135deg,var(--color-gold-300)_0%,var(--color-gold)_55%,#c9a24c_100%)] text-midnight" : "bg-midnight text-paper",
        )}
      >
        <span aria-hidden className={cn("lanyard-grid pointer-events-none absolute inset-0", gold ? "opacity-[0.08] invert" : "opacity-20")} />
        {photo ? (
          // The name is right beside it.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" aria-hidden className={cn("relative size-10 shrink-0 rounded-full object-cover ring-2", gold ? "ring-midnight/60" : "ring-gold/70")} />
        ) : (
          <img src={gold ? "/brand/conference-mark-navy.png" : "/brand/conference-mark-white.png"} alt="" aria-hidden className="relative h-9 w-auto shrink-0" />
        )}
        <span className="relative min-w-0 flex-1 leading-tight">
          <span className={cn("block font-ui text-[0.62rem] font-semibold uppercase tracking-[0.18em]", gold ? "text-navy" : "text-gold")}>Delegate Card · INSPIRE {year}</span>
          <span className="block truncate font-display text-lg">{name}</span>
          <span className={cn("block truncate text-xs", gold ? "text-midnight/75" : "text-paper/70")}>{role}</span>
        </span>
        <span className={cn("relative inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 font-ui text-xs font-semibold", gold ? "bg-midnight/10" : "bg-white/10")}>
          {open ? <ChevronDown aria-hidden className="size-4 rotate-180" /> : <QrCode aria-hidden className="size-4" />}
          {open ? "Hide card" : "Show card"}
        </span>
      </button>
      <div id={id} className={cn(open ? "mt-3 block" : "hidden", "xl:mt-0 xl:block")}>
        <div key={drops}>{children}</div>
      </div>
    </div>
  );
}
