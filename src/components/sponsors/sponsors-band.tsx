import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Sponsor } from "@/lib/types";
import { SponsorLogo } from "./sponsor-logo";

/** A quiet "With thanks to our sponsors" strip for the home page. */
export function SponsorsBand({ sponsors }: { sponsors: Sponsor[] }) {
  if (!sponsors.length) return null;
  return (
    <section aria-labelledby="sponsors-band-title" className="border-y border-navy/10 bg-white py-8 sm:py-10">
      <div className="container-page flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
        <div className="shrink-0">
          <h2 id="sponsors-band-title" className="eyebrow text-electric-600">With thanks to our sponsors</h2>
          <Link href="/sponsors" className="mt-2 inline-flex min-h-11 items-center gap-1.5 font-semibold text-ink underline-offset-4 hover:underline">
            See what they&apos;ve given delegates <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>
        <ul className="flex flex-wrap items-center gap-3 sm:gap-4 lg:justify-end">
          {sponsors.map((s) => (
            <li key={s.id}>
              <Link href="/sponsors" aria-label={s.name} className="block rounded-lg ring-1 ring-navy/10 transition-shadow hover:shadow-md">
                <SponsorLogo sponsor={s} size="md" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
