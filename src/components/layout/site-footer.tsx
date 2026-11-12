import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Edition, Sponsor } from "@/lib/types";
import { CONTACT_EMAIL, FOOTER_LINKS, SOCIAL_LINKS } from "@/lib/site";
import { formatEventDate } from "@/lib/time";
import { Logo, SocietyCrest } from "./logo";
import { SponsorLogo } from "@/components/sponsors/sponsor-logo";
import { AuthLink } from "@/components/auth/auth-link";

const linkClass = "inline-flex min-h-10 items-center gap-1 text-paper/75 transition-colors hover:text-paper";

/** A compact footer: who we are, the key links, and the legal small print. */
export function SiteFooter({ edition, siteOpen = true, sponsors = [] }: { edition: Edition; siteOpen?: boolean; sponsors?: Sponsor[] }) {
  const year = new Date().getFullYear();
  const links = siteOpen
    ? [...FOOTER_LINKS.explore.filter((l) => l.href !== "/today"), { label: "Venue & FAQs", href: "/conference" }, { label: "About", href: "/about" }, { label: "Contact", href: "/contact" }]
    : [{ label: "Set up your account", href: "/auth/activate" }, { label: "Register", href: "/signup" }, { label: "Contact", href: "/contact" }];
  return (
    <footer className="site-footer surface-midnight relative pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
      <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
      <div className="container-page py-6 sm:py-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
          <div className="flex items-center gap-4">
            <Logo />
            <p className="hidden border-l border-white/15 pl-4 text-sm leading-snug text-paper/60 md:block">
              {formatEventDate(edition.date)}
              <br />
              {edition.venueName}
            </p>
          </div>
          <nav aria-label="Footer">
            <ul className="flex flex-wrap gap-x-5 text-sm">
              {!siteOpen && (
                <li>
                  <AuthLink className={linkClass} arrow={false} arrowClassName="size-3.5" />
                </li>
              )}
              {links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className={linkClass}>{l.label}</Link>
                </li>
              ))}
              {CONTACT_EMAIL && (
                <li>
                  <a href={`mailto:${CONTACT_EMAIL}`} className={`${linkClass} break-all`}>{CONTACT_EMAIL}</a>
                </li>
              )}
              {SOCIAL_LINKS.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className={linkClass}>
                    {s.label} <ArrowUpRight aria-hidden className="size-3.5" />
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {sponsors.length > 0 && (
          <div className="mt-5 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:gap-5">
            <Link href="/sponsors" className="font-ui text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-paper/60 hover:text-paper">
              Supported by
            </Link>
            <ul className="flex flex-wrap items-center gap-2.5">
              {sponsors.map((s) => (
                <li key={s.id}>
                  <Link href="/sponsors" aria-label={s.name} className="block opacity-90 transition-opacity hover:opacity-100">
                    <SponsorLogo sponsor={s} size="sm" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-2 border-t border-white/10 pt-4 text-xs text-paper/60 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2.5">
            <SocietyCrest className="h-6 opacity-80" />
            <span>© {year} INSPIRE National Medical Research Conference, organised by the INSPIRE society. <span className="whitespace-nowrap">Built by Nevin Boakye.</span></span>
          </p>
          <ul className="flex flex-wrap gap-x-5">
            {FOOTER_LINKS.legal.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="inline-flex min-h-8 items-center hover:text-paper">{l.label}</Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
