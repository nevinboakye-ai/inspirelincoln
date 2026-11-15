import type { Metadata } from "next";
import Link from "next/link";
import { ListChecks, MapPin, Mic, Plus, Trash2, UserCog } from "lucide-react";
import { requireAccess } from "@/lib/auth";
import { loadJudging, loadMarks } from "@/lib/judging-server";
import { JUDGING_KINDS, KIND_LABEL, isKind, type JudgingKind } from "@/lib/judging";
import { AdminHeader, Flash, Panel, btn } from "@/components/admin/ui";
import { inputClass } from "@/components/forms/field";
import { JudgingUnavailable } from "@/components/judge/judging-unavailable";
import { deleteCriterion, linkSpeaker, saveCriterion, saveEntries, saveJudgePanel } from "../actions";

export const metadata: Metadata = { title: "Set up judging" };
export const dynamic = "force-dynamic";

const FLASH: Record<string, string> = {
  criteria: "Marking criteria saved.",
  judge: "Judge saved.",
  entries: "Places and order saved.",
  speaker: "Speaker link saved.",
};
const small = "min-h-10 rounded-[3px] border border-navy/15 bg-white px-3 text-sm text-ink";

export default async function JudgingSetup({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const sp = await searchParams;
  const { db, profile } = await requireAccess("manage_judging", "/admin/judging/setup");
  const j = await loadJudging(db, profile.id);
  if (j.missing || j.failed) return <JudgingUnavailable failed={j.failed} />;
  const canLinkSpeakers = profile.access.can.edit_website || profile.access.owner;
  const [marks, { data: judgeRows }, { data: assignRows }, speakerData] = await Promise.all([
    loadMarks(db, j.settings.editionId),
    db.rpc("judging_judges"),
    db.from("judging_assignments").select("judge_id, presenter_id, kind"),
    canLinkSpeakers
      ? Promise.all([db.rpc("speaker_accounts"), db.from("speakers").select("id, full_name, profile_id").order("sort")])
      : Promise.resolve(null),
  ]);
  const judges = (judgeRows ?? []) as { id: string; full_name: string | null; email: string; institution: string | null; kinds: string[] }[];
  const assigned = new Set(((assignRows ?? []) as { judge_id: string; presenter_id: string; kind: string }[]).map((a) => `${a.judge_id}:${a.presenter_id}:${a.kind}`));
  const speakerAccounts = (speakerData?.[0].data ?? []) as { id: string; full_name: string | null; email: string; speaker_id: string | null }[];
  const speakerProfiles = (speakerData?.[1].data ?? []) as { id: string; full_name: string; profile_id: string | null }[];
  const hasMarks = marks.length > 0;

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Set up judging"
        back={{ href: "/admin/judging", label: "Judging results" }}
        description="What judges mark against, who marks whom, and where to find each presentation on the day."
      />
      {sp.saved && FLASH[sp.saved] && <Flash>{FLASH[sp.saved]}</Flash>}
      {sp.error && (
        <p role="alert" className="rounded-md border border-danger/25 bg-danger/[0.06] p-4 text-sm font-medium text-danger">
          {sp.error === "view_as"
            ? "You're viewing as someone else, so changes are switched off."
            : sp.error === "kinds"
              ? "Choose at least one kind of presentation for the judge."
              : sp.error === "criterion"
                ? "Give the criterion a name (2 to 80 characters) and a maximum mark from 1 to 100."
                : "That couldn't be saved. Please try again."}
        </p>
      )}

      <nav aria-label="On this page" className="flex flex-wrap gap-2 text-sm">
        {[
          ["#criteria", "Marking criteria"],
          ["#judges", "Judges"],
          ["#places", "Where to find them"],
          ...(canLinkSpeakers ? [["#speakers", "Speakers"]] : []),
        ].map(([href, label]) => (
          <a key={href} href={href} className="rounded-full border border-navy/15 bg-white px-3 py-1.5 font-medium text-slate-700 hover:border-navy/40">
            {label}
          </a>
        ))}
      </nav>

      <section id="criteria" className="scroll-mt-28">
        <Panel title="Marking criteria">
          <p className="-mt-2 mb-4 flex items-start gap-2 text-sm text-slate-700">
            <ListChecks aria-hidden className="mt-0.5 size-4 shrink-0 text-electric-600" />
            Judges tap a mark for each criterion. Results are averaged as percentages, so criteria can have different maximum marks.
            {hasMarks && " Judges have started marking: changing criteria now means earlier marks won't have a score for new ones."}
          </p>
          <div className="grid gap-6 xl:grid-cols-2">
            {JUDGING_KINDS.map((k) => {
              const list = j.criteria.filter((c) => c.kind === k);
              return (
                <div key={k}>
                  <h3 className="font-display text-lg text-ink">
                    {KIND_LABEL[k].many} <span className="text-sm text-slate">· out of {list.reduce((a, c) => a + c.maxScore, 0)}</span>
                  </h3>
                  <ul className="mt-3 space-y-2">
                    {list.map((c) => (
                      <li key={c.id} className="rounded-xl border border-navy/10 bg-paper/50 p-3">
                        <form action={saveCriterion} className="grid gap-2 sm:grid-cols-[1fr_5rem_4.5rem]">
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="kind" value={k} />
                          <label className="sm:col-span-1">
                            <span className="sr-only">Name</span>
                            <input name="label" defaultValue={c.label} required maxLength={80} className={small + " w-full font-semibold"} />
                          </label>
                          <label className="flex items-center gap-1 text-xs text-slate">
                            out of
                            <input name="max_score" type="number" min={1} max={100} defaultValue={c.maxScore} className={small + " w-full"} />
                          </label>
                          <label className="flex items-center gap-1 text-xs text-slate">
                            #
                            <input name="sort" type="number" min={0} max={999} defaultValue={c.sort} className={small + " w-full"} aria-label="Order" />
                          </label>
                          <label className="sm:col-span-3">
                            <span className="sr-only">What judges look for</span>
                            <textarea name="description" defaultValue={c.description} maxLength={300} rows={2} className={small + " w-full py-2"} />
                          </label>
                          <div className="flex gap-2 sm:col-span-3">
                            <button type="submit" className={btn.secondary + " min-h-10 px-4"}>Save</button>
                            <button type="submit" formAction={deleteCriterion} className={btn.danger + " min-h-10 px-3"} aria-label={`Remove ${c.label}`}>
                              <Trash2 aria-hidden className="size-4" />
                            </button>
                          </div>
                        </form>
                      </li>
                    ))}
                  </ul>
                  <details className="mt-3 rounded-xl border border-dashed border-navy/20 p-3">
                    <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-electric-600">
                      <Plus aria-hidden className="size-4" /> Add a criterion for {KIND_LABEL[k].many.toLowerCase()}
                    </summary>
                    <form action={saveCriterion} className="mt-3 grid gap-2 sm:grid-cols-[1fr_5rem]">
                      <input type="hidden" name="kind" value={k} />
                      <input type="hidden" name="sort" value={list.length + 1} />
                      <input name="label" required maxLength={80} placeholder="e.g. Originality" className={small} />
                      <input name="max_score" type="number" min={1} max={100} defaultValue={10} className={small} aria-label="Out of" />
                      <textarea name="description" maxLength={300} rows={2} placeholder="What judges look for" className={small + " py-2 sm:col-span-2"} />
                      <button type="submit" className={btn.primary + " sm:col-span-2 sm:justify-self-start"}>Add</button>
                    </form>
                  </details>
                </div>
              );
            })}
          </div>
        </Panel>
      </section>

      <section id="judges" className="scroll-mt-28">
        <Panel title="Judges">
          <p className="-mt-2 mb-4 flex items-start gap-2 text-sm text-slate-700">
            <UserCog aria-hidden className="mt-0.5 size-4 shrink-0 text-electric-600" />
            Choose whether each judge marks talks, posters or both. To share presenters out between judges, tick who each judge should mark: they then see only those. Leave all unticked and they see everyone.
          </p>
          {judges.length === 0 ? (
            <p className="text-sm text-slate-700">
              No judges yet. Approve accounts with the “Judge” type under <Link href="/admin/accounts" className="font-semibold text-electric-600 underline">Accounts</Link>.
            </p>
          ) : (
            <ul className="space-y-3">
              {judges.map((jd) => {
                const kinds = jd.kinds.filter(isKind);
                const count = j.entries.filter((e) => assigned.has(`${jd.id}:${e.presenterId}:${e.kind}`)).length;
                return (
                  <li key={jd.id} id={`judge-${jd.id}`} className="scroll-mt-28 rounded-xl border border-navy/10 p-4">
                    <form action={saveJudgePanel}>
                      <input type="hidden" name="judge_id" value={jd.id} />
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-ink">{jd.full_name ?? jd.email}</p>
                          <p className="text-xs text-slate">{[jd.institution, count ? `${count} assigned` : "Sees everyone"].filter(Boolean).join(" · ")}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          {JUDGING_KINDS.map((k) => (
                            <label key={k} className="flex min-h-10 items-center gap-2 text-sm">
                              <input type="checkbox" name="kinds" value={k} defaultChecked={kinds.includes(k)} className="size-5 accent-navy" />
                              {KIND_LABEL[k].many}
                            </label>
                          ))}
                          <button type="submit" className={btn.secondary + " min-h-10"}>Save</button>
                        </div>
                      </div>
                      <details className="mt-2">
                        <summary className="cursor-pointer text-sm font-semibold text-electric-600">Choose who they mark</summary>
                        <div className="mt-3 grid gap-4 md:grid-cols-2">
                          {JUDGING_KINDS.map((k: JudgingKind) => (
                            <fieldset key={k}>
                              <legend className="text-xs font-semibold uppercase tracking-wide text-slate">{KIND_LABEL[k].many}</legend>
                              <div className="mt-1 max-h-72 space-y-1 overflow-y-auto pr-1">
                                {j.entries
                                  .filter((e) => e.kind === k && e.presenterId !== jd.id)
                                  .map((e) => (
                                    <label key={e.presenterId} className="flex min-h-9 items-center gap-2 rounded-md px-2 text-sm hover:bg-paper">
                                      <input type="checkbox" name="assign" value={`${e.presenterId}:${k}`} defaultChecked={assigned.has(`${jd.id}:${e.presenterId}:${k}`)} className="size-4 accent-navy" />
                                      <span className="truncate">
                                        {e.label ? <strong className="mr-1">{e.label}</strong> : null}
                                        {e.name}
                                      </span>
                                    </label>
                                  ))}
                              </div>
                            </fieldset>
                          ))}
                        </div>
                        <button type="submit" className={btn.primary + " mt-3"}>Save who they mark</button>
                      </details>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </section>

      <section id="places" className="scroll-mt-28">
        <Panel title="Where to find each presentation">
          <p className="-mt-2 mb-4 flex items-start gap-2 text-sm text-slate-700">
            <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-electric-600" />
            Shown to judges on every card, for example “Board 12” or “Session 2, 11:05, LMS0008”. The order number sets the order judges see them in (blank or 0 goes last, by name).
          </p>
          {j.entries.length === 0 ? (
            <p className="text-sm text-slate-700">No approved presenters yet.</p>
          ) : (
            <form action={saveEntries}>
              <div className="grid gap-6 xl:grid-cols-2">
                {JUDGING_KINDS.map((k) => (
                  <div key={k}>
                    <h3 className="font-display text-lg text-ink">{KIND_LABEL[k].many}</h3>
                    <ul className="mt-2 divide-y divide-navy/10">
                      {j.entries
                        .filter((e) => e.kind === k)
                        .map((e) => (
                          <li key={e.presenterId} className="grid grid-cols-[1fr_8rem_4rem] items-center gap-2 py-2">
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium text-ink">{e.name}</span>
                              <span className="block truncate text-xs text-slate">{e.title ?? e.institution ?? ""}</span>
                            </span>
                            <input name={`label:${e.presenterId}:${k}`} defaultValue={e.label ?? ""} maxLength={80} placeholder={k === "poster" ? "Board 1" : "Session 1"} aria-label={`Where to find ${e.name}`} className={small} />
                            <input name={`sort:${e.presenterId}:${k}`} type="number" min={0} max={9999} defaultValue={e.sort || ""} aria-label={`Order for ${e.name}`} className={small} />
                          </li>
                        ))}
                    </ul>
                  </div>
                ))}
              </div>
              <button type="submit" className={btn.primary + " mt-4"}>Save places and order</button>
            </form>
          )}
        </Panel>
      </section>

      {canLinkSpeakers && (
        <section id="speakers" className="scroll-mt-28">
          <Panel title="Speaker accounts">
            <p className="-mt-2 mb-4 flex items-start gap-2 text-sm text-slate-700">
              <Mic aria-hidden className="mt-0.5 size-4 shrink-0 text-electric-600" />
              Link each speaker&apos;s account to their speaker profile. They then see their sessions, rooms and times in My Hub and can keep their biography up to date.
            </p>
            {speakerAccounts.length === 0 ? (
              <p className="text-sm text-slate-700">No speaker accounts yet. Speakers sign up with the “Speaker” account type.</p>
            ) : (
              <ul className="divide-y divide-navy/10">
                {speakerAccounts.map((a) => (
                  <li key={a.id} className="py-3">
                    <form action={linkSpeaker} className="flex flex-wrap items-center gap-3">
                      <input type="hidden" name="profile_id" value={a.id} />
                      <span className="min-w-48 flex-1">
                        <span className="block font-medium text-ink">{a.full_name ?? a.email}</span>
                        <span className="block text-xs text-slate">{a.email}</span>
                      </span>
                      <select name="speaker_id" defaultValue={a.speaker_id ?? ""} className={inputClass + " max-w-xs"} aria-label={`Speaker profile for ${a.full_name ?? a.email}`}>
                        <option value="">Not linked</option>
                        {speakerProfiles
                          .filter((s) => !s.profile_id || s.profile_id === a.id)
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.full_name}
                            </option>
                          ))}
                      </select>
                      <button type="submit" className={btn.secondary}>Save</button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </section>
      )}
    </div>
  );
}
