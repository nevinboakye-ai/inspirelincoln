import type { Metadata } from "next";
import { requireAccess } from "@/lib/auth";
import { AdminHeader } from "@/components/admin/ui";
import { INSTRUMENT_VERSION, STAGES, STAGE_LABEL, sectionTitle, sectionsFor, textFor } from "@/lib/research/instrument";
import { STUDY_TITLE, consentStatements, participantInformation } from "@/lib/research/content";
import { getStudySettings } from "@/lib/research/server";

export const metadata: Metadata = { title: "Research questionnaires" };
export const dynamic = "force-dynamic";

/**
 * Everything a participant reads and answers, on one printable page, for
 * the ethics application. Generated from the same definitions as the live
 * questionnaires, so the two can't differ.
 */
export default async function ResearchQuestionnaires() {
  const { db } = await requireAccess("research_data", "/admin/research/questionnaires");
  const { settings } = await getStudySettings(db);
  return (
    <div className="space-y-8 print:space-y-4">
      <AdminHeader
        title="Questionnaires and participant information"
        back={{ href: "/admin/research", label: "Research study" }}
        description={`${STUDY_TITLE}. Questionnaire version ${INSTRUMENT_VERSION}, participant information version ${settings.infoVersion}. Print or save as PDF for the ethics application.`}
      />

      <section className="app-card p-5 sm:p-7 print:break-after-page">
        <h2 className="font-display text-2xl text-ink">Participant information sheet</h2>
        <div className="mt-4 space-y-4 text-sm leading-relaxed text-slate-700">
          {participantInformation(settings).map((s) => (
            <div key={s.heading}>
              <h3 className="font-semibold text-ink">{s.heading}</h3>
              {s.body.map((p) => (
                <p key={p} className="mt-1">
                  {p}
                </p>
              ))}
            </div>
          ))}
        </div>
        <h2 className="mt-8 font-display text-2xl text-ink">Consent form</h2>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-slate-700">
          {consentStatements(settings).map((c) => (
            <li key={c.id}>
              {c.text} {c.required ? <em>(required to take part)</em> : null}
            </li>
          ))}
        </ol>
        <p className="mt-3 text-sm text-slate-700">Buttons: &quot;Take part&quot; and &quot;No thanks&quot;, equally prominent. Declining is recorded so the person isn&apos;t asked again.</p>
      </section>

      {STAGES.map((stage) => {
        const numbers = new Map(sectionsFor(stage).flatMap((s) => s.items).map((it, i) => [it.id, i + 1]));
        return (
          <section key={stage} className="app-card p-5 sm:p-7 print:break-after-page">
            <p className="eyebrow text-slate">{STAGE_LABEL[stage].short} · about {STAGE_LABEL[stage].minutes} minutes</p>
            <h2 className="mt-1 font-display text-2xl text-ink">{STAGE_LABEL[stage].title}</h2>
            {sectionsFor(stage).map((sec) => (
              <div key={sec.id} className="mt-6">
                <h3 className="font-semibold text-ink">
                  {sectionTitle(sec, stage)}
                  {sec.when && <span className="ml-2 text-xs font-normal text-slate">(only if they attended)</span>}
                </h3>
                {sec.intro && <p className="mt-1 text-sm italic text-slate-700">{textFor(sec.intro, stage)}</p>}
                <ol className="mt-2 space-y-3 text-sm">
                  {sec.items.map((it) => {
                    const n = numbers.get(it.id);
                    return (
                      <li key={it.id} className="break-inside-avoid">
                        <p className="text-ink">
                          <span className="font-ui text-slate">{n}. </span>
                          {textFor(it.text, stage)}
                          {it.optional && <span className="text-slate"> (optional)</span>}
                          <span className="ml-2 font-mono text-[0.7rem] text-slate">[{it.id}]</span>
                        </p>
                        <p className="mt-0.5 pl-5 text-slate-700">
                          {it.kind === "scale"
                            ? `${it.min} (${it.minLabel}) to ${it.max} (${it.maxLabel})`
                            : it.kind === "text"
                              ? `Free text, up to ${it.maxLength} characters`
                              : `${it.kind === "multi" ? "Choose all that apply: " : "Choose one: "}${it.options.map((o) => o.label).join(" / ")}`}
                        </p>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}
