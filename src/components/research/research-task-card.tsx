import Link from "next/link";
import { ArrowRight, FlaskConical } from "lucide-react";

/**
 * The research study, at the top of My Hub while it is waiting on them:
 * the invitation until they've answered it, then each questionnaire while
 * it's open and not yet done.
 */
export function ResearchTaskCard({ title, detail, href, cta }: { title: string; detail: string; href: string; cta: string }) {
  return (
    <section aria-labelledby="research-task-h" className="relative isolate overflow-hidden rounded-2xl border border-cyan/40 bg-midnight px-4 py-3 text-paper sm:px-5">
      <div aria-hidden className="lanyard-grid pointer-events-none absolute inset-0 opacity-20" />
      <div className="relative flex items-center gap-3">
        <span className="hidden size-10 shrink-0 place-items-center rounded-xl bg-plum/30 text-cyan sm:grid">
          <FlaskConical aria-hidden className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-ui text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-gold-300">Pending task</p>
          <h2 id="research-task-h" className="font-display text-lg leading-tight sm:text-xl">
            {title}
          </h2>
          <p className="mt-0.5 text-xs text-paper/70 sm:text-sm">{detail}</p>
        </div>
        <Link href={href} className="tap inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-gold px-4 font-ui text-sm font-semibold text-midnight">
          {cta} <ArrowRight aria-hidden className="size-4" />
        </Link>
      </div>
    </section>
  );
}
