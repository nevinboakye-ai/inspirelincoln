import { Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Notice({
  title,
  children,
  tone = "info",
  dark = false,
  className,
}: {
  title?: string;
  children: ReactNode;
  tone?: "info" | "warning";
  dark?: boolean;
  className?: string;
}) {
  const Icon = tone === "warning" ? TriangleAlert : Info;
  return (
    <div
      className={cn(
        "flex gap-3 rounded-md border p-4 text-sm leading-relaxed",
        dark
          ? "border-white/12 bg-white/[0.04] text-paper/80"
          : tone === "warning"
            ? "border-warning/25 bg-warning/[0.06] text-slate-700"
            : "border-electric/20 bg-electric/[0.05] text-slate-700",
        className,
      )}
    >
      <Icon
        aria-hidden
        className={cn("mt-0.5 size-4 shrink-0", dark ? "text-cyan" : tone === "warning" ? "text-warning" : "text-electric-600")}
      />
      <div>
        {title && <p className={cn("mb-1 font-semibold", dark ? "text-paper" : "text-ink")}>{title}</p>}
        {children}
      </div>
    </div>
  );
}
