import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function SectionHeading({
  eyebrow,
  title,
  intro,
  dark = false,
  align = "left",
  className,
  as: Tag = "h2",
}: {
  eyebrow?: string;
  title: ReactNode;
  intro?: ReactNode;
  dark?: boolean;
  align?: "left" | "center";
  className?: string;
  as?: "h1" | "h2" | "h3";
}) {
  return (
    <div className={cn(align === "center" && "mx-auto text-center", "max-w-3xl", className)}>
      {eyebrow && (
        <p className={cn("eyebrow mb-4 flex items-center gap-3", align === "center" && "justify-center", dark ? "text-cyan" : "text-electric-600")}>
          <span aria-hidden className={cn("h-px w-8", dark ? "bg-cyan/60" : "bg-electric-600/50")} />
          {eyebrow}
        </p>
      )}
      <Tag className={cn("text-display-md font-semibold", dark ? "text-paper" : "text-ink")}>{title}</Tag>
      {intro && (
        <p className={cn("mt-6 text-lg leading-relaxed", dark ? "text-paper/70" : "text-slate-700")}>{intro}</p>
      )}
    </div>
  );
}
