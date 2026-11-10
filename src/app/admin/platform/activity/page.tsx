import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { requireAccess } from "@/lib/auth";
import { AdminHeader } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/notice";
import { ACCOUNT_STATUS_LABEL, ACCOUNT_TYPE_LABEL, COMMITTEE_TYPES, EXEC_TYPES, SUPPORTING_TYPES, submissionKindFor } from "@/lib/accounts";
import { fullTime, timeAgo } from "@/lib/admin/time-ago";
import type { AccountStatus, AccountType } from "@/lib/types";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Sign-in activity" };
export const dynamic = "force-dynamic";

type Row = {
  id: string;
  email: string;
  full_name: string | null;
  institution: string | null;
  account_type: AccountType;
  account_status: AccountStatus;
  joined_at: string;
  last_sign_in_at: string | null;
  last_seen_at: string | null;
  ever_signed_in: boolean;
};

const GROUPS = {
  all: { label: "Everyone", match: () => true },
  committee: { label: "Committee", match: (r: Row) => COMMITTEE_TYPES.includes(r.account_type) },
  exec: { label: "Executive", match: (r: Row) => EXEC_TYPES.includes(r.account_type) },
  supporting: { label: "Supporting", match: (r: Row) => SUPPORTING_TYPES.includes(r.account_type) },
  presenters: { label: "Presenters", match: (r: Row) => Boolean(submissionKindFor(r.account_type)) },
  delegates: { label: "Delegates", match: (r: Row) => r.account_type === "delegate" || r.account_type === "oral_waitlist" },
} as const;
type Group = keyof typeof GROUPS;

const SORTS = { active: "Last active", signin: "Last signed in", name: "Name", joined: "Newest account" } as const;
type Sort = keyof typeof SORTS;

const MIN = 60_000;

