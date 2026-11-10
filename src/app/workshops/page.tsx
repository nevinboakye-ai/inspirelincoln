import type { Metadata } from "next";
import { PageHero } from "@/components/layout/page-hero";
import { WorkshopGrid } from "@/components/home/sections";
import { Notice } from "@/components/ui/notice";
import { getWorkshops } from "@/lib/data/content";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Workshops",
  description: "Six interactive, clinician-led workshops: publishing, digital health, evidence-based medicine, portfolios, digital surgery and simulation, and global digital health inequalities.",
  alternates: { canonical: "/workshops" },
};

export default async function WorkshopsPage() {
  const workshops = await getWorkshops();
  return (
    <>
      <PageHero
        eyebrow="Workshops"
        title={
          <>
            Six workshops. <span className="text-cyan">Real skills.</span>
          </>
        }
        intro="Small-group, clinician-led sessions where you practise, question and discuss. Explore each one and save your favourites to your agenda."
        visual={
          <div aria-hidden className="absolute right-0 top-1/2 hidden -translate-y-1/2 grid-cols-3 gap-3 opacity-40 lg:grid" style={{ width: 360 }}>
            {Array.from({ length: 6 }, (_, i) => (
              <span key={i} className="aspect-square rounded-lg border border-cyan/30" style={{ background: i % 2 ? "rgba(159,180,212,0.12)" : "rgba(201,216,236,0.08)" }} />
            ))}
          </div>
        }
      />
      <section className="bg-paper py-16 sm:py-24">
        <div className="container-page">
          <Notice className="mb-10">Facilitators, times and rooms will be confirmed by the conference team. Workshop content may be refined before the day.</Notice>
          <WorkshopGrid workshops={workshops} />
        </div>
      </section>
    </>
  );
}
