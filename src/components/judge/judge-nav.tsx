"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, LayoutDashboard, ListChecks, ScanLine } from "lucide-react";
import { cn } from "@/lib/cn";

/** The judging portal's own bottom bar: the list, the scanner in the middle, and the way out. */
export function JudgeNav({ results }: { results: boolean }) {
  const path = usePathname();
  const onScan = path.startsWith("/judge/scan");
  const onList = !onScan && path.startsWith("/judge");
  const side = "flex min-h-16 flex-1 flex-col items-center justify-center gap-1 font-ui text-[0.7rem] font-semibold transition-colors";
  return (
    <nav aria-label="Judging" className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-midnight/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl sm:inset-x-auto sm:bottom-4 sm:left-1/2 sm:w-[26rem] sm:-translate-x-1/2 sm:rounded-2xl sm:border sm:pb-0 sm:shadow-[0_18px_40px_-20px_rgba(12,24,44,0.7)]">
      <ul className="mx-auto flex max-w-lg items-stretch">
        <li className="flex flex-1">
          <Link href="/judge" prefetch aria-current={onList ? "page" : undefined} className={cn(side, onList ? "text-gold-300" : "text-paper/75 hover:text-paper")}>
            <ListChecks aria-hidden className="size-5" strokeWidth={onList ? 2.25 : 1.75} />
            To mark
          </Link>
        </li>
        <li className="flex flex-1 justify-center">
          <Link
            href="/judge/scan"
            prefetch
            aria-current={onScan ? "page" : undefined}
            className={cn(
              "-mt-5 mb-1 flex size-[4.25rem] flex-col items-center justify-center gap-0.5 rounded-full border-4 border-paper font-ui text-[0.65rem] font-bold shadow-[0_10px_24px_-10px_rgba(12,24,44,0.8)] transition-transform active:scale-95 sm:border-midnight",
              onScan ? "bg-cyan text-midnight" : "bg-gold text-midnight",
            )}
          >
            <ScanLine aria-hidden className="size-6" />
            Scan
          </Link>
        </li>
        <li className="flex flex-1">
          {results ? (
            <Link href="/admin/judging" prefetch={false} className={cn(side, "text-paper/75 hover:text-paper")}>
              <BarChart3 aria-hidden className="size-5" strokeWidth={1.75} />
              Results
            </Link>
          ) : (
            <Link href="/portal" prefetch={false} className={cn(side, "text-paper/75 hover:text-paper")}>
              <LayoutDashboard aria-hidden className="size-5" strokeWidth={1.75} />
              My Hub
            </Link>
          )}
        </li>
      </ul>
    </nav>
  );
}
