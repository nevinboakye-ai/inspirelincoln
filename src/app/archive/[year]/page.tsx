import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHero } from "@/components/layout/page-hero";
import { Gallery } from "@/components/gallery/gallery";
import { getArchiveEditions, getGallery, getShowcase } from "@/lib/data/content";

export const revalidate = 300;

export async function generateStaticParams() {
  return (await getArchiveEditions()).map((e) => ({ year: String(e.year) }));
}

export async function generateMetadata({ params }: { params: Promise<{ year: string }> }): Promise<Metadata> {
  const { year } = await params;
  return { title: `INSPIRE ${year}`, alternates: { canonical: `/archive/${year}` } };
}

export default async function ArchiveYearPage({ params }: { params: Promise<{ year: string }> }) {
  const { year } = await params;
  const editions = await getArchiveEditions();
  const e = editions.find((x) => String(x.year) === year);
  if (!e) notFound();
  if (e.isCurrent && !e.postEventMode) redirect("/conference");
  const [gallery, showcase] = await Promise.all([getGallery(), getShowcase()]);
  const photos = gallery.filter((g) => g.year === e.year);
  const research = showcase.filter((s) => s.year === e.year);
  return (
    <>
      <PageHero eyebrow={`Archive · ${e.year}`} title={e.theme} intro={`Hosted by ${e.hostInstitution ?? e.venueName}.`}>
        <Link href="/gallery" className="mt-8 inline-flex items-center gap-2 text-sm text-paper/70 hover:text-paper">
          <ArrowLeft aria-hidden className="size-4" /> All years
        </Link>
      </PageHero>
      <section className="bg-paper py-16">
        <div className="container-page space-y-16">
          {e.highlights && (
            <div className="prose-inspire">
              <h2>Highlights</h2>
              {e.highlights.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}
            </div>
          )}
          <div>
            <h2 className="mb-6 font-display text-2xl font-semibold text-ink">Gallery</h2>
            <Gallery assets={photos} />
          </div>
          {research.length > 0 && (
            <div>
              <h2 className="mb-6 font-display text-2xl font-semibold text-ink">Research showcase</h2>
              <ul className="grid gap-4 md:grid-cols-2">
                {research.map((r) => (
                  <li key={r.id} className="rounded-lg border border-navy/10 bg-white p-6">
                    <p className="font-display text-lg font-medium text-ink">{r.title}</p>
                    <p className="text-sm text-slate">{r.authors}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
