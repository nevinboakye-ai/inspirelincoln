import type { ReactNode } from "react";
import { PageHero } from "./page-hero";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <>
      <PageHero eyebrow="Policies" title={title} intro={`Last updated ${updated}`} />
      <section className="bg-paper py-16 sm:py-20">
        <div className="container-narrow">
          <div className="prose-inspire">{children}</div>
        </div>
      </section>
    </>
  );
}
