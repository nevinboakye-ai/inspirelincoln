import Image from "next/image";
import { cn } from "@/lib/cn";

function initials(name: string) {
  return name
    .replace(/^(Dr|Prof|Professor|Mr|Mrs|Ms|Miss|Sir|Dame)\.?\s+/i, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

/** Speaker portrait, or a generated monogram when no approved photo exists. */
export function SpeakerPortrait({ name, url, className, sizes = "(min-width: 1024px) 25vw, 50vw", priority = false }: { name: string | null; url: string | null; className?: string; sizes?: string; priority?: boolean }) {
  if (url) {
    return (
      <div className={cn("relative overflow-hidden bg-navy-700", className)}>
        <Image src={url} alt={name ? `Portrait of ${name}` : ""} fill sizes={sizes} priority={priority} className="object-cover grayscale-[30%] transition-[filter,transform] duration-700 group-hover:scale-[1.03] group-hover:grayscale-0" />
      </div>
    );
  }
  return (
    <div className={cn("relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-navy-700 via-navy to-midnight", className)} aria-hidden={!name}>
      <div aria-hidden className="grid-lines absolute inset-0 opacity-70" />
      <svg aria-hidden viewBox="0 0 200 200" className="absolute inset-0 h-full w-full opacity-60">
        <circle cx="100" cy="100" r="70" fill="none" stroke="#C9D8EC" strokeOpacity="0.25" />
        <circle cx="100" cy="100" r="45" fill="none" stroke="#9FB4D4" strokeOpacity="0.3" strokeDasharray="3 5" />
      </svg>
      <span className="relative font-display text-4xl font-semibold tracking-tight text-paper/80">{name ? initials(name) : "?"}</span>
    </div>
  );
}
