import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Download, Eye, EyeOff, Gavel, Lock, Medal, Settings2, Smartphone, Trophy, Unlock, Users } from "lucide-react";
import { requireAccess } from "@/lib/auth";
import { loadJudging, loadMarks } from "@/lib/judging-server";
import { KIND_LABEL, JUDGING_KINDS, MIN_JUDGES, isComplete, isKind, judgesLabel, rankResults, type JudgingKind, type Mark } from "@/lib/judging";
import { AdminHeader, Flash, Panel, btn } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { JudgingUnavailable } from "@/components/judge/judging-unavailable";
import { cn } from "@/lib/cn";
import { closeCompleteMarking, deleteMark, saveJudgingSettings, setMarkingClosed } from "./actions";

export const metadata: Metadata = { title: "Judging" };
export const dynamic = "force-dynamic";

const FLASH: Record<string, string> = {
  settings: "Judging settings saved.",
  mark_removed: "Mark removed.",
  closed_one: "Marking closed for that presenter. Judges can no longer add or change their marks.",
  reopened_one: "Marking reopened for that presenter.",
  closed_complete: "Marking closed for everyone with complete marking.",
};

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/London", weekday: "short", hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" }) : "";
const pct = (n: number | null) => (n === null ? "–" : `${n.toFixed(1)}%`);

function Toggle({ name, label, hint, defaultChecked, icon: Icon }: { name: string; label: string; hint: string; defaultChecked: boolean; icon: typeof Lock }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-navy/10 bg-paper/60 p-4 has-[:checked]:border-navy/30 has-[:checked]:bg-white">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
      <span aria-hidden className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-navy/20 transition-colors peer-checked:bg-success peer-focus-visible:ring-4 peer-focus-visible:ring-electric/20 after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5" />
      <span>
        <span className="flex items-center gap-2 font-semibold text-ink">
          <Icon aria-hidden className="size-4 text-electric-600" /> {label}
        </span>
        <span className="mt-0.5 block text-sm text-slate-700">{hint}</span>
      </span>
    </label>
  );
}

function MarkCard({ m, criteria }: { m: Mark; criteria: { id: string; label: string; maxScore: number }[] }) {
  return (
    <li className="rounded-xl border border-navy/10 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-ink">
          {m.judgeName}
          {m.status === "draft" && <Badge tone="warning" className="ml-2">Draft, not counted</Badge>}
        </p>
        <p className="font-display text-xl text-ink">
          {m.total}
          <span className="text-sm text-slate">/{m.maxTotal}</span>
        </p>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {criteria.map((c) => (
          <span key={c.id} className="rounded-md bg-paper px-2 py-1 text-xs text-slate-700">
            {c.label}: <strong className="text-ink">{m.scores[c.id] ?? "–"}</strong>/{c.maxScore}
          </span>
        ))}
      </div>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-semibold text-ink">What went well</dt>
          <dd className="mt-0.5 whitespace-pre-line text-slate-700">{m.strengths || "–"}</dd>
        </div>
        <div>
          <dt className="font-semibold text-ink">What to improve</dt>
          <dd className="mt-0.5 whitespace-pre-line text-slate-700">{m.improvements || "–"}</dd>
        </div>
        {m.committeeNote && (
          <div className="rounded-lg border border-dashed border-gold/60 bg-gold/10 p-2.5 sm:col-span-2">
            <dt className="font-semibold text-ink">Note for the committee (presenter never sees this)</dt>
            <dd className="mt-0.5 whitespace-pre-line text-slate-700">{m.committeeNote}</dd>
          </div>
        )}
      </dl>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate">
        <span>{m.status === "submitted" ? `Submitted ${when(m.submittedAt)}` : `Last saved ${when(m.updatedAt)}`}</span>
        <details className="group">
          <summary className="cursor-pointer list-none font-semibold text-danger [&::-webkit-details-marker]:hidden">Remove this mark</summary>
          <form action={deleteMark} className="mt-2 flex items-center gap-2">
            <input type="hidden" name="id" value={m.id} />
            <span>This can&apos;t be undone.</span>
            <button type="submit" className="min-h-9 rounded-md bg-danger px-3 font-semibold text-white">Remove</button>
          </form>
        </details>
      </div>
    </li>
  );
}

