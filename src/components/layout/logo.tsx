import Image from "next/image";
import { cn } from "@/lib/cn";

/**
 * The conference mark (the microscope from the INSPIRE 2026 conference logo)
 * with a serif wordmark. `tone` picks the artwork: "light" (white) for dark
 * backgrounds, "dark" (navy) for light ones. The INSPIRE society's crest is
 * kept for the society itself (see SocietyCrest).
 */
export function Logo({
  className,
  compact = false,
  tone = "light",
}: {
  className?: string;
  compact?: boolean;
  tone?: "light" | "dark";
}) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <Image
        src={tone === "light" ? "/brand/conference-mark-white.png" : "/brand/conference-mark-navy.png"}
        alt=""
        width={127}
        height={154}
        priority
        className="h-10 w-auto shrink-0"
      />
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="whitespace-nowrap font-display text-[1.15rem] font-medium sm:text-[1.35rem] lg:text-[1.15rem] xl:text-[1.35rem] tracking-[0.02em]">Inspire Lincoln 2026</span>
          <span className="mt-1 whitespace-nowrap font-ui text-[0.46rem] font-semibold uppercase tracking-[0.16em] opacity-70 sm:text-[0.52rem] sm:tracking-[0.14em] lg:text-[0.45rem] xl:text-[0.52rem]">
            National Medical Research Conference
          </span>
        </span>
      )}
    </span>
  );
}

/** The INSPIRE society's crest, for places that speak for the society rather than this year's conference. */
export function SocietyCrest({ className, tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  return (
    <Image
      src={tone === "light" ? "/brand/crest-white.png" : "/brand/crest-navy.png"}
      alt=""
      width={338}
      height={397}
      className={cn("h-10 w-auto shrink-0", className)}
    />
  );
}
