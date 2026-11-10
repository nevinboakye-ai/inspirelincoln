import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/cn";

/** Shown until the first speaker is published in the committee dashboard. */
export function SpeakersSoon({ dark = false, className }: { dark?: boolean; className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-[3px] border px-5 py-8 text-center sm:px-12 sm:py-20", dark ? "border-white/15" : "border-navy/10 bg-white", className)}>
      <img src={dark ? "/brand/crest-white.png" : "/brand/crest-navy.png"} alt="" aria-hidden className="mx-auto h-11 w-auto opacity-90 sm:h-16" />
      <p className={cn("eyebrow mt-4 sm:mt-8", dark ? "text-cyan" : "text-electric-600")}>Speakers</p>
      <h2 className={cn("mt-3 text-display-sm font-normal", dark ? "text-paper" : "text-ink")}>
        Announced <span className="italic">soon</span>
      </h2>
      <p className={cn("mx-auto mt-4 max-w-md leading-relaxed", dark ? "text-paper/75" : "text-slate-700")}>
        We&apos;re confirming this year&apos;s keynote speakers now.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-3 sm:mt-8">
        <Link href="/login" className={cn("inline-flex min-h-12 items-center gap-2 rounded-[3px] px-6 font-ui font-semibold", dark ? "bg-paper text-navy" : "bg-navy text-paper")}>
          Log in <ArrowRight aria-hidden className="size-4" />
        </Link>
        <Link href="/programme" className={cn("inline-flex min-h-12 items-center rounded-[3px] border px-6 font-ui font-semibold", dark ? "border-white/30 text-paper" : "border-navy/15 text-ink")}>
          See the programme
        </Link>
      </div>
    </div>
  );
}
