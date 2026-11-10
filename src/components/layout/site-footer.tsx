import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Edition } from "@/lib/types";
import { CONTACT_EMAIL, FOOTER_LINKS, SOCIAL_LINKS } from "@/lib/site";
import { formatEventDate } from "@/lib/time";
import { Logo } from "./logo";

export function SiteFooter({ edition }: { edition: Edition }) {
  const year = new Date().getFullYear();
  return (
    <footer className="surface-midnight relative overflow-hidden">
      {/* Signal trace: a restrained nod to physiological monitoring and data. */}
      <svg aria-hidden viewBox="0 0 1440 120" preserveAspectRatio="none" className="absolute inset-x-0 top-0 h-24 w-full text-cyan/25">
        <path
          d="M0 60 H420 L440 60 L452 30 L466 96 L480 18 L494 78 L506 60 H860 L872 60 L880 46 L890 72 L900 60 H1440"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <div className="container-page relative pt-32 pb-10">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Logo />
            <p className="mt-6 max-w-sm leading-relaxed text-paper/65">
              INSPIRE encourages medical students to explore research, develop academically, connect with researchers and
              clinicians, and gain the confidence to contribute to the future of medicine.
            </p>
            <div className="mt-8 rounded-lg border border-white/10 bg-white/[0.03] p-5">
              <p className="eyebrow text-cyan">{edition.name}</p>
              <p className="mt-2 font-display text-lg font-medium">{edition.theme}</p>
              <p className="mt-1 text-sm text-paper/60">
                {formatEventDate(edition.date)} · {edition.venueName}
              </p>
            </div>
          </div>

          <nav aria-label="Footer" className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-7">
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

        <p
          aria-hidden
          className="pointer-events-none mt-20 select-none bg-gradient-to-b from-white/[0.09] to-transparent bg-clip-text text-center font-display text-[22vw] font-bold leading-[0.8] tracking-[-0.06em] text-transparent lg:text-[17rem]"
        >
          INSPIRE
        </p>

        <div className="mt-6 flex flex-col gap-4 border-t border-white/10 pt-8 text-sm text-paper/50 md:flex-row md:items-center md:justify-between">
          <p>© {year} INSPIRE National Medical Research Conference.</p>
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
