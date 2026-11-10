import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { PlaceholderTag } from "@/components/ui/badge";
import { SaveOpportunity } from "@/components/opportunities/save-opportunity";
import { getOpportunities } from "@/lib/data/content";

export const revalidate = 120;

export async function generateStaticParams() {
  return (await getOpportunities()).map((o) => ({ slug: o.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const o = (await getOpportunities()).find((x) => x.slug === slug);
  return o ? { title: o.title, description: o.summary, alternates: { canonical: `/opportunities/${o.slug}` } } : { title: "Opportunity not found" };
}

export default async function OpportunityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const o = (await getOpportunities()).find((x) => x.slug === slug);
  if (!o) notFound();
  return (
    <article>
      <header className="surface-midnight relative overflow-hidden pb-14 pt-32 sm:pt-40">
        <div aria-hidden className="grid-lines absolute inset-0 opacity-60" />
        <div className="container-narrow relative">
          <Link href="/opportunities" className="inline-flex items-center gap-2 text-sm text-paper/60 hover:text-paper">
            <ArrowLeft aria-hidden className="size-4" /> All opportunities
          </Link>
          <p className="eyebrow mt-8 text-cyan">{o.category}</p>
          <h1 className="mt-4 text-display-md font-normal">{o.title}</h1>
          {o.organisation && <p className="mt-3 text-lg text-paper/70">{o.organisation}</p>}
          {o.isExample && <div className="mt-4"><PlaceholderTag dark>Example listing</PlaceholderTag></div>}
        </div>
      </header>
      <div className="bg-paper py-16">
        <div className="container-narrow">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-navy/10 bg-white p-5">
              <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate">Deadline</dt>
              <dd className="mt-1 text-ink">{o.deadline ? new Intl.DateTimeFormat("en-GB", { dateStyle: "long" }).format(new Date(`${o.deadline}T12:00:00Z`)) : "Rolling / not specified"}</dd>
            </div>
            <div className="rounded-lg border border-navy/10 bg-white p-5">
              <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate">Eligibility</dt>
              <dd className="mt-1 text-ink">{o.eligibility ?? "See the organiser's website"}</dd>
            </div>
          </dl>
          <div className="prose-inspire mt-10">
            {(o.description || o.summary).split(/\n{2,}/).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap gap-3">
            {o.url && (
              <a href={o.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center gap-2 rounded-[3px] bg-navy px-6 font-ui font-semibold text-paper hover:bg-navy-700">
                Apply on the organiser&apos;s site <ExternalLink aria-hidden className="size-4" />
              </a>
            )}
            <SaveOpportunity id={o.id} title={o.title} />
          </div>
        </div>
      </div>
    </article>
  );
}
