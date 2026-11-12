import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Gift } from "lucide-react";
import { PageHero } from "@/components/layout/page-hero";
import { Reveal } from "@/components/motion/reveal";
import { SponsorLogo } from "@/components/sponsors/sponsor-logo";
import { getSponsors } from "@/lib/data/content";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Sponsors",
  description: "The organisations supporting the INSPIRE National Medical Research Conference 2026, and what they've given to delegates.",
  alternates: { canonical: "/sponsors" },
};

export default async function SponsorsPage() {
  const sponsors = await getSponsors();
  return (
    <>
      <PageHero
        size="sm"
        eyebrow="Sponsors"
        title={<>With thanks to our <span className="text-cyan">sponsors.</span></>}
        intro="INSPIRE is run by students, for students. These organisations help us keep the conference free to attend and give our delegates something to take home."
        visual={
          // eslint-disable-next-line @next/next/no-img-element -- decorative
          <img src="/brand/conference-mark-white.png" alt="" className="animate-breathe absolute -right-10 top-1/2 hidden h-[115%] w-auto -translate-y-1/3 opacity-[0.06] lg:block" />
        }
      />

      <section aria-labelledby="sponsors-title" className="bg-paper py-14 sm:py-20">
        <div className="container-page">
          <h2 id="sponsors-title" className="sr-only">Our 2026 sponsors</h2>
          {sponsors.length === 0 ? (
            <p className="text-slate-700">Our sponsors will be announced here soon.</p>
          ) : (
            <ul className="grid gap-5 md:grid-cols-2">
              {sponsors.map((s, i) => (
                <li key={s.id} className="flex">
                <Reveal delay={Math.min(i, 3) * 0.08} className="flex w-full flex-col overflow-hidden rounded-2xl border border-navy/10 bg-white">
                  <div className="grid place-items-center border-b border-navy/10 bg-white">
                    <SponsorLogo sponsor={s} size="lg" className="w-full rounded-none" />
                  </div>
                  <div className="flex flex-1 flex-col p-6 sm:p-7">
                    <h3 className="font-display text-2xl leading-tight text-ink">{s.name}</h3>
                    {s.contribution && (
                      <p className="mt-3 flex items-start gap-2.5 rounded-lg bg-gold/10 px-3.5 py-2.5 text-[0.95rem] font-medium text-ink">
                        <Gift aria-hidden className="mt-0.5 size-4 shrink-0 text-gold-700" />
                        <span>{s.contribution}</span>
                      </p>
                    )}
                    {s.description && <p className="mt-4 leading-relaxed text-slate-700">{s.description}</p>}
                    {s.url && (
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="mt-auto inline-flex min-h-11 items-center gap-1 self-start pt-4 font-semibold text-electric-600 underline-offset-4 hover:underline">
                        Visit website <ArrowUpRight aria-hidden className="size-4" />
                        <span className="sr-only"> for {s.name} (opens in a new tab)</span>
                      </a>
                    )}
                  </div>
                </Reveal>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-10 flex flex-col gap-4 rounded-2xl bg-midnight p-7 text-paper sm:flex-row sm:items-center sm:justify-between sm:p-9">
            <div>
              <h2 className="font-display text-2xl">Would your organisation like to support INSPIRE?</h2>
              <p className="mt-2 max-w-xl text-paper/75">We&apos;d love to hear from you. Prizes, resources and materials all make a real difference to our delegates.</p>
            </div>
            <Link href="/contact" className="inline-flex min-h-12 shrink-0 items-center gap-2 self-start rounded-[3px] bg-gold px-5 font-ui font-semibold text-midnight hover:bg-gold-300 sm:self-auto">
              Get in touch <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
