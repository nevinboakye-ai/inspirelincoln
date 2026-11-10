import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Monitor, Smartphone, Tablet } from "lucide-react";
import { requireAccess } from "@/lib/auth";
import { AdminHeader, Panel } from "@/components/admin/ui";
import { BarChart, type Bar } from "@/components/admin/bar-chart";
import { Notice } from "@/components/ui/notice";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Website metrics" };
export const dynamic = "force-dynamic";

type Metrics = {
  days: number;
  views: number;
  visitors: number;
  single_page: number;
  signed_in_views: number;
  prev_views: number;
  prev_visitors: number;
  live: number;
  series: { day: string; views: number; visitors: number }[];
  hours: { hour: number; views: number }[];
  pages: { path: string; views: number; visitors: number }[];
  referrers: { source: string; visitors: number }[];
  devices: { device: "mobile" | "tablet" | "desktop"; visitors: number }[];
  countries: { country: string; visitors: number }[];
  accounts: { total: number; approved: number; new: number; ever_signed_in: number; active_day: number; active_week: number; signups: { day: string; n: number }[] };
};

const RANGES = [
  { days: 1, label: "Today" },
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
];

const PAGE_NAMES: Record<string, string> = {
  "/": "Home",
  "/about": "About",
  "/programme": "Programme",
  "/speakers": "Speakers",
  "/workshops": "Workshops",
  "/map": "Venue and map",
  "/conference": "Conference",
  "/today": "On the day",
  "/contact": "Contact",
  "/login": "Log in",
  "/signup": "Sign up",
  "/portal": "My Hub",
  "/portal/profile": "My Hub: profile",
  "/portal/submission": "My Hub: submission",
  "/portal/network": "My Hub: delegate network",
  "/privacy": "Privacy notice",
  "/cookies": "Cookie policy",
  "/accessibility": "Accessibility",
  "/terms": "Terms",
};

const n = (v: number) => v.toLocaleString("en-GB");
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const dayLabel = (d: string, opts: Intl.DateTimeFormatOptions) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { timeZone: "Europe/London", ...opts });

