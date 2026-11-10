import type { Metadata } from "next";
import { PageHero } from "@/components/layout/page-hero";
import { getShowcase } from "@/lib/data/content";

export const revalidate = 120;

export const metadata: Metadata = {
  title: "Research showcase",
  description: "Approved student research presented at INSPIRE, published with presenters' consent.",
  alternates: { canonical: "/research/showcase" },
};

export default async function ShowcasePage() {
  const items = await getShowcase();
  const years = [...new Set(items.map((i) => i.year))];
  return (
    <>
      <PageHero eyebrow="Research showcase" title="Student research, shared" intro="Published only with presenter consent and conference team approval." />
      <section className="bg-paper py-16 sm:py-24">
        <div className="container-page">
          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-navy/20 bg-white px-6 py-20 text-center">
              <h2 className="font-display text-2xl font-semibold text-ink">The showcase is being prepared</h2>
              <p className="mx-auto mt-3 max-w-lg text-slate-700">Approved abstracts from INSPIRE presenters who have consented to publication will appear here.</p>
            </div>
          ) : (
            years.map((y) => (
              <div key={y} className="mb-16">
                <h2 className="font-display text-3xl font-semibold text-ink">INSPIRE {y}</h2>
                <ul className="mt-8 grid gap-4 md:grid-cols-2">
                  {items
                    .filter((i) => i.year === y)
                    .map((i) => (
                      <li key={i.id} className="rounded-lg border border-navy/10 bg-white p-6">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-electric-600">{i.category}</p>
                        <h3 className="mt-2 font-display text-xl font-medium text-ink">{i.title}</h3>
                        <p className="mt-1 text-sm text-slate">{i.authors} · {i.university}</p>
                        <p className="mt-4 text-[0.95rem] leading-relaxed text-slate-700">{i.summary}</p>
                      </li>
                    ))}
                </ul>
              </div>
            ))
          )}
        </div>
      </section>
    </>
  );
}
