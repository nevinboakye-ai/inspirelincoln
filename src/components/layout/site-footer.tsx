import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Edition } from "@/lib/types";
import { CONTACT_EMAIL, FOOTER_LINKS, SOCIAL_LINKS } from "@/lib/site";
import { formatEventDate } from "@/lib/time";
import { Logo } from "./logo";
import { Parallax } from "@/components/motion/effects";

export function SiteFooter({ edition }: { edition: Edition }) {
  const year = new Date().getFullYear();
  return (
    <footer className="surface-midnight relative overflow-hidden pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
      <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />

      <div className="container-page relative pb-8 pt-10 sm:pb-10 sm:pt-20">
        <div className="grid gap-8 sm:gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Logo />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-paper/65 sm:mt-6 sm:text-base">
              INSPIRE encourages medical students to explore research, develop academically, connect with researchers and
              clinicians, and gain the confidence to contribute to the future of medicine.
            </p>
            <div className="mt-8 hidden rounded-lg border border-white/10 bg-white/[0.03] p-5 sm:block">
              <p className="eyebrow text-cyan">{edition.name}</p>
              <p className="mt-2 font-display text-lg font-medium">{edition.theme}</p>
              <p className="mt-1 text-sm text-paper/60">
                {formatEventDate(edition.date)} · {edition.venueName}
              </p>
            </div>
          </div>

          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-3 sm:gap-8 lg:col-span-7">
            <FooterColumn title="Explore" links={FOOTER_LINKS.explore} />
            <FooterColumn title="Take part" links={FOOTER_LINKS.participate} />
            <div>
              <p className="eyebrow mb-4 text-paper/65">Get in touch</p>
              <ul className="space-y-3 text-[0.95rem]">
                <li>
                  <Link href="/contact" className="link-underline text-paper/80 hover:text-paper">
                    Contact the team
                  </Link>
                </li>
                {CONTACT_EMAIL && (
                  <li>
                    <a href={`mailto:${CONTACT_EMAIL}`} className="link-underline break-all text-paper/80 hover:text-paper">
                      {CONTACT_EMAIL}
                    </a>
                  </li>
                )}
                {SOCIAL_LINKS.map((s) => (
                  <li key={s.url}>
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-paper/80 hover:text-paper">
                      {s.label} <ArrowUpRight aria-hidden className="size-3.5" />
                    </a>
                  </li>
                ))}
                {SOCIAL_LINKS.length === 0 && <li className="text-sm text-paper/65">Social channels will be listed here.</li>}
              </ul>
            </div>
          </nav>
        </div>

        <div aria-hidden className="pointer-events-none mt-20 hidden select-none sm:flex items-end justify-between gap-6 border-t border-white/10 pt-10">
          <Parallax axis="x" distance={40}>
            <svg viewBox="0 0 600 170" className="h-auto w-[62vw] max-w-[760px] text-white/[0.08]">
              <text x="0" y="140" fill="currentColor" className="font-display" fontSize="180" fontStyle="italic" fontWeight="300" letterSpacing="-5">
                Inspire
              </text>
            </svg>
          </Parallax>
          <Image src="/brand/crest-white.png" alt="" width={338} height={397} className="mb-2 hidden h-40 w-auto opacity-25 md:block lg:h-52" />
        </div>

        <div className="mt-8 flex flex-col gap-4 border-t border-white/10 pt-6 sm:pt-8 text-sm text-paper/70 md:flex-row md:items-center md:justify-between">
          <p>© {year} INSPIRE National Medical Research Conference. <span className="whitespace-nowrap">Built by Nevin Boakye.</span></p>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {FOOTER_LINKS.legal.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="hover:text-paper">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <p className="eyebrow mb-4 text-paper/65">{title}</p>
      <ul className="space-y-3 text-[0.95rem]">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="link-underline text-paper/80 hover:text-paper">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
