import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { SpeakerPortrait } from "@/components/speakers/speaker-portrait";
import { getSessions, getSpeakers } from "@/lib/data/content";
import { SESSION_CATEGORY_LABEL } from "@/lib/types";
import { formatTime } from "@/lib/time";

export const revalidate = 60;

export async function generateStaticParams() {
  return (await getSpeakers()).map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const s = (await getSpeakers()).find((x) => x.slug === slug);
  if (!s) return { title: "Speaker not found" };
  return {
    title: s.fullName,
    description: [s.position, s.institution, s.specialty].filter(Boolean).join(" · ") || `Speaker at INSPIRE`,
    alternates: { canonical: `/speakers/${s.slug}` },
    openGraph: s.portraitUrl ? { images: [s.portraitUrl] } : undefined,
  };
}

export default async function SpeakerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [speakers, sessions] = await Promise.all([getSpeakers(), getSessions()]);
  const s = speakers.find((x) => x.slug === slug);
  if (!s) notFound();
  const theirSessions = sessions.filter((x) => x.speakerIds.includes(s.id));

  return (
    <article>
      <header className="surface-midnight relative overflow-hidden pb-16 pt-32 sm:pt-40">
        <div aria-hidden className="grid-lines absolute inset-0 opacity-60" />
        <div className="container-page relative grid gap-10 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-4">
            <SpeakerPortrait name={s.fullName} url={s.portraitUrl} priority sizes="(min-width: 1024px) 33vw, 100vw" className="aspect-[4/5] rounded-xl" />
          </div>
          <div className="lg:col-span-8">
            <Link href="/speakers" className="inline-flex items-center gap-2 text-sm text-paper/60 hover:text-paper">
              <ArrowLeft aria-hidden className="size-4" /> All speakers
            </Link>
            {s.specialty && <p className="eyebrow mt-8 text-cyan">{s.specialty}</p>}
            <h1 className="mt-4 text-display-lg font-semibold">{s.fullName}</h1>
            {s.credentials && <p className="mt-2 text-lg text-paper/60">{s.credentials}</p>}
            <p className="mt-6 text-xl text-paper/80">{[s.position, s.institution].filter(Boolean).join(", ")}</p>
            {s.links.length > 0 && (
              <ul className="mt-8 flex flex-wrap gap-3">
                {s.links.map((l) => (
                  <li key={l.url}>
                    <a href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/20 px-5 text-sm font-medium hover:border-white/40">
                      {l.label} <ExternalLink aria-hidden className="size-4" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </header>
      <div className="bg-paper py-20">
        <div className="container-page grid gap-12 lg:grid-cols-12">
          <div className="prose-inspire lg:col-span-7">
            <h2>Biography</h2>
            {s.bio ? s.bio.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>) : <p>Biography to follow.</p>}
            {s.researchInterests.length > 0 && (
              <>
                <h2>Research interests</h2>
                <ul>
                  {s.researchInterests.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
          <aside className="lg:col-span-4 lg:col-start-9">
            <h2 className="eyebrow text-electric-600">Sessions</h2>
            {theirSessions.length ? (
              <ul className="mt-4 space-y-3">
                {theirSessions.map((x) => (
                  <li key={x.id}>
                    <Link href={`/programme?session=${x.slug}`} className="block rounded-lg border border-navy/10 bg-white p-5 hover:border-electric-600/40">
                      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate">{SESSION_CATEGORY_LABEL[x.category]}</span>
                      <span className="mt-1 block font-display text-lg font-medium text-ink">{x.title}</span>
                      <span className="mt-1 block text-sm text-slate">{x.startsAt ? formatTime(x.startsAt) : "Time TBC"}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-slate-700">Session details will be added soon.</p>
            )}
          </aside>
        </div>
      </div>
    </article>
  );
}