function country(code: string) {
  if (code === "--") return "Unknown";
  try {
    return new Intl.DisplayNames(["en-GB"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

function Change({ now, before, days }: { now: number; before: number; days: number }) {
  if (!before) return <span className="text-xs text-slate">{now ? "No earlier data to compare" : " "}</span>;
  const c = Math.round(((now - before) / before) * 100);
  const up = c >= 0;
  // A percentage on a tiny base reads as noise ("up 4000%"), so show the earlier number instead.
  if (before < 20 || Math.abs(c) > 500)
    return <span className="text-xs text-slate">{n(before)} in the {days === 1 ? "day" : `${days} days`} before</span>;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-semibold", up ? "text-success" : "text-[#7a4a00]")}>
      <Icon aria-hidden className="size-3.5" />
      {up ? "Up" : "Down"} {Math.abs(c)}% <span className="font-normal text-slate">on the {days === 1 ? "day" : `${days} days`} before</span>
    </span>
  );
}

function Tile({ label, value, children, hint }: { label: string; value: string; children?: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border border-navy/10 bg-white p-4 sm:p-5">
      <p className="text-sm text-slate-700">{label}</p>
      <p className="mt-1 font-display text-4xl leading-none text-ink tabular-nums">{value}</p>
      <div className="mt-2 min-h-4">{children}</div>
      {hint && <p className="mt-1 text-xs text-slate">{hint}</p>}
    </div>
  );
}

/** Ranked list with a thin magnitude bar under each row. */
function Ranked({ rows, unit, empty }: { rows: { key: string; label: React.ReactNode; value: number; sub?: string }[]; unit: string; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="text-sm text-slate-700">{empty}</p>;
  return (
    <ol className="space-y-3">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-ink">{r.label}</span>
            <span className="shrink-0 tabular-nums text-ink">
              <strong>{n(r.value)}</strong> <span className="sr-only">{unit}</span>
              {r.sub && <span className="ml-1 text-xs text-slate">{r.sub}</span>}
            </span>
          </div>
          <div aria-hidden className="mt-1 h-1.5 rounded-full bg-paper-200">
            <div className="h-1.5 rounded-full bg-navy" style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ol>
  );
}

export default async function MetricsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const sp = await searchParams;
  const { db } = await requireAccess("owner", "/admin/platform/metrics");
  const days = RANGES.find((r) => String(r.days) === sp.days)?.days ?? 30;
  const { data, error } = await db.rpc("owner_metrics", { p_days: days });
  const m = data as Metrics | null;

  const header = (
    <AdminHeader
      back={{ href: "/admin/platform", label: "Platform dashboard" }}
      title="Website metrics"
      description="How many people visit the website, what they look at and where they come from. Only you can see this page."
    />
  );
  if (error || !m) {
    return (
      <div className="space-y-6">
        {header}
        <Notice tone="warning" title="Metrics aren't set up yet">Run the activity and metrics setup SQL in Supabase, then refresh. Visits are counted from then on.</Notice>
      </div>
    );
  }

  const range = RANGES.find((r) => r.days === days)!;
  const perVisit = m.visitors ? (m.views / m.visitors).toFixed(1) : "0";
  const series: Bar[] = m.series.map((s) => ({
    key: s.day,
    label: dayLabel(s.day, { weekday: "long", day: "numeric", month: "long" }),
    short: dayLabel(s.day, days > 7 ? { day: "numeric", month: "short" } : { weekday: "short" }),
    value: s.visitors,
    detail: `${n(s.views)} page ${s.views === 1 ? "view" : "views"}`,
  }));
  const hourMap = new Map(m.hours.map((h) => [h.hour, h.views]));
  const hours: Bar[] = Array.from({ length: 24 }, (_, h) => ({
    key: String(h),
    label: `${String(h).padStart(2, "0")}:00 to ${String(h).padStart(2, "0")}:59`,
    short: String(h).padStart(2, "0"),
    value: hourMap.get(h) ?? 0,
  }));
  const signups: Bar[] = m.accounts.signups.map((s) => ({
    key: s.day,
    label: dayLabel(s.day, { weekday: "long", day: "numeric", month: "long" }),
    short: dayLabel(s.day, days > 7 ? { day: "numeric", month: "short" } : { weekday: "short" }),
    value: s.n,
  }));
  const deviceTotal = m.devices.reduce((a, d) => a + d.visitors, 0);
  const DEVICE = { mobile: { label: "Phone", icon: Smartphone }, tablet: { label: "Tablet", icon: Tablet }, desktop: { label: "Computer", icon: Monitor } };

  return (
    <div className="space-y-6">
      {header}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4" role="group" aria-label="Time period">
          {RANGES.map((r) => (
            <Link
              key={r.days}
              href={`/admin/platform/metrics?days=${r.days}`}
              aria-current={r.days === days ? "page" : undefined}
              className={cn("flex min-h-11 shrink-0 items-center rounded-[3px] px-4 text-sm font-semibold", r.days === days ? "bg-navy text-paper" : "border border-navy/15 bg-white text-ink hover:border-navy/40")}
            >
              {r.label}
            </Link>
          ))}
        </div>
        <p className="flex items-center gap-2 rounded-full border border-success/25 bg-success/[0.06] px-3 py-1.5 text-sm text-ink">
          <span aria-hidden className="size-2 rounded-full bg-success motion-safe:animate-pulse" />
          <strong>{n(m.live)}</strong> {m.live === 1 ? "visitor" : "visitors"} in the last 30 minutes
        </p>
      </div>

      <section aria-labelledby="m-head" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <h2 id="m-head" className="sr-only">Headline numbers, {range.label.toLowerCase()}</h2>
        <Tile label="Visitors" value={n(m.visitors)}><Change now={m.visitors} before={m.prev_visitors} days={days} /></Tile>
        <Tile label="Page views" value={n(m.views)}><Change now={m.views} before={m.prev_views} days={days} /></Tile>
        <Tile label="Pages per visit" value={perVisit} hint="Average pages each visitor looked at in a day" />
        <Tile label="Left after one page" value={`${pct(m.single_page, m.visitors)}%`} hint={`${n(m.single_page)} of ${n(m.visitors)} visits`} />
      </section>

      <Panel title={days === 1 ? "Visitors today" : "Visitors per day"}>
        {m.views === 0 ? (
          <p className="text-sm text-slate-700">No visits counted in this period yet. Counting starts once the setup SQL has been run.</p>
        ) : days === 1 ? (
          <BarChart bars={hours} unit="page views" caption="Page views by hour today, UK time" tickEvery={3} />
        ) : (
          <BarChart bars={series} unit="visitors" caption={`Visitors per day, last ${days} days`} />
        )}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Most viewed pages">
          <Ranked
            unit="page views"
            empty="No page views yet."
            rows={m.pages.map((p) => ({
              key: p.path,
              label: (
                <>
                  {PAGE_NAMES[p.path] ?? p.path}
                  {PAGE_NAMES[p.path] && <span className="ml-2 text-xs text-slate">{p.path}</span>}
                </>
              ),
              value: p.views,
              sub: `${n(p.visitors)} ${p.visitors === 1 ? "visitor" : "visitors"}`,
            }))}
          />
        </Panel>
        <Panel title="Where visitors come from">
          <Ranked
            unit="visitors"
            empty="No visits yet."
            rows={m.referrers.map((r) => ({ key: r.source, label: r.source, value: r.visitors }))}
          />
          <p className="mt-4 text-xs text-slate">&quot;Direct or unknown&quot; covers typed links, bookmarks, emails and apps that don&apos;t say where the visitor came from.</p>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Devices">
          {deviceTotal ? (
            <>
              <div aria-hidden className="flex h-3 gap-[2px] overflow-hidden rounded-full">
                {m.devices.map((d) => (
                  <span key={d.device} className={cn(d.device === "mobile" ? "bg-navy" : d.device === "desktop" ? "bg-electric-600" : "bg-cyan")} style={{ width: `${(d.visitors / deviceTotal) * 100}%` }} />
                ))}
              </div>
              <ul className="mt-4 space-y-2.5">
                {m.devices.map((d) => {
                  const D = DEVICE[d.device];
                  return (
                    <li key={d.device} className="flex items-center gap-3 text-sm">
                      <span aria-hidden className={cn("size-2.5 rounded-full", d.device === "mobile" ? "bg-navy" : d.device === "desktop" ? "bg-electric-600" : "bg-cyan")} />
                      <D.icon aria-hidden className="size-4 text-slate" />
                      <span className="flex-1 text-ink">{D.label}</span>
                      <span className="tabular-nums text-ink"><strong>{pct(d.visitors, deviceTotal)}%</strong> <span className="text-xs text-slate">({n(d.visitors)})</span></span>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <p className="text-sm text-slate-700">No visits yet.</p>
          )}
        </Panel>
        <Panel title="Countries">
          <Ranked unit="visitors" empty="No visits yet." rows={m.countries.map((c) => ({ key: c.country, label: country(c.country), value: c.visitors }))} />
        </Panel>
        <Panel title="Busiest times">
          {m.views ? <BarChart bars={hours} unit="page views" caption={`Page views by hour of the day, UK time, ${range.label.toLowerCase()}`} height={110} tickEvery={6} /> : <p className="text-sm text-slate-700">No visits yet.</p>}
        </Panel>
      </div>

      <section aria-labelledby="m-acc" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="m-acc" className="font-display text-xl font-semibold text-ink">Accounts</h2>
          <Link href="/admin/platform/activity" className="inline-flex min-h-11 items-center text-sm font-semibold text-electric-600 underline-offset-4 hover:underline">See who signed in when</Link>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile label="Accounts" value={n(m.accounts.total)} hint={`${n(m.accounts.approved)} approved`} />
          <Tile label="Have signed in" value={`${pct(m.accounts.ever_signed_in, m.accounts.total)}%`} hint={`${n(m.accounts.ever_signed_in)} of ${n(m.accounts.total)} accounts`} />
          <Tile label="Active today" value={n(m.accounts.active_day)} hint={`${n(m.accounts.active_week)} in the last 7 days`} />
          <Tile label={days === 1 ? "New accounts today" : `New accounts, ${range.label.toLowerCase()}`} value={n(m.accounts.new)} hint={`${pct(m.signed_in_views, m.views)}% of page views were by signed-in people`} />
        </div>
        {days > 1 && (
          <Panel title="New accounts per day">
            <BarChart bars={signups} unit="new accounts" caption={`New accounts per day, last ${days} days`} height={100} />
          </Panel>
        )}
      </section>

      <p className="text-xs leading-relaxed text-slate">
        Visits are counted without cookies. Each visitor is an anonymous code that changes every day, so someone who visits on three days counts as
        three visitors, and IP addresses are never stored. People whose browser asks not to be tracked, search engines and bots aren&apos;t counted,
        and neither are committee dashboard pages. Counts are kept for 13 months. All times are UK time.
      </p>
    </div>
  );
}
