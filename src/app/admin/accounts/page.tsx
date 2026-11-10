import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Mail } from "lucide-react";
import { requireAccess } from "@/lib/auth";
import { AdminHeader } from "@/components/admin/ui";
import { AccountReviewForm } from "@/components/admin/committee-forms";
import { Badge } from "@/components/ui/badge";
import { ACCOUNT_STATUS_LABEL, ACCOUNT_TYPE_GROUPS, ACCOUNT_TYPE_LABEL, ACCOUNT_TYPES } from "@/lib/accounts";
import type { AccountStatus, AccountType } from "@/lib/types";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Accounts" };
export const dynamic = "force-dynamic";

type Tab = AccountStatus | "all";

const TABS: { status: Tab; label: string }[] = [
  { status: "pending", label: "Awaiting review" },
  { status: "waitlisted", label: "Waitlist" },
  { status: "approved", label: "Approved" },
  { status: "declined", label: "Declined" },
  { status: "all", label: "Everyone" },
];

/** Tabs where each person needs a decision get full cards; the rest get a compact list. */
const DECIDING: Tab[] = ["pending", "waitlisted"];

const when = (d: string) => new Date(d).toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "medium", timeStyle: "short" });

export default async function AccountsPage({ searchParams }: { searchParams: Promise<{ status?: string; type?: string; q?: string }> }) {
  const sp = await searchParams;
  const { db, user, profile } = await requireAccess("review_accounts", "/admin/accounts");
  const status = (TABS.find((t) => t.status === sp.status)?.status ?? "pending") as Tab;
  const type = ACCOUNT_TYPES.includes(sp.type as AccountType) ? (sp.type as AccountType) : null;

  const [{ data: all }, { data: roster }] = await Promise.all([
    db.from("profiles").select("account_status, email").limit(5000),
    db.from("delegate_roster").select("email").limit(5000),
  ]);
  const emails = new Set((all ?? []).map((r) => r.email.toLowerCase()));
  const waiting = (roster ?? []).filter((r) => !emails.has(r.email)).length;
  const counts = Object.fromEntries(TABS.map((t) => [t.status, (all ?? []).filter((r) => t.status === "all" || r.account_status === t.status).length]));

  let q = db
    .from("profiles")
    .select("id, role, email, full_name, institution, programme, career_stage, committee_position, presentation_title, heard_about, account_type, account_status, review_note, reviewed_at, created_at, photo_opt_out")
    .order(DECIDING.includes(status) ? "created_at" : "full_name", { ascending: true })
    .limit(2000);
  if (status !== "all") q = q.eq("account_status", status);
  if (type) q = q.eq("account_type", type);
  const { data } = await q;
  const canEmail = profile.access.can.send_email;
  const term = sp.q?.trim().toLowerCase();
  const rows = (data ?? []).filter((p) => !term || [p.full_name, p.email, p.institution, p.committee_position].some((v) => v?.toLowerCase().includes(term)));

  const href = (s: Tab, t: AccountType | null = type) => `/admin/accounts?status=${s}${t ? `&type=${t}` : ""}`;

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Accounts"
        description="Everyone who registers appears here first. Approving an account confirms their place and switches on presenter or committee access. Select anyone's name to edit their details, change their account or email them."
      />

      <nav aria-label="Account status" className="-mx-4 overflow-x-auto px-4">
        <ul className="flex gap-2">
          {TABS.map((t) => (
            <li key={t.status} className="shrink-0">
              <Link
                href={href(t.status)}
                aria-current={t.status === status ? "page" : undefined}
                className={cn("flex min-h-11 items-center gap-2 rounded-[3px] px-4 text-sm font-semibold", t.status === status ? "bg-navy text-paper" : "border border-navy/15 bg-white text-ink")}
              >
                {t.label} <span className={cn("rounded-full px-2 text-xs", t.status === status ? "bg-white/15" : "bg-paper-200")}>{counts[t.status]}</span>
              </Link>
            </li>
          ))}
          {roster && (
            <li className="shrink-0">
              <Link
                href="/admin/accounts/roster?show=waiting"
                className="flex min-h-11 items-center gap-2 rounded-[3px] border border-dashed border-navy/25 bg-white px-4 text-sm font-semibold text-ink"
              >
                Selected, not set up yet <span className="rounded-full bg-paper-200 px-2 text-xs">{waiting}</span>
              </Link>
            </li>
          )}
        </ul>
      </nav>

      {roster && (
        <p className="text-sm text-slate-700">
          {roster.length} people are on the selected delegate list. They appear here, already approved, once they set up their account.{" "}
          <Link href="/admin/accounts/roster" className="font-semibold text-electric-600 underline underline-offset-4">See the full list</Link>
        </p>
      )}

      <form className="flex flex-wrap gap-2" role="search">
        <input type="hidden" name="status" value={status} />
        <label htmlFor="q" className="sr-only">Search</label>
        <input id="q" name="q" defaultValue={sp.q} placeholder="Search name, email, university" className="min-h-11 min-w-0 flex-1 rounded-[3px] border border-navy/15 bg-white px-4 text-sm" />
        <label htmlFor="type" className="sr-only">Account type</label>
        <select id="type" name="type" defaultValue={type ?? ""} className="min-h-11 rounded-[3px] border border-navy/15 bg-white px-3 text-sm">
          <option value="">All types</option>
          {ACCOUNT_TYPE_GROUPS.map((g) => (
            <optgroup key={g.title} label={g.title}>
              {g.types.map((t) => <option key={t} value={t}>{ACCOUNT_TYPE_LABEL[t]}</option>)}
            </optgroup>
          ))}
        </select>
        <button className="min-h-11 rounded-[3px] border border-navy/15 bg-white px-4 text-sm font-semibold text-ink">Filter</button>
      </form>

      {!rows.length && <p className="rounded-xl border border-dashed border-navy/20 bg-white p-8 text-center text-slate-700">Nobody here right now.</p>}

      {DECIDING.includes(status) ? (
        <ul className="space-y-4">
          {rows.map((p, i) => {
            const t = p.account_type as AccountType;
            const s = ACCOUNT_STATUS_LABEL[p.account_status as AccountStatus];
            return (
              <li key={p.id} className="rounded-xl border border-navy/10 bg-white p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2">
                      {status === "waitlisted" && <span className="font-display text-lg text-slate">#{i + 1}</span>}
                      <Link href={`/admin/accounts/${p.id}`} className="font-display text-xl text-ink underline-offset-4 hover:underline">{p.full_name || "Name not given"}</Link>
                      {p.id === user.id && <span className="text-sm text-slate">(you)</span>}
                    </p>
                    <p className="mt-0.5 break-all text-sm text-slate-700">{p.email}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="violet">{ACCOUNT_TYPE_LABEL[t]}</Badge>
                    <Badge tone={s.tone}>{s.label}</Badge>
                  </div>
                </div>
                <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                  {[
                    ["University", p.institution],
                    ["Stage", p.career_stage],
                    ["Course", p.programme],
                    ["Committee position", p.committee_position],
                    ["Presentation", p.presentation_title],
                    ["Heard about us", p.heard_about],
                    ["Registered", when(p.created_at)],
                    ["Photographs", p.photo_opt_out ? "Prefers not to be photographed" : null],
                  ]
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <div key={k as string} className="min-w-0">
                        <dt className="font-ui text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate">{k}</dt>
                        <dd className="text-ink">{v}</dd>
                      </div>
                    ))}
                </dl>
                {p.review_note && <p className="mt-3 text-sm text-slate-700">Last note: {p.review_note}{p.reviewed_at ? ` (${when(p.reviewed_at)})` : ""}</p>}
                <div className="mt-5 border-t border-navy/10 pt-5">
                  {p.role === "admin" && !profile.access.owner ? (
                    <p className="text-sm text-slate-700">This is the site owner&apos;s account. Only the site owner can change it.</p>
                  ) : (
                    <AccountReviewForm id={p.id} type={t} status={p.account_status as AccountStatus} canLead={profile.access.leadership} name={p.full_name || p.email} />
                  )}
                </div>
                <p className="mt-4 flex flex-wrap gap-x-5 text-sm">
                  <Link href={`/admin/accounts/${p.id}`} className="inline-flex min-h-10 items-center gap-1 font-semibold text-electric-600">
                    Edit details <ArrowRight aria-hidden className="size-4" /><span className="sr-only"> for {p.full_name || p.email}</span>
                  </Link>
                  {canEmail && (
                    <Link href={`/admin/accounts/${p.id}#email`} className="inline-flex min-h-10 items-center gap-1 font-semibold text-electric-600">
                      <Mail aria-hidden className="size-4" /> Email<span className="sr-only"> {p.full_name || p.email}</span>
                    </Link>
                  )}
                </p>
              </li>
            );
          })}
        </ul>
      ) : (
        rows.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-navy/10 bg-white">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <caption className="sr-only">{TABS.find((t) => t.status === status)?.label}, {rows.length} shown. Select a name to see and edit their account.</caption>
              <thead className="border-b border-navy/10 bg-paper text-xs uppercase tracking-wide text-slate">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Name</th>
                  <th scope="col" className="px-4 py-3 font-semibold">University</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Type</th>
                  {status === "all" && <th scope="col" className="px-4 py-3 font-semibold">Status</th>}
                  <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy/5">
                {rows.map((p) => {
                  const s = ACCOUNT_STATUS_LABEL[p.account_status as AccountStatus];
                  return (
                    <tr key={p.id} className="align-top hover:bg-paper/60">
                      <td className="px-4 py-3">
                        <Link href={`/admin/accounts/${p.id}`} className="font-medium text-ink underline-offset-4 hover:underline">
                          {p.full_name || "Name not given"}
                        </Link>
                        {p.id === user.id && <span className="text-slate"> (you)</span>}
                        <span className="block break-all text-xs text-slate">{p.email}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{p.institution}</td>
                      <td className="px-4 py-3">
                        <Badge tone={p.account_type === "delegate" ? "neutral" : "violet"}>{ACCOUNT_TYPE_LABEL[p.account_type as AccountType]}</Badge>
                        {p.committee_position && <span className="mt-1 block text-xs text-slate">{p.committee_position}</span>}
                      </td>
                      {status === "all" && <td className="px-4 py-3"><Badge tone={s.tone}>{s.label}</Badge></td>}
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {canEmail && (
                          <Link href={`/admin/accounts/${p.id}#email`} className="inline-flex min-h-10 items-center gap-1 rounded-[3px] px-3 text-xs font-semibold text-electric-600 hover:bg-paper">
                            <Mail aria-hidden className="size-3.5" /> Email<span className="sr-only"> {p.full_name || p.email}</span>
                          </Link>
                        )}
                        <Link href={`/admin/accounts/${p.id}`} className="inline-flex min-h-10 items-center gap-1 rounded-[3px] px-3 text-xs font-semibold text-ink hover:bg-paper">
                          Open<span className="sr-only"> {p.full_name || p.email}</span> <ArrowRight aria-hidden className="size-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}
