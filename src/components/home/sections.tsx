import Link from "next/link";
import { ArrowRight, CalendarDays, HelpCircle, MapPin, LayoutDashboard } from "lucide-react";
import type { Edition, Workshop } from "@/lib/types";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { LineDraw, SpotlightGroup } from "@/components/motion/effects";
import { WorkshopMotif, ACCENT_HEX } from "@/components/visual/workshop-motif";

/* ---------------- D: At a glance ---------------- */
/** Four doors into the site, sized for thumbs. */
export function AtAGlance({ edition }: { edition: Edition; workshopCount?: number }) {
  const items = [
    { href: "/programme", icon: CalendarDays, title: "Programme", body: "Every session, with times and rooms" },
    { href: "/map", icon: MapPin, title: "Campus map", body: "Find your building and room" },
    { href: "/portal", icon: LayoutDashboard, title: "My Hub", body: "Your presentation, agenda and profile" },
    { href: "/conference", icon: HelpCircle, title: "Venue & FAQs", body: "Travel, access and questions" },
  ];
  return (
    <section aria-labelledby="glance-title" className="bg-paper py-8 sm:py-24">
      <div className="container-page">
        <h2 id="glance-title" className="eyebrow flex items-center gap-3 text-electric-600">
          <LineDraw className="w-8 bg-electric-600/50" /> INSPIRE {edition.year}, sorted
        </h2>
        <SpotlightGroup>
        <Stagger className="mt-5 grid grid-cols-2 gap-2.5 sm:mt-8 sm:gap-3 lg:grid-cols-4">
          {items.map((it) => (
            <StaggerItem key={it.href} className="h-full">
              <Link href={it.href} className="spotlight group flex h-full flex-col items-start gap-3 rounded-[3px] border border-navy/10 bg-white p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5 transition-[transform,border-color,box-shadow] duration-500 ease-[var(--ease-out-expo)] hover:-translate-y-1 hover:border-navy/30 hover:shadow-[0_24px_48px_-28px_rgba(26,49,84,0.45)] lg:flex-col lg:items-start lg:p-7">
                <span className="grid size-11 shrink-0 place-items-center rounded-[3px] bg-navy text-cyan transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:-rotate-6 group-hover:scale-110"><it.icon aria-hidden className="size-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-lg text-ink sm:text-xl">{it.title}</span>
                  <span className="mt-0.5 hidden text-sm text-slate-700 sm:block">{it.body}</span>
                </span>
                <ArrowRight aria-hidden className="hidden size-4 shrink-0 text-slate transition-transform group-hover:translate-x-0.5 sm:block lg:hidden" />
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
        </SpotlightGroup>
      </div>
    </section>
  );
}

export function WorkshopGrid({ workshops, compact = false }: { workshops: Workshop[]; compact?: boolean }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {workshops.map((w, i) => (
        <li key={w.id}>
          <Reveal delay={(i % 3) * 0.08} className="h-full">
            <Link
              href={`/workshops/${w.slug}`}
              className="group relative flex h-full flex-col overflow-hidden rounded-lg border border-navy/10 bg-white transition-[transform,box-shadow,border-color] duration-500 ease-[var(--ease-out-expo)] hover:-translate-y-1.5 hover:border-navy/20 hover:shadow-[0_32px_64px_-32px_rgba(26,49,84,0.45)]"
            >
              <div className="relative h-44 overflow-hidden bg-navy">
                <div aria-hidden className="grid-lines absolute inset-0 opacity-70" />
                <div
                  aria-hidden
                  className="absolute -bottom-16 left-1/2 size-48 -translate-x-1/2 rounded-full opacity-30 blur-3xl transition-opacity duration-500 group-hover:opacity-60"
                  style={{ background: ACCENT_HEX[w.accent] }}
                />
                <WorkshopMotif motif={w.motif} accent={w.accent} className="relative" />
                <span className="absolute left-5 top-4 font-ui text-sm font-medium text-paper/60">Workshop {String(w.number).padStart(2, "0")}</span>
              </div>
              <div className="flex flex-1 flex-col p-6">
                <h3 className="font-display text-xl font-semibold text-ink">{w.title}</h3>
                <p className="mt-2 text-[0.95rem] leading-relaxed text-slate-700">{w.summary}</p>
                {!compact && w.outcomes.length > 0 && (
                  <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-500 ease-[var(--ease-out-expo)] group-hover:grid-rows-[1fr] group-focus-visible:grid-rows-[1fr]">
                    <ul className="overflow-hidden text-sm text-slate-700">
                      <li className="pt-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate">You will</li>
                      {w.outcomes.slice(0, 3).map((o) => (
                        <li key={o} className="mt-2 flex gap-2">
                          <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full" style={{ background: ACCENT_HEX[w.accent] }} />
                          {o}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="mt-auto flex items-center justify-between pt-6">
                  <span className="text-xs text-slate">{w.facilitator ? `Led by ${w.facilitator}` : "Facilitator to be announced"}</span>
                  <span className="inline-flex items-center gap-1.5 font-ui text-sm font-semibold text-electric-600">
                    Explore Workshop <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </div>
            </Link>
          </Reveal>
        </li>
      ))}
    </ul>
  );
}
