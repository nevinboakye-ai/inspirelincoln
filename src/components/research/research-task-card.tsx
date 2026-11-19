import Link from "next/link";
import { ArrowRight, FlaskConical } from "lucide-react";

/**
 * The research study, at the top of My Hub while it is waiting on them:
 * the invitation until they've answered it, then each questionnaire while
 * it's open and not yet done.
 */
export function ResearchTaskCard({ title, detail, href, cta }: { title: string; detail: string; href: string; cta: string }) {
  return (
    <section aria-labelledby="research-task-h" className="relative isolate overflow-hidden rounded-2xl border border-cyan/40 bg-midnight px-5 py-5 text-paper sm:px-6">
      <div aria-hidden className="lanyard-grid pointer-events-none absolute inset-0 opacity-20" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-cyan/15 text-cyan">
          <FlaskConical aria-hidden className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="eyebrow text-cyan">Pending task · Research study</p>
          <h2 id="research-task-h" className="mt-1 font-display text-2xl leading-tight">
            {title}
          </h2>
          <p className="mt-1 text-sm text-paper/75">{detail}</p>
        </div>
        <Link href={href} className="tap inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-gold px-5 font-ui text-sm font-semibold text-midnight">
          {cta} <ArrowRight aria-hidden className="size-4" />
        </Link>
      </div>
    </section>
  );
}
