import type { Metadata } from "next";
import { PageHero } from "@/components/layout/page-hero";
import { OpportunityHub } from "@/components/opportunities/opportunity-hub";
import { getOpportunities } from "@/lib/data/content";

export const revalidate = 120;

export const metadata: Metadata = {
  title: "Opportunities",
  description: "Research, mentorship, masterclasses, collaborations and presentation opportunities for medical students, curated by INSPIRE.",
  alternates: { canonical: "/opportunities" },
};

export default async function OpportunitiesPage() {
  const items = await getOpportunities();
  return (
    <>
      <PageHero
        eyebrow="Opportunities"
        title={
          <>
            Beyond conference day, <span className="text-cyan">keep going.</span>
          </>
        }
        intro="A growing noticeboard of research, mentorship and learning opportunities for medical students. Every listing links to the organisation that runs it."
      />
      <section className="bg-paper py-16 sm:py-24">
        <div className="container-page">
          <OpportunityHub items={items} />
        </div>
      </section>
    </>
  );
}
