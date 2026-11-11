import { Mail, Presentation } from "lucide-react";
import type { ReactNode } from "react";
import { cardRoles, type CardData } from "@/lib/card";
import { Avatar } from "@/components/ui/avatar";
import { InstagramMark } from "@/components/ui/social";
import { instagramUrl } from "@/lib/instagram";
import { cn } from "@/lib/cn";

export function LinkedInMark({ className = "size-4" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z" />
    </svg>
  );
}

/** The colour stripe for someone's most senior role, as on the lanyard. */
export function roleStripe(roles: CardData["roles"]) {
  const attending = ["delegate", "oral_presenter", "poster_presenter", "oral_waitlist"];
  if (roles.some((r) => !attending.includes(r))) return "bg-midnight";
  if (roles.includes("oral_presenter")) return "bg-cyan";
  if (roles.includes("poster_presenter")) return "bg-gold";
  return "bg-navy";
}

/**
 * Someone's Delegate Card details, as shown after scanning their QR code and
 * in People I've met. Only what they've chosen to share is passed in.
 */
export function ContactCard({ card, eyebrow, headingLevel = 1, children, className }: { card: CardData; eyebrow?: ReactNode; headingLevel?: 1 | 2 | 3; children?: ReactNode; className?: string }) {
  const H = `h${headingLevel}` as "h1";
  const roles = cardRoles(card);
  const meta = [card.institution, card.year_of_study].filter(Boolean).join(" · ");
  return (
    <article className={cn("overflow-hidden rounded-2xl border border-navy/10 bg-white shadow-[0_30px_70px_-40px_rgba(12,24,44,0.55)]", className)}>
      <header className="relative overflow-hidden bg-midnight px-6 pb-7 pt-8 text-paper sm:px-8">
        <div aria-hidden className="lanyard-grid pointer-events-none absolute inset-0 opacity-20" />
        <img src="/brand/crest-white.png" alt="" aria-hidden className="pointer-events-none absolute -bottom-8 -right-4 h-36 w-auto opacity-[0.07]" />
        <div className="relative">
          {eyebrow && <p className="eyebrow mb-4 text-gold">{eyebrow}</p>}
          <div className="flex items-center gap-4">
            <Avatar url={card.avatar_url} name={card.full_name} className="size-16 ring-4 ring-white/10 sm:size-20" fallbackClassName="bg-paper/10 text-lg text-gold-300" />
            <div className="min-w-0">
              <H className="font-display text-[1.7rem] leading-tight sm:text-3xl">{card.full_name}</H>
              {meta && <p className="mt-1 text-sm text-paper/75">{meta}</p>}
            </div>
          </div>
          {roles.length > 0 && (
            <ul aria-label={roles.length > 1 ? "Roles" : "Role"} className="mt-5 flex flex-wrap gap-2">
              {roles.map((r) => (
                <li key={r} className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1 font-ui text-xs font-semibold uppercase tracking-[0.14em] text-gold-300">
                  {r}
                </li>
              ))}
            </ul>
          )}
        </div>
      </header>
      <span aria-hidden className={cn("block h-1.5", roleStripe(card.roles))} />
      <dl className="grid gap-5 px-6 py-6 sm:px-8">
        {card.presentation_title && (
          <div>
            <dt className="eyebrow flex items-center gap-1.5 text-slate">
              <Presentation aria-hidden className="size-3.5" /> Presenting
            </dt>
            <dd className="mt-1 font-medium text-ink">{card.presentation_title}</dd>
          </div>
        )}
        <div>
          <dt className="eyebrow text-slate">About</dt>
          <dd className="mt-1 whitespace-pre-line leading-relaxed text-slate-700">{card.bio || "They haven't added a bio yet."}</dd>
        </div>
      </dl>
      {(card.linkedin_url || card.instagram || card.email) && (
        <div className="flex flex-wrap gap-3 border-t border-navy/10 px-6 py-5 sm:px-8">
          {card.instagram && (
            <a href={instagramUrl(card.instagram)} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex min-h-11 items-center gap-2 rounded-[3px] border border-navy/15 px-4 text-sm font-semibold text-ink hover:border-navy/35">
              <InstagramMark /> @{card.instagram}<span className="sr-only"> on Instagram (opens in a new tab)</span>
            </a>
          )}
          {card.linkedin_url && (
            <a href={card.linkedin_url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex min-h-11 items-center gap-2 rounded-[3px] bg-navy px-4 text-sm font-semibold text-paper hover:bg-navy-700">
              <LinkedInMark /> LinkedIn<span className="sr-only"> profile of {card.full_name} (opens in a new tab)</span>
            </a>
          )}
          {card.email && (
            <a href={`mailto:${card.email}`} className="inline-flex min-h-11 min-w-0 max-w-full items-center gap-2 rounded-[3px] border border-navy/15 px-4 text-sm font-semibold text-ink hover:border-navy/35">
              <Mail aria-hidden className="size-4 shrink-0" /> <span className="truncate">{card.email}</span>
            </a>
          )}
        </div>
      )}
      {children}
    </article>
  );
}