export default async function JudgingResults({ searchParams }: { searchParams: Promise<{ kind?: string; saved?: string; error?: string }> }) {
  const sp = await searchParams;
  const { db, profile } = await requireAccess("manage_judging", "/admin/judging");
  const j = await loadJudging(db, profile.id);
  if (j.missing || j.failed) return <JudgingUnavailable failed={j.failed} />;
  const marks = await loadMarks(db, j.settings.editionId);
  const { data: judges } = await db.rpc("judging_judges");
  const judgeList = (judges ?? []) as { id: string; full_name: string | null; email: string; kinds: string[]; last_seen_at: string | null }[];

  const kind: JudgingKind = isKind(sp.kind) ? sp.kind : j.entries.some((e) => e.kind === "oral") ? "oral" : "poster";
  const crit = j.criteria.filter((c) => c.kind === kind);
  const results = rankResults(j.entries, marks, j.criteria, kind);
  const byId = new Map(j.entries.map((e) => [`${e.presenterId}:${e.kind}`, e]));
  const submitted = marks.filter((m) => m.status === "submitted");

  const stats = JUDGING_KINDS.map((k) => {
    const entries = j.entries.filter((e) => e.kind === k);
    const count = new Map<string, number>();
    for (const m of submitted) if (m.kind === k) count.set(m.presenterId, (count.get(m.presenterId) ?? 0) + 1);
    const n = (id: string) => count.get(id) ?? 0;
    return {
      k,
      presenters: entries.length,
      marks: submitted.filter((m) => m.kind === k).length,
      complete: entries.filter((e) => isComplete(n(e.presenterId))).length,
      partial: entries.filter((e) => n(e.presenterId) > 0 && !isComplete(n(e.presenterId))).length,
      unmarked: entries.filter((e) => n(e.presenterId) === 0).length,
      closed: entries.filter((e) => e.closed).length,
    };
  });

  return (
    <div>
      <AdminHeader
        title="Judging"
        description="Marks and feedback from the judges. Only people with the “Judging results” permission see this page. Presenters see nothing until you release it."
        actions={
          <>
            <Link href="/judge" className={btn.secondary}>
              <Smartphone aria-hidden className="size-4" /> Judging portal
            </Link>
            <Link href="/admin/judging/setup" className={btn.secondary}>
              <Settings2 aria-hidden className="size-4" /> Set up
            </Link>
            <a href="/admin/judging/export?format=docx" className={btn.secondary}>
              <Download aria-hidden className="size-4" /> Word
            </a>
            <a href="/admin/judging/export" className={btn.primary}>
              <Download aria-hidden className="size-4" /> Results (Excel)
            </a>
          </>
        }
      />
      {sp.saved && FLASH[sp.saved] && <Flash>{FLASH[sp.saved]}</Flash>}
      {sp.error && (
        <p role="alert" className="mb-6 rounded-md border border-danger/25 bg-danger/[0.06] p-4 text-sm font-medium text-danger">
          {sp.error === "view_as"
            ? "You're viewing as someone else, so changes are switched off."
            : sp.error === "needs_sql"
              ? "Closing marking for a presenter needs a database update first. Run supabase/migrations/20261215000000_two_judge_minimum.sql in the Supabase SQL editor, then try again."
              : "That couldn't be saved. Please try again."}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <div key={s.k} className="rounded-xl border border-navy/10 bg-white p-5">
            <p className="eyebrow text-slate">{KIND_LABEL[s.k].many}</p>
            <p className="mt-2 font-display text-3xl text-ink">
              {s.marks} <span className="text-base text-slate">marks</span>
            </p>
            <p className="mt-1 text-sm text-slate-700">
              {s.complete} of {s.presenters} fully marked
              {s.partial ? `, ${s.partial} waiting for more judges` : ""}
              {s.unmarked ? `, ${s.unmarked} not started` : ""}
            </p>
            {s.closed > 0 && <p className="mt-0.5 text-xs text-slate">Marking closed for {s.closed}</p>}
          </div>
        ))}
        <div className="rounded-xl border border-navy/10 bg-white p-5">
          <p className="eyebrow text-slate">Judges</p>
          <p className="mt-2 font-display text-3xl text-ink">{judgeList.length}</p>
          <p className="mt-1 text-sm text-slate-700">{new Set(submitted.map((m) => m.judgeId)).size} have submitted marks</p>
        </div>
        <div className={cn("rounded-xl border p-5", j.settings.released ? "border-success/30 bg-success/[0.06]" : "border-navy/10 bg-white")}>
          <p className="eyebrow text-slate">Feedback</p>
          <p className="mt-2 flex items-center gap-2 font-display text-2xl text-ink">
            {j.settings.released ? <Eye aria-hidden className="size-5 text-success" /> : <EyeOff aria-hidden className="size-5 text-slate" />}
            {j.settings.released ? "Released" : "Hidden"}
          </p>
          <p className="mt-1 text-sm text-slate-700">{j.settings.released ? `Presenters can read it (since ${when(j.settings.releasedAt)})` : "Presenters can't see it yet"}</p>
        </div>
      </div>

      <Panel title="Settings" className="mt-6">
        <form action={saveJudgingSettings} className="space-y-3">
          <div className="grid gap-3 lg:grid-cols-2">
            <Toggle name="open" defaultChecked={j.settings.open} icon={j.settings.open ? Unlock : Lock} label="Judging open" hint="Judges can add and change marks. Switch it off to close marking for everyone at once. To close one presenter, use “Close marking” on their result below." />
            <Toggle name="released" defaultChecked={j.settings.released} icon={Eye} label="Release feedback to presenters" hint="Each presenter sees the submitted feedback on their own presentation in My Hub. Your private notes are never shown." />
            <Toggle name="release_scores" defaultChecked={j.settings.releaseScores} icon={Medal} label="Include the marks" hint="Show each judge's marks for every criterion with their feedback." />
            <Toggle name="release_names" defaultChecked={j.settings.releaseNames} icon={Gavel} label="Include judges' names" hint="Off by default, so feedback reads as from the INSPIRE judging panel." />
          </div>
          <button type="submit" className={btn.primary}>Save settings</button>
        </form>
      </Panel>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-2xl text-ink">
          <Trophy aria-hidden className="size-5 text-gold-600" /> Results
        </h2>
        <div role="tablist" className="flex gap-1 rounded-xl bg-paper-200 p-1">
          {JUDGING_KINDS.map((k) => (
            <Link key={k} role="tab" aria-selected={k === kind} href={`/admin/judging?kind=${k}`} className={cn("min-h-10 rounded-lg px-4 py-2 text-sm font-semibold", k === kind ? "bg-white text-ink shadow-sm" : "text-slate-700")}>
              {KIND_LABEL[k].many}
            </Link>
          ))}
        </div>
      </div>
      <p className="mt-2 text-sm text-slate-700">
        Ranked by each presenter&apos;s average mark across judges, as a percentage. A presenter&apos;s marking is complete once at least {MIN_JUDGES} judges have submitted marks and feedback, and only
        complete presenters are ranked for prizes. Anyone with fewer is listed after them, unranked, with a provisional average. Drafts aren&apos;t counted. A wide spread means judges disagreed, so it
        may be worth a look.
      </p>
      {results.some((r) => r.complete && !byId.get(`${r.presenterId}:${r.kind}`)?.closed) && (
        <form action={closeCompleteMarking} className="mt-3">
          <input type="hidden" name="kind" value={kind} />
          <button type="submit" className={btn.secondary}>
            <Lock aria-hidden className="size-4" /> Close marking for everyone fully marked
          </button>
        </form>
      )}

      {results.length === 0 ? (
        <p className="mt-4 rounded-xl border border-navy/10 bg-white p-6 text-slate-700">No approved {KIND_LABEL[kind].many.toLowerCase()} yet.</p>
      ) : (
        <ol className="mt-4 space-y-2">
          {results.map((r, i) => {
            const e = byId.get(`${r.presenterId}:${r.kind}`);
            const firstPartial = !r.complete && (i === 0 || results[i - 1].complete);
            return (
              <li key={r.presenterId}>
                {firstPartial && (
                  <p className="mb-2 mt-5 flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <Users aria-hidden className="size-4" /> Waiting for at least {MIN_JUDGES} judges: not ranked yet
                  </p>
                )}
                <details className="group rounded-xl border border-navy/10 bg-white open:shadow-[0_14px_34px_-24px_rgba(14,27,49,0.5)]">
                  <summary className="flex cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
                    <span
                      className={cn(
                        "grid size-10 shrink-0 place-items-center rounded-full font-display text-lg",
                        r.rank === 1 ? "bg-gold text-midnight" : r.rank === 2 ? "bg-cyan text-midnight" : r.rank === 3 ? "bg-[#d9b08c] text-midnight" : "bg-paper-200 text-slate-700",
                      )}
                    >
                      {r.rank ?? "–"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-ink">{e?.name}</span>
                        {e?.label && <Badge tone="neutral">{e.label}</Badge>}
                        {!r.complete && <Badge tone="warning">{judgesLabel(r.submitted)}</Badge>}
                        {e?.closed && (
                          <Badge tone="neutral">
                            <Lock aria-hidden className="size-3" /> Marking closed
                          </Badge>
                        )}
                        {r.spread !== null && r.spread >= 20 && (
                          <Badge tone="warning">
                            <AlertTriangle aria-hidden className="size-3" /> Judges differ by {r.spread.toFixed(0)} points
                          </Badge>
                        )}
                      </span>
                      <span className="mt-0.5 line-clamp-1 block text-sm text-slate-700">{e?.title ?? e?.institution ?? ""}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className={cn("block font-display text-xl", r.complete ? "text-ink" : "text-slate")}>{pct(r.average)}</span>
                      <span className="block text-xs text-slate">
                        {r.complete ? judgesLabel(r.submitted) : r.average === null ? "No marks" : "Provisional"}
                        {r.drafts ? ` · ${r.drafts} draft` : ""}
                      </span>
                    </span>
                  </summary>
                  <div className="border-t border-navy/10 p-4">
                    <form action={setMarkingClosed} className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-paper p-3 text-sm">
                      <input type="hidden" name="presenter_id" value={r.presenterId} />
                      <input type="hidden" name="kind" value={r.kind} />
                      <input type="hidden" name="closed" value={e?.closed ? "0" : "1"} />
                      <span className="text-slate-700">
                        {e?.closed
                          ? "Marking is closed. Judges can read their marks but can't add or change any."
                          : r.complete
                            ? `Marking is complete with ${judgesLabel(r.submitted)}. More judges can still mark until you close it.`
                            : `${judgesLabel(r.submitted)} so far. Marking is complete once ${MIN_JUDGES} judges have submitted.`}
                      </span>
                      <button type="submit" className={btn.secondary}>
                        {e?.closed ? <Unlock aria-hidden className="size-4" /> : <Lock aria-hidden className="size-4" />}
                        {e?.closed ? "Reopen marking" : "Close marking"}
                      </button>
                    </form>
                    {crit.length > 0 && r.submitted > 0 && (
                      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {crit.map((c) => {
                          const avg = r.perCriterion[c.id];
                          return (
                            <div key={c.id} className="rounded-lg bg-paper p-3">
                              <div className="flex justify-between text-sm">
                                <span className="text-slate-700">{c.label}</span>
                                <span className="font-semibold text-ink">{avg === undefined ? "–" : avg.toFixed(1)}/{c.maxScore}</span>
                              </div>
                              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-navy/10">
                                <div className="h-full rounded-full bg-electric" style={{ width: `${avg === undefined ? 0 : (avg / c.maxScore) * 100}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {r.marks.length === 0 ? (
                      <p className="text-sm text-slate-700">No judge has marked them yet.</p>
                    ) : (
                      <ul className="space-y-2">
                        {r.marks.map((m) => (
                          <MarkCard key={m.id} m={m} criteria={crit} />
                        ))}
                      </ul>
                    )}
                  </div>
                </details>
              </li>
            );
          })}
        </ol>
      )}

      <Panel title="Judges' progress" className="mt-8">
        {judgeList.length === 0 ? (
          <p className="text-sm text-slate-700">
            No judges yet. Judges sign up with the “Judge” account type and you approve them under Accounts, or add a person&apos;s “Judge presentations” permission on the Platform dashboard.
          </p>
        ) : (
          <ul className="divide-y divide-navy/10">
            {judgeList.map((jd) => {
              const theirs = marks.filter((m) => m.judgeId === jd.id);
              const sub = theirs.filter((m) => m.status === "submitted").length;
              return (
                <li key={jd.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <span className="min-w-0">
                    <span className="block font-semibold text-ink">{jd.full_name ?? jd.email}</span>
                    <span className="block text-xs text-slate">
                      Marks {jd.kinds.map((k) => (isKind(k) ? KIND_LABEL[k].many.toLowerCase() : k)).join(" and ")}
                      {jd.last_seen_at ? ` · last active ${when(jd.last_seen_at)}` : " · not signed in yet"}
                    </span>
                  </span>
                  <span className="flex gap-2">
                    <Badge tone="success">{sub} submitted</Badge>
                    {theirs.length - sub > 0 && <Badge tone="warning">{theirs.length - sub} draft</Badge>}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
