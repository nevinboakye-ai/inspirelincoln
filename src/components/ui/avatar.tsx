import { cn } from "@/lib/cn";
import { initials } from "@/lib/card";

/**
 * Someone's profile photo, or their initials when they haven't added one.
 * Decorative: their name is always shown next to it.
 */
export function Avatar({ url, name, className, fallbackClassName }: { url?: string | null; name: string | null; className?: string; fallbackClassName?: string }) {
  if (url) {
    // Signed links to a private folder change each hour, so the image optimiser isn't used.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" aria-hidden className={cn("shrink-0 rounded-full object-cover", className)} />;
  }
  return (
    <span aria-hidden className={cn("grid shrink-0 place-items-center rounded-full font-ui font-semibold", className, fallbackClassName)}>
      {initials(name)}
    </span>
  );
}
