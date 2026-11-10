import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "electric" | "cyan" | "violet" | "success" | "warning" | "danger" | "dark";

const tones: Record<Tone, string> = {
  neutral: "bg-paper-200 text-slate-700 ring-navy/10",
  electric: "bg-electric/10 text-electric-700 ring-electric/20",
  cyan: "bg-cyan/15 text-[#0b6577] ring-cyan/30",
  violet: "bg-violet/12 text-[#4b3fc4] ring-violet/25",
  success: "bg-success/10 text-success ring-success/20",
  warning: "bg-warning/10 text-[#7a4a00] ring-warning/25",
  danger: "bg-danger/10 text-danger ring-danger/20",
  dark: "bg-white/8 text-paper/85 ring-white/15",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Marks content that is provisional, example or awaiting confirmation. */
export function PlaceholderTag({ children = "Placeholder", dark = false }: { children?: ReactNode; dark?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-dashed px-2.5 py-0.5 text-[0.7rem] font-semibold uppercase tracking-[0.12em]",
        dark ? "border-cyan/50 text-cyan" : "border-warning/60 text-warning",
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", dark ? "bg-cyan" : "bg-warning")} />
      {children}
    </span>
  );
}
