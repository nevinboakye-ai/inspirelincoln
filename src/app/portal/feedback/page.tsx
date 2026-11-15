import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Award, Hourglass, Sparkles, Target } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { KIND_LABEL, type ReleasedFeedback } from "@/lib/judging";

export const metadata: Metadata = { title: "Judges' feedback" };
export const dynamic = "force-dynamic";

/** A presenter's feedback from the judges, once the committee releases it. */
export default async function FeedbackPage() {
  const { db } = await requireUser("/portal/feedback");
  const { data, error } = await db.rpc("my_judging_feedback");
  const fb = (error ? { released: false } : data) as ReleasedFeedback;
  const items = fb.items ?? [];

  return (
    <div className="space-y-5">
      <Link href="/portal" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" /> My Hub
      </Link>
      <header className="relative overflow-hidden rounded-2xl bg-midnight p-6 text-paper sm:p-8">
        <div aria-hidden className="lanyard-grid pointer-events-none absolute inset-0 opacity-15" />
        <div aria-hidden className="pointer-events-none absolute -right-12 -top-12 size-48 rounded-full bg-gold/25 blur-3xl" />
        <p className="eyebrow relative text-gold">INSPIRE judging panel</p>
        <h1 className="relative mt-2 font-display text-3xl">Your feedback</h1>
        <p className="relative mt-2 max-w-xl text-paper/75">
          Judges marked your presentation on the day and wrote what went well and what to work on next. Use it for your portfolio and your next presentation.
        </p>
      </header>

      {!fb.released ? (
        <section className="rounded-2xl border border-navy/10 bg-white p-6">
          <Hourglass aria-hidden className="size-7 text-electric-600" />
          <h2 className="mt-3 font-display text-xl text-ink">Not released yet</h2>
          <p className="mt-1 text-slate-700">The committee shares judges&apos; feedback after the conference, once prizes have been announced. We&apos;ll let you know when it&apos;s here.</p>
        </section>
      ) : items.length === 0 ? (
        <section className="rounded-2xl border border-navy/10 bg-white p-6">
          <p className="text-slate-700">There&apos;s no judges&apos; feedback for you this year. If you presented and expected some, please contact the committee from Enquiries.</p>
        </section>
      ) : (
        <ol className="space-y-4">
          {items.map((it, i) => (
            <li key={i} className="enter-up overflow-hidden rounded-2xl border border-navy/10 bg-white" style={{ animationDelay: `${i * 80}ms` }}>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-navy/10 bg-paper/60 px-5 py-4">
                <div>
                  <p className="eyebrow text-slate">{KIND_LABEL[it.kind]?.one ?? "Presentation"}</p>
                  <p className="font-display text-lg text-ink">{fb.show_names && it.judge ? it.judge : `Judge ${i + 1}`}</p>
                </div>
                {fb.show_scores && it.total !== null && it.max_total ? (
                  <p className="flex items-center gap-2 font-display text-2xl text-ink">
                    <Award aria-hidden className="size-5 text-gold-600" />
                    {it.total}
                    <span className="text-base text-slate">/{it.max_total}</span>
                  </p>
                ) : null}
              </div>
              <div className="space-y-4 p-5">
                {fb.show_scores && it.scores && it.scores.length > 0 && (
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {it.scores.map((s) => (
                      <li key={s.label} className="rounded-lg bg-paper p-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-700">{s.label}</span>
                          <span className="font-semibold text-ink">
                            {s.score}/{s.max}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-navy/10">
                          <div className="h-full rounded-full bg-gradient-to-r from-electric to-gold" style={{ width: `${(s.score / s.max) * 100}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h3 className="flex items-center gap-2 font-semibold text-ink">
                      <Sparkles aria-hidden className="size-4 text-success" /> What went well
                    </h3>
                    <p className="mt-1.5 whitespace-pre-line leading-relaxed text-slate-700">{it.strengths}</p>
                  </div>
                  <div>
                    <h3 className="flex items-center gap-2 font-semibold text-ink">
                      <Target aria-hidden className="size-4 text-electric-600" /> What to work on
                    </h3>
                    <p className="mt-1.5 whitespace-pre-line leading-relaxed text-slate-700">{it.improvements}</p>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
