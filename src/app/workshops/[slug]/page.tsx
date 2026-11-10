import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Clock, MapPin, Target, UserRound, Users } from "lucide-react";
import { WorkshopMotif, ACCENT_HEX } from "@/components/visual/workshop-motif";
import { SaveWorkshopButton } from "@/components/conference/save-workshop";
import { PlaceholderTag } from "@/components/ui/badge";
import { Reveal } from "@/components/motion/reveal";
import { getConferenceBundle, getWorkshops } from "@/lib/data/content";
import { formatTime } from "@/lib/time";

export const revalidate = 60;

export async function generateStaticParams() {
  return (await getWorkshops()).map((w) => ({ slug: w.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const w = (await getWorkshops()).find((x) => x.slug === slug);
  if (!w) return { title: "Workshop not found" };
  return { title: `Workshop ${w.number}: ${w.title}`, description: w.summary, alternates: { canonical: `/workshops/${w.slug}` } };
}

export default async function WorkshopPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { workshops, sessions, rooms } = await getConferenceBundle();
  const w = workshops.find((x) => x.slug === slug);
  if (!w) notFound();
  const session = sessions.find((s) => s.workshopId === w.id);
  const room = session?.roomId ? rooms.find((r) => r.id === session.roomId) : null;
  const idx = workshops.findIndex((x) => x.id === w.id);
  const next = workshops[(idx + 1) % workshops.length];
  const accent = ACCENT_HEX[w.accent];

  return (
    <article>
      <header className="surface-midnight relative isolate overflow-hidden pb-16 pt-32 sm:pt-40">
        <div aria-hidden className="absolute inset-0 -z-10">
          <div className="grid-lines absolute inset-0 opacity-60" />
          <div className="absolute -right-20 top-10 size-[32rem] rounded-full opacity-30 blur-[120px]" style={{ background: accent }} />
        </div>
        <div className="container-page grid gap-10 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-7">
            <Link href="/workshops" className="inline-flex items-center gap-2 text-sm text-paper/60 hover:text-paper">
              <ArrowLeft aria-hidden className="size-4" /> All workshops
            </Link>
            <p className="eyebrow mt-8" style={{ color: accent }}>
              Workshop {String(w.number).padStart(2, "0")}
            </p>
            <h1 className="mt-4 text-display-lg font-semibold">{w.title}</h1>
            <p className="mt-4 font-display text-xl text-paper/70">{w.strapline}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <SaveWorkshopButton id={w.id} title={w.title} />
              {session && (
                <Link href={`/programme?session=${session.slug}`} className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/20 px-6 font-display font-medium hover:border-white/40">
                  View in programme
                </Link>
              )}
            </div>
          </div>
          <div className="group aspect-[3/2] lg:col-span-5">
            <WorkshopMotif motif={w.motif} accent={w.accent} />
          </div>
        </div>
      </header>

      <div className="bg-paper py-20">
        <div className="container-page grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <Reveal>
              <p className="text-xl leading-relaxed text-ink">{w.summary}</p>
              <p className="mt-6 text-lg leading-relaxed text-slate-700">{w.description}</p>
            </Reveal>
            {w.topics.length > 0 && (
              <div className="mt-12">
                <h2 className="eyebrow text-electric-600">Topics may include</h2>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {w.topics.map((t) => (
                    <li key={t} className="rounded-full border border-navy/15 bg-white px-4 py-2 text-sm font-medium text-ink">
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-12">
              <h2 className="flex items-center gap-2 font-display text-2xl font-semibold text-ink">
                <Target aria-hidden className="size-5" style={{ color: accent }} /> Learning outcomes
              </h2>
              <ol className="mt-6 space-y-3">
                {w.outcomes.map((o, i) => (
                  <li key={o} className="flex gap-4 rounded-lg border border-navy/10 bg-white p-5">
                    <span className="font-display text-lg font-semibold" style={{ color: accent === "#39D5F2" ? "#0b6577" : accent === "#3478F6" ? "#1f5fd6" : "#5a4ccf" }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="text-slate-700">{o}</span>
                  </li>
                ))}
              </ol>
            </div>
            {w.notes && (
              <div className="mt-10 rounded-lg border border-dashed border-navy/20 bg-white p-6 text-slate-700">
                <PlaceholderTag>To be confirmed</PlaceholderTag>
                <p className="mt-3">{w.notes}</p>
              </div>
            )}
          </div>

          <aside className="lg:col-span-4 lg:col-start-9">
            <div className="sticky top-28 space-y-4">
              <dl className="divide-y divide-navy/10 rounded-xl border border-navy/10 bg-white">
                {[
                  { icon: Users, label: "Intended audience", value: w.audience || "All delegates" },
                  { icon: UserRound, label: "Facilitator", value: w.facilitator ?? "To be announced" },
                  { icon: Clock, label: "Time", value: session?.startsAt ? `${formatTime(session.startsAt)}${session.endsAt ? ` to ${formatTime(session.endsAt)}` : ""}` : "To be confirmed" },
                  { icon: MapPin, label: "Room", value: room?.name ?? "To be confirmed" },
                  { icon: Users, label: "Capacity", value: w.capacity ? `${w.capacity} places` : "To be confirmed" },
                ].map((d) => (
                  <div key={d.label} className="p-5">
                    <dt className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate">
                      <d.icon aria-hidden className="size-4 shrink-0 text-electric-600" /> {d.label}
                    </dt>
                    <dd className="mt-1 pl-7 text-ink">{d.value}</dd>
                  </div>
                ))}
              </dl>
              {w.facilitatorBio && <p className="rounded-xl border border-navy/10 bg-white p-5 text-sm leading-relaxed text-slate-700">{w.facilitatorBio}</p>}
              <p className="text-sm text-slate">
                {w.bookingEnabled ? "Booking for this workshop is handled by the conference team. Check your My Conference dashboard for details." : "Separate booking is not currently required. Allocation details will be shared by the conference team."}
              </p>
            </div>
          </aside>
        </div>
      </div>

      <Link href={`/workshops/${next.slug}`} className="group surface-dark block py-16">
        <div className="container-page flex items-center justify-between gap-6">
          <div>
            <p className="eyebrow text-cyan">Next workshop</p>
            <p className="mt-3 font-display text-3xl font-semibold sm:text-4xl">{next.title}</p>
          </div>
          <ArrowRight aria-hidden className="size-8 shrink-0 text-cyan transition-transform group-hover:translate-x-2" />
        </div>
      </Link>
    </article>
  );
}
