import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck2, CalendarX2, Download, Hourglass, ListOrdered } from "lucide-react";
import { requireAccess } from "@/lib/auth";
import { loadAttendance, type Answer, type PresenterRow } from "@/lib/admin/attendance";
import { AdminHeader, Flash, Panel, btn } from "@/components/admin/ui";
import { OfferSlotForm } from "@/components/admin/offer-slot-form";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/notice";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Presenter attendance" };
export const dynamic = "force-dynamic";

const when = (d: string) =>
  new Date(d).toLocaleString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

const ANSWER: Record<Answer, { label: string; tone: "success" | "warning" | "neutral" }> = {
  confirmed: { label: "Confirmed", tone: "success" },
  unavailable: { label: "Can't make it", tone: "warning" },
  none: { label: "No reply yet", tone: "neutral" },
};
const TYPE = { oral_presenter: "Oral", poster_presenter: "Poster" } as const;

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ type?: string; answer?: string; offered?: string; mail?: string }> }) {
  const sp = await searchParams;
  const { db } = await requireAccess("review_accounts", "/admin/attendance");
  const { presenters, waitlist } = await loadAttendance(db);

  const type = sp.type === "oral" ? "oral_presenter" : sp.type === "poster" ? "poster_presenter" : null;
  const answer = (["confirmed", "unavailable", "none"] as const).find((a) => a === sp.answer) ?? null;
  const rows = presenters.filter((p) => (!type || p.type === type) && (!answer || p.answer === answer));

  const count = (a: Answer, t?: PresenterRow["type"]) => presenters.filter((p) => p.answer === a && (!t || p.type === t)).length;
  const total = presenters.length;
  const replied = total - count("none");
  const oralGaps = count("unavailable", "oral_presenter");
  const pct = (n: number) => (total ? `${(n / total) * 100}%` : "0%");

  const q = (t: string | null, a: string | null) =>
    `/admin/attendance?${new URLSearchParams({ ...(t ? { type: t } : {}), ...(a ? { answer: a } : {}) })}`;
  const typeKey = sp.type === "oral" || sp.type === "poster" ? sp.type : null;
  const chip = (label: string, href: string, active: boolean) => (
    <Link
      key={label}
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn("flex min-h-11 shrink-0 items-center rounded-[3px] px-4 text-sm font-semibold", active ? "bg-navy text-paper" : "border border-navy/15 bg-white text-ink hover:border-navy/40")}
    >
      {label}
    </Link>
  );

  const tiles = [
    { a: "confirmed" as const, label: "Confirmed", icon: CalendarCheck2, ring: "border-success/25 bg-success/[0.06]", iconCls: "bg-success text-white" },
    { a: "unavailable" as const, label: "Can't make it", icon: CalendarX2, ring: "border-warning/30 bg-warning/[0.07]", iconCls: "bg-warning/20 text-[#7a4a00]" },
    { a: "none" as const, label: "No reply yet", icon: Hourglass, ring: "border-navy/10 bg-white", iconCls: "bg-paper-200 text-navy" },
  ];

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Presenter attendance"
        description="Oral and poster presenters confirm in My Hub whether they'll be there to present. Use this page to see who has replied and to fill any oral slots from the waiting list."
        actions={
          <a href="/admin/attendance/export" className={btn.secondary}>
            <Download aria-hidden className="size-4" /> Download CSV
          </a>
        }
      />

      {sp.offered && (
        <Flash>
          {sp.offered.slice(0, 120)} {sp.offered === "They" ? "are" : "is"} now an oral presenter
          {sp.mail === "sent" ? " and has been emailed." : sp.mail === "off" ? ". Email isn't set up yet, so they weren't emailed." : "."}
        </Flash>
      )}

      <section aria-labelledby="att-summary" className="space-y-4">
        <h2 id="att-summary" className="sr-only">Summary</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {tiles.map(({ a, label, icon: Icon, ring, iconCls }) => (
            <Link
              key={a}
              href={q(typeKey, answer === a ? null : a)}
              aria-current={answer === a ? "page" : undefined}
              className={cn(
                "group flex items-center gap-4 rounded-xl border p-4 transition-shadow hover:shadow-[0_14px_34px_-22px_rgba(14,27,49,0.45)] sm:p-5",
                ring,
                answer === a && "ring-2 ring-navy",
              )}
            >
              <span className={cn("grid size-11 shrink-0 place-items-center rounded-full", iconCls)}>
                <Icon aria-hidden className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block font-display text-3xl leading-none text-ink">{count(a)}</span>
                <span className="mt-1 block text-sm font-semibold text-ink">{label}</span>
                <span className="block text-xs text-slate-700">
                  Oral {count(a, "oral_presenter")} · Poster {count(a, "poster_presenter")}
                </span>
              </span>
            </Link>
          ))}
        </div>
        <div>
          <p className="text-sm text-slate-700">
            <strong className="text-ink">{replied}</strong> of {total} presenters have replied.
          </p>
          <div aria-hidden className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-paper-200">
            <span className="bg-success" style={{ width: pct(count("confirmed")) }} />
            <span className="bg-warning" style={{ width: pct(count("unavailable")) }} />
          </div>
        </div>
      </section>

      {oralGaps > 0 && waitlist.length > 0 && (
        <Notice tone="warning" title={`${oralGaps} oral ${oralGaps === 1 ? "presenter can't" : "presenters can't"} make it`}>
          You can offer {oralGaps === 1 ? "the slot" : "these slots"} to people on the oral waiting list. Start with whoever has been waiting longest.
        </Notice>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
        <section aria-labelledby="att-list" className="min-w-0 space-y-4">
          <h2 id="att-list" className="font-display text-xl font-semibold text-ink">Presenters</h2>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4" aria-label="Filter by presentation type" role="group">
            {chip("Everyone", q(null, answer), !typeKey)}
            {chip("Oral", q("oral", answer), typeKey === "oral")}
            {chip("Poster", q("poster", answer), typeKey === "poster")}
          </div>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4" aria-label="Filter by answer" role="group">
            {chip("Any answer", q(typeKey, null), !answer)}
            {(["confirmed", "unavailable", "none"] as const).map((a) => chip(ANSWER[a].label, q(typeKey, a), answer === a))}
          </div>

          {!rows.length ? (
            <p className="rounded-xl border border-dashed border-navy/20 bg-white p-8 text-center text-slate-700">
              {total ? "Nobody matches these filters." : "There are no oral or poster presenters yet."}
            </p>
          ) : (
            <ul className="divide-y divide-navy/10 overflow-hidden rounded-xl border border-navy/10 bg-white">
              {rows.map((p) => {
                const a = ANSWER[p.answer];
                return (
                  <li key={p.key} className="p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                      <div className="min-w-0">
                        {p.source === "account" ? (
                          <Link href={`/admin/accounts/${p.key}`} className="font-semibold text-ink underline-offset-4 hover:underline">
                            {p.name}
                          </Link>
                        ) : (
                          <span className="font-semibold text-ink">{p.name}</span>
                        )}
                        <p className="text-sm text-slate-700">{[p.institution, p.email].filter(Boolean).join(" · ")}</p>
                      </div>
                      <span className="flex shrink-0 flex-wrap gap-2">
                        <Badge tone="violet">{TYPE[p.type]}</Badge>
                        <Badge tone={a.tone}>{a.label}</Badge>
                      </span>
                    </div>
                    {p.title && <p className="mt-2 text-sm text-ink">{p.title}</p>}
                    {p.note && (
                      <blockquote className="mt-2 border-l-2 border-warning/60 pl-3 text-sm text-slate-700">
                        <span className="sr-only">Their note: </span>
                        {p.note}
                      </blockquote>
                    )}
                    <p className="mt-2 text-xs text-slate">
                      {p.respondedAt
                        ? `Answered ${when(p.respondedAt)}`
                        : p.source === "list"
                          ? "Hasn't logged in yet"
                          : !p.approved
                            ? "Account not approved yet"
                            : "Logged in, hasn't answered"}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <Panel title="Oral waiting list" className="xl:sticky xl:top-28">
          <p className="-mt-2 mb-4 text-sm text-slate-700">
            In the order they were added. Offering a slot makes them an oral presenter, so My Hub asks them to confirm and upload their slides.
          </p>
          {waitlist.length ? (
            <ol className="space-y-3">
              {waitlist.map((w, i) => (
                <li key={`${w.source}-${w.id}`} className="rounded-lg border border-navy/10 p-4">
                  <div className="flex items-start gap-3">
                    <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-navy font-ui text-sm font-semibold text-paper">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-ink">
                        <span className="sr-only">Number {i + 1}: </span>
                        {w.name}
                      </p>
                      {w.institution && <p className="text-sm text-slate-700">{w.institution}</p>}
                      {w.title && <p className="mt-1 text-sm text-ink">{w.title}</p>}
                      {w.source === "list" && <p className="mt-1 text-xs text-slate">Hasn&apos;t logged in yet</p>}
                      <div className="mt-3">
                        <OfferSlotForm id={w.id} source={w.source} name={w.name} />
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="flex items-center gap-2 rounded-lg border border-dashed border-navy/20 p-4 text-sm text-slate-700">
              <ListOrdered aria-hidden className="size-4 shrink-0" /> Nobody is on the oral waiting list.
            </p>
          )}
        </Panel>
      </div>
    </div>
  );
}
