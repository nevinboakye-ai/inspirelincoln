import { cn } from "@/lib/cn";
import type { Sponsor } from "@/lib/types";

/** "Royal College of Physicians and Surgeons of Glasgow" -> "RCPSG". */
function initials(name: string) {
  const skip = new Set(["of", "the", "and", "for", "&"]);
  return name.split(/\s+/).filter((w) => w && !skip.has(w.toLowerCase())).map((w) => w[0]!.toUpperCase()).join("").slice(0, 5);
}

/**
 * A sponsor's logo, or their name set as a quiet wordmark until a logo is
 * uploaded. Logos sit on white so their own colours always read, on light
 * and dark pages alike.
 */
export function SponsorLogo({
  sponsor,
  size = "md",
  className,
}: {
  sponsor: Pick<Sponsor, "name" | "logoUrl">;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const box = {
    xs: "h-6 px-1.5 rounded-[4px]",
    sm: "h-10 px-3 rounded-md",
    md: "h-14 px-4 rounded-lg",
    lg: "h-32 px-6 rounded-xl sm:h-40",
  }[size];
  const img = { xs: "max-h-4 max-w-[4.5rem]", sm: "max-h-7 max-w-[8.5rem]", md: "max-h-10 max-w-[11rem]", lg: "max-h-20 max-w-[85%] sm:max-h-24" }[size];
  const text = {
    xs: "text-[0.45rem] leading-[1.05] max-w-[5rem]",
    sm: "text-[0.7rem] leading-tight max-w-[9rem]",
    md: "text-sm leading-tight max-w-[12rem]",
    lg: "text-xl leading-tight max-w-[18rem] sm:text-2xl",
  }[size];
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center bg-white text-center", box, className)}>
      {sponsor.logoUrl ? (
        // Logos are uploaded by the committee and can be any shape, so they're shown as they are.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={sponsor.logoUrl} alt={sponsor.name} className={cn("w-auto object-contain", img)} loading="lazy" decoding="async" />
      ) : (
        size === "lg" ? (
          // The name is the card's heading right below, so the placeholder shows initials.
          <span aria-hidden className="font-display text-5xl font-semibold tracking-[0.06em] text-navy/80 sm:text-6xl">{initials(sponsor.name)}</span>
        ) : (
          <span className={cn("font-display font-semibold text-navy [text-wrap:balance]", text)}>{sponsor.name}</span>
        )
      )}
    </span>
  );
}
