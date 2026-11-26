import type { Metadata } from "next";
import { PageHero } from "@/components/layout/page-hero";
import { StudentPresenters } from "@/components/speakers/student-presenters";
import { getStudentPresenters } from "@/lib/data/content";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Presenters",
  description: "The medical students who presented their own research as oral and poster presenters at the INSPIRE National Medical Research Conference.",
  alternates: { canonical: "/presenters" },
};

export default async function PresentersPage() {
  const presenters = await getStudentPresenters();
  return (
    <>
      <PageHero
        eyebrow="Presenters"
        title={
          <>
            Our INSPIRE Lincoln 2026 <span className="italic text-gold-300">Student Presenters</span>
          </>
        }
        intro={
          presenters.length
            ? "Medical students selected through our abstract review to present their own research, as talks in the oral presentation sessions and as posters."
            : "This year's presenters will be listed here soon."
        }
        visual={
          <div aria-hidden className="absolute -right-10 bottom-0 hidden h-full w-1/2 lg:block">
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className="absolute rounded-full border border-gold/20" style={{ width: 120 + i * 48, height: 120 + i * 48, right: 80 - i * 24, top: `${28 + i * 3}%` }} />
            ))}
          </div>
        }
      />
      {presenters.length > 0 && <StudentPresenters presenters={presenters} />}
    </>
  );
}
