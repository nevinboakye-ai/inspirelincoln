import Image from "next/image";
import { cn } from "@/lib/cn";

/**
 * The INSPIRE crest with a serif wordmark. `tone` picks the crest artwork:
 * "light" (white crest) for dark backgrounds, "dark" (navy crest) for light ones.
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
        src={tone === "light" ? "/brand/crest-white.png" : "/brand/crest-navy.png"}
        alt=""
        width={338}
        height={397}
        priority
        className="h-10 w-auto shrink-0"
      />
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="font-display text-[1.35rem] font-medium tracking-[0.02em]">Inspire</span>
          <span className="mt-1 hidden font-ui text-[0.58rem] font-semibold uppercase tracking-[0.26em] opacity-70 sm:block">
            Medical Research Conference
          </span>
        </span>
      )}
    </span>
  );
}
