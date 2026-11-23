import type { Metadata } from "next";
import Link from "next/link";
import { Download, Eye, MessageSquareQuote, Quote, Star } from "lucide-react";
import { requireAccess } from "@/lib/auth";
import { AdminHeader, Panel, btn } from "@/components/admin/ui";
import { Notice } from "@/components/ui/notice";
import { Badge } from "@/components/ui/badge";
import { BarChart } from "@/components/admin/bar-chart";
import { summarise, type FeedbackRow } from "@/lib/post-conference/feedback";

export const metadata: Metadata = { title: "Conference feedback" };
export const dynamic = "force-dynamic";

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-navy/10 bg-white p-3 sm:p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate">{label}</p>
      <p className="mt-1 font-display text-3xl text-ink">{value}</p>
      {sub && <p className="text-xs text-slate-700">{sub}</p>}
    </div>
  );
}

function Bars({ items, total, tone }: { items: { id: string; label: string; n: number }[]; total: number; tone: string }) {
  const max = Math.max(1, ...items.map((i) => i.n));
  return (
    <ul className="space-y-2">
      {items.map((i) => (
        <li key={i.id}>
          <div className="flex justify-between gap-3 text-sm">
            <span className="text-ink">{i.label}</span>
            <span className="shrink-0 font-semibold tabular-nums text-ink">
              {i.n}
              {total > 0 && <span className="ml-1 font-normal text-slate">{Math.round((i.n / total) * 100)}%</span>}
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-navy/[0.07]">
            <div className={`h-full rounded-full ${tone}`} style={{ width: `${(i.n / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Everyone's conference feedback, without names: the numbers, what people picked, and what they wrote. */
export default async function FeedbackAdmin() {
  const { db } = await requireAccess("view_feedback", "/admin/feedback");
  const { data, error } = await db.rpc("conference_feedback_summary");

  if (error) {
    return (
      <div className="space-y-6">
        <AdminHeader title="Conference feedback" />
        <Notice tone="warning" title="One database step left">
          Run <code>20261223000000_post_conference_feedback_and_gallery.sql</code> in the Supabase SQL editor to add conference feedback.
        </Notice>
      </div>
    );
  }
  const raw = (data ?? { accounts: 0, rows: [] }) as { accounts: number; rows: FeedbackRow[] };
  const s = summarise(raw.rows ?? []);
  const rate = raw.accounts ? Math.round((s.responses / raw.accounts) * 100) : 0;

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Conference feedback"
        description="Everyone with a confirmed place is asked for this when they next open My Hub, and giving it opens the post-conference hub. Answers are shown without names."
        actions={
          <>
            <Link href="/portal/after?form=preview" className={btn.secondary}>
              <Eye aria-hidden className="size-4" /> See the form
            </Link>
            {s.responses > 0 && (
              <a href="/admin/feedback/export" className={btn.primary}>
                <Download aria-hidden className="size-4" /> Download (CSV)
              </a>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Responses" value={String(s.responses)} sub={raw.accounts ? `${rate}% of ${raw.accounts} confirmed accounts` : undefined} />
        <Stat label="Overall" value={s.overallAverage === null ? "–" : `${s.overallAverage}/5`} sub="Average star rating" />
        <Stat label="Net Promoter Score" value={s.nps === null ? "–" : `${s.nps > 0 ? "+" : ""}${s.nps}`} sub="From −100 to +100" />
        <Stat label="Happy to be quoted" value={String(raw.rows.filter((r) => r.quote_ok).length)} sub="Without their name" />
      </div>

      {s.responses === 0 ? (
        <Panel>
          <p className="text-slate-700">No feedback yet. It comes in as people open My Hub.</p>
        </Panel>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Overall rating">
              <ul className="space-y-2">
                {[...s.overall].reverse().map((o) => (
                  <li key={o.value} className="flex items-center gap-3 text-sm">
                    <span className="flex w-24 shrink-0 items-center gap-1 text-ink">
                      {o.value} <Star aria-hidden className="size-3.5 fill-gold text-gold-600" /> <span className="text-slate">{o.label}</span>
                    </span>
                    <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-navy/[0.07]">
                      <span className="block h-full rounded-full bg-gold" style={{ width: `${(o.n / s.responses) * 100}%` }} />
                    </span>
                    <span className="w-8 text-right font-semibold tabular-nums text-ink">{o.n}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-navy/10 pt-3 text-center text-xs">
                {s.groups.map((g) => (
                  <div key={g.group}>
                    <p className="font-semibold text-ink">{g.overallAverage === null ? "–" : `${g.overallAverage}/5`}</p>
                    <p className="text-slate">
                      {g.group} ({g.n})
                    </p>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="Would recommend INSPIRE (0 to 10)">
              <BarChart
                bars={s.recommend.map((r) => ({ key: String(r.value), label: `${r.value} out of 10`, short: String(r.value), value: r.n }))}
                unit="people"
                caption="How likely people are to recommend INSPIRE"
                tickEvery={1}
              />
            </Panel>
          </div>

          <Panel title="Each part of the day">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="text-left text-xs uppercase tracking-wider text-slate">
                  <tr>
                    <th scope="col" className="py-2 pr-3 font-semibold">Part</th>
                    <th scope="col" className="py-2 font-semibold">Great · OK · Poor</th>
                    <th scope="col" className="py-2 pl-3 text-right font-semibold">Rated by</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy/10">
                  {s.parts.map((p) => (
                    <tr key={p.id}>
                      <th scope="row" className="py-2.5 pr-3 text-left font-medium text-ink">
                        {p.label}
                      </th>
                      <td className="py-2.5">
                        {p.n ? (
                          <div className="flex h-3 overflow-hidden rounded-full bg-navy/[0.07]" role="img" aria-label={`${p.great} great, ${p.ok} OK, ${p.poor} poor`}>
                            <span className="bg-teal" style={{ width: `${(p.great / p.n) * 100}%` }} />
                            <span className="bg-gold" style={{ width: `${(p.ok / p.n) * 100}%` }} />
                            <span className="bg-coral" style={{ width: `${(p.poor / p.n) * 100}%` }} />
                          </div>
                        ) : (
                          <span className="text-slate">No ratings</span>
                        )}
                        {p.n > 0 && (
                          <p className="mt-1 text-xs text-slate-700">
                            {p.great} great · {p.ok} OK · {p.poor} poor
                          </p>
                        )}
                      </td>
                      <td className="py-2.5 pl-3 text-right tabular-nums text-ink">{p.n}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="What stood out">
              <Bars items={s.highlights} total={s.responses} tone="bg-teal" />
            </Panel>
            <Panel title="What to change next year">
              <Bars items={s.improvements} total={s.responses} tone="bg-coral" />
            </Panel>
          </div>

          <Panel title={`What people wrote (${s.comments.length})`}>
            {s.comments.length === 0 ? (
              <p className="text-sm text-slate-700">Nobody has written anything yet.</p>
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {s.comments.map((c, i) => (
                  <li key={i} className="rounded-xl border border-navy/10 bg-paper/50 p-3.5">
                    <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge tone={c.kind === "Best bits" ? "success" : c.kind === "To change" ? "warning" : "neutral"}>{c.kind}</Badge>
                      <span className="text-xs text-slate">
                        {c.group} · {c.overall}/5
                      </span>
                      {c.quoteOk && (
                        <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-success">
                          <Quote aria-hidden className="size-3" /> Can quote
                        </span>
                      )}
                    </div>
                    <p className="whitespace-pre-line text-sm text-ink">{c.text}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}
      <p className="flex items-center gap-2 text-xs text-slate">
        <MessageSquareQuote aria-hidden className="size-3.5" /> Shown in a fixed random order, never by who answered or when.
      </p>
    </div>
  );
}
