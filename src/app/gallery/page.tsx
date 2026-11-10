import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHero } from "@/components/layout/page-hero";
import { Gallery } from "@/components/gallery/gallery";
import { SectionHeading } from "@/components/ui/section-heading";
import { getArchiveEditions, getGallery } from "@/lib/data/content";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Gallery & archive",
  description: "Photographs and highlights from INSPIRE conferences, and an archive of previous years.",
  alternates: { canonical: "/gallery" },
};

export default async function GalleryPage() {
  const [assets, editions] = await Promise.all([getGallery(), getArchiveEditions()]);
  return (
    <>
      <PageHero eyebrow="Gallery & archive" title={<>Moments from <span className="text-cyan">INSPIRE</span></>} intro="Genuine photographs and highlights from INSPIRE conferences, published with permission." />
      <section className="bg-paper py-16 sm:py-24">
        <div className="container-page">
          <Gallery assets={assets} />
        </div>
      </section>
      <section aria-labelledby="archive-title" className="surface-dark py-24">
        <div className="container-page">
          <SectionHeading dark eyebrow="Conference archive" title={<span id="archive-title">INSPIRE through the years</span>} intro="Each conference's theme, host, programme and highlights. Earlier years will be added once verified." />
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {editions.map((e) => (
              <li key={e.id}>
                <Link href={`/archive/${e.year}`} className="group flex h-full flex-col rounded-xl border border-white/10 bg-white/[0.03] p-7 transition-colors hover:border-cyan/40">
                  <span className="font-display text-5xl font-semibold tracking-tight text-paper/90">{e.year}</span>
                  <span className="mt-6 font-display text-lg font-medium">{e.theme}</span>
                  <span className="mt-1 text-sm text-paper/60">{e.hostInstitution ?? e.venueName}</span>
                  <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-cyan">
                    View {e.isCurrent ? "this year" : "archive"} <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
