import { cn } from "@/lib/cn";

/** INSPIRE wordmark with a node-network glyph. Placeholder until official branding is supplied. */
export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 32 32" aria-hidden className="size-8 shrink-0">
        <defs>
          <linearGradient id="lg-mark" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#39D5F2" />
            <stop offset="1" stopColor="#8578F9" />
          </linearGradient>
        </defs>
        <circle cx="16" cy="16" r="14.5" fill="none" stroke="url(#lg-mark)" strokeOpacity="0.45" strokeWidth="1" />
        <path d="M16 6.5 L16 25.5 M16 11 L8.5 18.5 M16 15 L23.5 10.5 M16 20 L22 23" stroke="url(#lg-mark)" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="16" cy="6.5" r="2.4" fill="#39D5F2" />
        <circle cx="8.5" cy="18.5" r="1.8" fill="#3478F6" />
        <circle cx="23.5" cy="10.5" r="1.8" fill="#8578F9" />
        <circle cx="22" cy="23" r="1.5" fill="#39D5F2" />
        <circle cx="16" cy="25.5" r="1.5" fill="#F7F9FC" />
      </svg>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="font-display text-[1.15rem] font-semibold tracking-[0.14em]">INSPIRE</span>
          <span className="mt-1 hidden text-[0.6rem] font-medium uppercase tracking-[0.2em] opacity-60 sm:block">
            National Medical Research Conference
          </span>
        </span>
      )}
    </span>
  );
}
