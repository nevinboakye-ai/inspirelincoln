import { cn } from "@/lib/cn";
import { uniInitials } from "@/lib/university-logos";

/**
 * A university's logo on a small white tile, or its initials when the
 * committee hasn't added one (only where `fallback` is set). Decorative:
 * the university's name is always written beside it.
 */
export function UniLogo({ src, name, className, fallback = false }: { src?: string | null; name: string | null; className?: string; fallback?: boolean }) {
  if (!name) return null;
  if (src)
    return (
      <span aria-hidden className={cn("grid shrink-0 place-items-center overflow-hidden rounded-md bg-white p-1 ring-1 ring-navy/10", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="max-h-full max-w-full object-contain" loading="lazy" decoding="async" />
      </span>
    );
  if (!fallback) return null;
  return (
    <span aria-hidden className={cn("grid shrink-0 place-items-center rounded-md bg-paper-200 font-ui text-[0.6rem] font-bold tracking-wide text-slate-700 ring-1 ring-navy/10", className)}>
      {uniInitials(name)}
    </span>
  );
}
