import type { ReactNode } from "react";
import { PageHero } from "./page-hero";
import { Notice } from "@/components/ui/notice";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <>
      <PageHero eyebrow="Policies" title={title} intro={`Last updated ${updated}`} />
      <section className="bg-paper py-16 sm:py-20">
        <div className="container-narrow">
          <Notice tone="warning" title="Draft for review" className="mb-10">
            This policy is a draft prepared with the website. It must be reviewed and approved by the INSPIRE organisation before it is
            relied upon.
          </Notice>
          <div className="prose-inspire">{children}</div>
        </div>
      </section>
    </>
  );
}