/** Where someone sits, from "online now" to "never signed in". */
function freshness(seen: string | null, now: number) {
  if (!seen) return { label: "Never signed in", dot: "bg-transparent ring-2 ring-inset ring-slate/40", tone: "text-slate" };
  const age = now - Date.parse(seen);
  if (age < 15 * MIN) return { label: "Active now", dot: "bg-success animate-pulse motion-reduce:animate-none", tone: "text-success" };
  if (age < 24 * 60 * MIN) return { label: "Active today", dot: "bg-success", tone: "text-ink" };
  if (age < 7 * 24 * 60 * MIN) return { label: "Active this week", dot: "bg-cyan", tone: "text-ink" };
  return { label: "Not active this week", dot: "bg-slate/40", tone: "text-slate-700" };
}

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ q?: string; group?: string; sort?: string; never?: string }> }) {
  const sp = await searchParams;
  const { db } = await requireAccess("owner", "/admin/platform/activity");
  const { data, error } = await db.rpc("owner_activity");
  // eslint-disable-next-line react-hooks/purity -- a server render, once per request
  const now = Date.now();

  const all = ((data ?? []) as Row[]).filter((r) => r.account_status !== "declined");
  const group: Group = sp.group && sp.group in GROUPS ? (sp.group as Group) : "all";
  const sort: Sort = sp.sort && sp.sort in SORTS ? (sp.sort as Sort) : "active";
  const never = sp.never === "1";
  const term = sp.q?.trim().toLowerCase().slice(0, 80) ?? "";

  const inGroup = all.filter(GROUPS[group].match);
  const rows = inGroup
    .filter((r) => !never || !r.ever_signed_in)
    .filter((r) => !term || `${r.full_name ?? ""} ${r.email} ${r.institution ?? ""}`.toLowerCase().includes(term));
  const time = (v: string | null) => (v ? Date.parse(v) : 0);
  rows.sort((a, b) =>
    sort === "name"
      ? (a.full_name ?? a.email).localeCompare(b.full_name ?? b.email)
      : sort === "joined"
        ? time(b.joined_at) - time(a.joined_at)
        : sort === "signin"
          ? time(b.last_sign_in_at) - time(a.last_sign_in_at)
          : time(b.last_seen_at) - time(a.last_seen_at),
  );

  const within = (ms: number) => inGroup.filter((r) => r.last_seen_at && now - Date.parse(r.last_seen_at) < ms).length;
  const neverCount = inGroup.filter((r) => !r.ever_signed_in).length;
  const signedIn = inGroup.length - neverCount;

  const q = (over: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const cur: Record<string, string | null> = { group: group === "all" ? null : group, sort: sort === "active" ? null : sort, never: never ? "1" : null, q: term || null, ...over };
    for (const [k, v] of Object.entries(cur)) if (v) p.set(k, v);
    const s = p.toString();
    return `/admin/platform/activity${s ? `?${s}` : ""}`;
  };
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
    { label: "Active now", value: within(15 * MIN), note: "In the last 15 minutes" },
    { label: "Active today", value: within(24 * 60 * MIN), note: "In the last 24 hours" },
    { label: "Active this week", value: within(7 * 24 * 60 * MIN), note: "In the last 7 days" },
    { label: "Have signed in", value: signedIn, note: `${neverCount} never have`, href: q({ never: never ? null : "1" }), active: never },
  ];

  return (
    <div className="space-y-6">
      <AdminHeader
        back={{ href: "/admin/platform", label: "Platform dashboard" }}
        title="Sign-in activity"
        description="When each person last signed in and was last active on the website. Only you can see this page."
      />
      {error && <Notice tone="warning" title="Activity isn't set up yet">Run the activity and metrics setup SQL in Supabase, then refresh.</Notice>}

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4" role="group" aria-label="Show">
        {(Object.keys(GROUPS) as Group[]).map((g) => chip(GROUPS[g].label, q({ group: g === "all" ? null : g }), group === g))}
      </div>

      <section aria-labelledby="act-sum">
        <h2 id="act-sum" className="sr-only">Summary for {GROUPS[group].label.toLowerCase()}</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {tiles.map((t) => {
            const inner = (
              <>
                <span className="block text-sm text-slate-700">{t.label}</span>
                <span className="mt-1 block font-display text-4xl leading-none text-ink">{t.value}</span>
                <span className="mt-1.5 block text-xs text-slate">{t.note}</span>
              </>
            );
            return t.href ? (
              <Link key={t.label} href={t.href} aria-current={t.active ? "page" : undefined} className={cn("rounded-xl border border-navy/10 bg-white p-4 transition-shadow hover:shadow-[0_12px_30px_-18px_rgba(14,27,49,0.45)] sm:p-5", t.active && "ring-2 ring-navy")}>
                {inner}
                <span className="mt-2 block text-xs font-semibold text-electric-600">{t.active ? "Show everyone" : "Show who hasn't"}</span>
              </Link>
            ) : (
              <div key={t.label} className="rounded-xl border border-navy/10 bg-white p-4 sm:p-5">{inner}</div>
            );
          })}
        </div>
        {inGroup.length > 0 && (
          <div className="mt-4">
            <div aria-hidden className="flex h-2.5 overflow-hidden rounded-full bg-paper-200">
              <span className="bg-success" style={{ width: `${(signedIn / inGroup.length) * 100}%` }} />
            </div>
            <p className="mt-2 text-sm text-slate-700">
              <strong className="text-ink">{Math.round((signedIn / inGroup.length) * 100)}%</strong> of {GROUPS[group].label.toLowerCase() === "everyone" ? "accounts" : GROUPS[group].label.toLowerCase()} ({signedIn} of {inGroup.length}) have signed in at least once.
            </p>
          </div>
        )}
      </section>

      <form action="/admin/platform/activity" className="flex flex-col gap-3 rounded-xl border border-navy/10 bg-white p-4 sm:flex-row sm:items-end">
        {group !== "all" && <input type="hidden" name="group" value={group} />}
        {never && <input type="hidden" name="never" value="1" />}
        <div className="min-w-0 flex-1">
          <label htmlFor="act-q" className="mb-1.5 block text-sm font-semibold text-ink">Search</label>
          <div className="relative">
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate" />
            <input id="act-q" name="q" type="search" defaultValue={term} placeholder="Name, email or university" className="min-h-11 w-full rounded-md border border-navy/15 bg-white pl-9 pr-3 text-ink focus:border-electric-600 focus:outline-none focus:ring-4 focus:ring-electric/15" />
          </div>
        </div>
        <div>
          <label htmlFor="act-sort" className="mb-1.5 block text-sm font-semibold text-ink">Sort by</label>
          <select id="act-sort" name="sort" defaultValue={sort} className="min-h-11 w-full rounded-md border border-navy/15 bg-white px-3 text-ink focus:border-electric-600 focus:outline-none focus:ring-4 focus:ring-electric/15 sm:w-48">
            {(Object.keys(SORTS) as Sort[]).map((k) => <option key={k} value={k}>{SORTS[k]}</option>)}
          </select>
        </div>
        <button type="submit" className="inline-flex min-h-11 items-center justify-center rounded-[3px] bg-navy px-5 text-sm font-semibold text-paper hover:bg-navy-700">Apply</button>
      </form>

      <p className="text-sm text-slate-700" role="status">
        Showing <strong className="text-ink">{rows.length}</strong> {rows.length === 1 ? "person" : "people"}
        {never ? " who have never signed in" : ""}
        {term ? ` matching "${term}"` : ""}.
      </p>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-navy/20 bg-white p-8 text-center text-slate-700">Nobody matches.</p>
      ) : (
        <ul className="divide-y divide-navy/10 overflow-hidden rounded-xl border border-navy/10 bg-white">
          {rows.map((r) => {
            const f = freshness(r.last_seen_at, now);
            return (
              <li key={r.id} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] sm:items-center sm:gap-5 sm:px-5">
                <div className="flex min-w-0 items-start gap-3">
                  <span aria-hidden className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", f.dot)} />
                  <div className="min-w-0">
                    <Link href={`/admin/platform/people/${r.id}`} className="block truncate font-semibold text-ink underline-offset-4 hover:underline">
                      {r.full_name || r.email}
                    </Link>
                    <p className="truncate text-sm text-slate-700">{r.email}</p>
                    <p className="mt-1.5 flex flex-wrap gap-1.5">
                      <Badge tone={COMMITTEE_TYPES.includes(r.account_type) ? "electric" : "violet"}>{ACCOUNT_TYPE_LABEL[r.account_type]}</Badge>
                      {r.account_status !== "approved" && <Badge tone={ACCOUNT_STATUS_LABEL[r.account_status].tone}>{ACCOUNT_STATUS_LABEL[r.account_status].label}</Badge>}
                    </p>
                  </div>
                </div>
                <div className="pl-5 text-sm sm:pl-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate">Last active</p>
                  {r.last_seen_at ? (
                    <p className={cn("font-medium", f.tone)}>
                      <time dateTime={r.last_seen_at} title={fullTime(r.last_seen_at)}>{timeAgo(r.last_seen_at, now)}</time>
                      <span className="sr-only"> ({f.label})</span>
                    </p>
                  ) : (
                    <p className="text-slate">Never signed in</p>
                  )}
                </div>
                <div className="pl-5 text-sm sm:pl-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate">Last signed in</p>
                  {r.last_sign_in_at ? (
                    <p className="text-ink"><time dateTime={r.last_sign_in_at} title={fullTime(r.last_sign_in_at)}>{timeAgo(r.last_sign_in_at, now)}</time></p>
                  ) : (
                    <p className="text-slate">Never</p>
                  )}
                  <p className="text-xs text-slate">Account made <time dateTime={r.joined_at}>{timeAgo(r.joined_at, now)}</time></p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-slate">
        &quot;Last signed in&quot; is when they last typed their password. &quot;Last active&quot; also counts visits while already signed in, updated every few minutes.
      </p>
    </div>
  );
}
