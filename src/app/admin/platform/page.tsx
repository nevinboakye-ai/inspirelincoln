import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight, CalendarCog, Crown, FileStack, History, Mail, Search, Settings2, ShieldCheck, SlidersHorizontal, UserCheck, UserCog, Users,
} from "lucide-react";
import { requireAccess } from "@/lib/auth";
import { getSwitches, SWITCHES, type SwitchKey } from "@/lib/switches";
import { setSwitch } from "@/app/admin/platform/actions";
import { AdminHeader, Panel } from "@/components/admin/ui";
import { AccessMatrix } from "@/components/admin/platform-forms";
import { ViewAsPicker } from "@/components/admin/view-as";
import { viewAsAvailable } from "@/lib/view-as-seal";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/notice";
import { ACCOUNT_STATUS_LABEL, ACCOUNT_TYPE_LABEL, ACCOUNT_TYPES, CAPABILITIES, CAPABILITY_LABEL, DEFAULT_RULES, type Capability } from "@/lib/accounts";
import type { AccountStatus, AccountType } from "@/lib/types";

export const metadata: Metadata = { title: "Platform dashboard" };
export const dynamic = "force-dynamic";

const when = (d: string) => new Date(d).toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "medium", timeStyle: "short" });

function Stat({ href, label, value, note, icon: Icon }: { href: string; label: string; value: number; note?: string; icon: typeof Users }) {
  return (
    <Link href={href} className="group relative overflow-hidden rounded-xl border border-navy/10 bg-white p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-navy/25 hover:shadow-[0_12px_30px_-18px_rgba(14,27,49,0.45)]">
      <span className="flex items-center justify-between text-sm text-slate-700">
        {label}
        <Icon aria-hidden className="size-4 text-slate transition-colors group-hover:text-navy" />
      </span>
      <span className="mt-2 block font-display text-4xl text-ink">{value}</span>
      {note && <span className="mt-1 block text-xs text-slate">{note}</span>}
    </Link>
  );
}

function Shortcut({ href, icon: Icon, title, note }: { href: string; icon: typeof Users; title: string; note: string }) {
  return (
    <Link href={href} className="group flex items-start gap-4 rounded-xl border border-navy/10 bg-white p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-navy/25 hover:shadow-[0_12px_30px_-18px_rgba(14,27,49,0.45)]">
      <span className="grid size-10 shrink-0 place-items-center rounded-[3px] bg-navy text-cyan transition-transform duration-300 group-hover:scale-105"><Icon aria-hidden className="size-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-ink">{title}</span>
        <span className="block text-sm text-slate-700">{note}</span>
      </span>
      <ArrowRight aria-hidden className="mt-1 size-4 shrink-0 text-slate transition-transform group-hover:translate-x-1" />
    </Link>
  );
}

export default async function PlatformPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sp = await searchParams;
  const { db, profile } = await requireAccess("owner", "/admin/platform");
  const switches = await getSwitches();
  const term = sp.q?.trim().slice(0, 80) ?? "";

  const [rulesRes, overridesRes, peopleRes, subsRes, auditRes, searchRes] = await Promise.all([
    db.from("access_rules").select("account_type, capability, allowed"),
    db.from("access_overrides").select("user_id, capability, allowed, updated_at").order("updated_at", { ascending: false }),
    db.from("profiles").select("id, full_name, email, account_type, account_status, role, committee_position").limit(5000),
    db.from("presentation_submissions").select("user_id, kind, status, version").order("version", { ascending: false }).limit(2000),
    db.from("audit_events").select("actor_id, action, entity, entity_id, created_at").in("entity", ["access_rules", "access_overrides", "profiles"]).order("created_at", { ascending: false }).limit(10),
    term
      ? db.from("profiles").select("id, full_name, email, account_type, account_status, role").or(`full_name.ilike.%${term.replace(/[%,()]/g, "")}%,email.ilike.%${term.replace(/[%,()]/g, "")}%`).limit(20)
      : Promise.resolve({ data: null }),
  ]);

  const ready = !rulesRes.error;
  const rules = Object.fromEntries(
    ACCOUNT_TYPES.map((t) => [t, Object.fromEntries(CAPABILITIES.map((c) => [c, DEFAULT_RULES[t].includes(c)]))]),
  ) as Record<AccountType, Record<Capability, boolean>>;
  for (const r of rulesRes.data ?? []) if (rules[r.account_type as AccountType]) rules[r.account_type as AccountType][r.capability as Capability] = r.allowed;

  const people = peopleRes.data ?? [];
  const byId = new Map(people.map((p) => [p.id, p]));
  const count = (s: AccountStatus) => people.filter((p) => p.account_status === s).length;

  const latest = new Map<string, string>();
  for (const s of subsRes.data ?? []) if (!latest.has(`${s.user_id}:${s.kind}`)) latest.set(`${s.user_id}:${s.kind}`, s.status);
  const toReview = [...latest.values()].filter((s) => s === "submitted").length;

  const overrides = overridesRes.data ?? [];
  const customPeople = [...new Set(overrides.map((o) => o.user_id))];
  const committee = people
    .filter((p) => ["president", "vice_president", "executive_committee", "supporting_committee"].includes(p.account_type) || p.role !== "delegate")
    .sort((a, b) => ACCOUNT_TYPES.indexOf(b.account_type as AccountType) - ACCOUNT_TYPES.indexOf(a.account_type as AccountType));
  const list = searchRes.data ?? committee;

  return (
    <div className="space-y-10">
      <AdminHeader
        title="Platform dashboard"
        description={
          <>
            Everything about how the site runs, in one place. As site owner you always have every permission, and only you can change who can see and do what.
          </>
        }
        actions={
          <span className="inline-flex items-center gap-2 rounded-full bg-midnight px-4 py-2 text-sm font-semibold text-cyan">
            <Crown aria-hidden className="size-4" /> {profile.fullName ?? "Site owner"}
          </span>
        }
      />

      <Panel title="Site switches">
        <p className="mb-4 text-sm text-slate-700">What the public and delegates can see while the website is being prepared. Changes apply straight away.</p>
        <ul className="divide-y divide-navy/10">
          {(Object.keys(SWITCHES) as SwitchKey[]).map((k) => {
            const on = switches[k];
            return (
              <li key={k} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-semibold text-ink">
                    {SWITCHES[k].label}
                    <Badge tone={on ? "success" : "warning"}>{on ? "On" : "Off"}</Badge>
                  </p>
                  <p className="text-sm text-slate-700">{on ? SWITCHES[k].on : SWITCHES[k].off}</p>
                </div>
                <form action={setSwitch}>
                  <input type="hidden" name="key" value={k} />
                  {!on && <input type="hidden" name="enabled" value="on" />}
                  <button className={on ? "min-h-11 rounded-[3px] border border-navy/20 bg-white px-4 text-sm font-semibold text-ink" : "min-h-11 rounded-[3px] bg-navy px-4 text-sm font-semibold text-paper"}>
                    {on ? "Turn off" : "Turn on"}<span className="sr-only"> {SWITCHES[k].label}</span>
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      </Panel>

      {!ready && (
        <Notice tone="warning" title="One database step left">
          Run <code>6-access-control.sql</code> in the Supabase SQL editor to switch on custom permissions. Until then everyone has the default access shown below.
        </Notice>
      )}

      <section aria-labelledby="pulse">
        <h2 id="pulse" className="sr-only">At a glance</h2>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <Stat href="/admin/accounts" label="Awaiting review" value={count("pending")} icon={UserCheck} note={`${count("waitlisted")} on the waitlist`} />
          <Stat href="/admin/accounts?status=approved" label="Approved accounts" value={count("approved")} icon={Users} />
          <Stat href="/admin/submissions" label="Slides and posters to review" value={toReview} icon={FileStack} />
          <Stat href="#people" label="People with custom access" value={customPeople.length} icon={UserCog} />
        </div>
      </section>

      <section aria-labelledby="shortcuts" className="space-y-3">
        <h2 id="shortcuts" className="font-display text-xl text-ink">Edit and review</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Shortcut href="/admin/content/committee" icon={Users} title="Committee profiles" note="Names, roles, photos and biographies on the About page" />
          <Shortcut href="/admin/accounts" icon={UserCheck} title="Accept accounts" note="Approve, waitlist or decline new registrations" />
          <Shortcut href="/admin/submissions" icon={FileStack} title="Review submissions" note="Slides and posters, with feedback to presenters" />
          <Shortcut href="/admin/content/sessions" icon={CalendarCog} title="Programme" note="Sessions, times, rooms and speakers" />
          <Shortcut href="/admin/email" icon={Mail} title="Group email" note="Email delegates, presenters or the committee" />
          <Shortcut href="/admin/settings" icon={Settings2} title="Conference settings" note="Status, registration, deadlines and modes" />
        </div>
      </section>

      <ViewAsPicker people={people} types={[...ACCOUNT_TYPES].reverse()} available={viewAsAvailable()} />

      <section aria-labelledby="matrix" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="matrix" className="flex items-center gap-2 font-display text-xl text-ink"><SlidersHorizontal aria-hidden className="size-5 text-navy" /> Who can do what</h2>
            <p className="max-w-3xl text-sm text-slate-700">Choose what each account type can see and do. The database enforces every switch, so nobody can get around it.</p>
          </div>
        </div>
        <AccessMatrix initial={rules} types={[...ACCOUNT_TYPES].reverse()} />
      </section>

      <section aria-labelledby="people-h" id="people" className="scroll-mt-28 space-y-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl text-ink" id="people-h"><UserCog aria-hidden className="size-5 text-navy" /> Individual access</h2>
          <p className="max-w-3xl text-sm text-slate-700">Give one person extra access, or take something away, without changing their whole account type. For example, let a delegate volunteer run the check-in desk.</p>
        </div>
        <form role="search" className="flex gap-2">
          <label htmlFor="q" className="sr-only">Find a person</label>
          <div className="relative min-w-0 flex-1">
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate" />
            <input id="q" name="q" defaultValue={term} placeholder="Find anyone by name or email" className="min-h-11 w-full rounded-[3px] border border-navy/15 bg-white pl-9 pr-4 text-sm" />
          </div>
          <button className={btn()}>Search</button>
        </form>
        <ul className="divide-y divide-navy/10 overflow-hidden rounded-xl border border-navy/10 bg-white">
          {!list.length && <li className="p-6 text-sm text-slate-700">{term ? "Nobody matches that search." : "No committee accounts yet."}</li>}
          {list.map((p) => {
            const custom = overrides.filter((o) => o.user_id === p.id);
            const st = ACCOUNT_STATUS_LABEL[p.account_status as AccountStatus];
            return (
              <li key={p.id}>
                <Link href={`/admin/platform/people/${p.id}`} className="group flex items-center gap-4 p-4 transition-colors hover:bg-paper/70 sm:px-5">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-paper-200 font-display text-ink">{(p.full_name || p.email || "?").charAt(0).toUpperCase()}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-ink">{p.full_name || "Name not given"}{p.id === profile.id && <span className="font-normal text-slate"> (you)</span>}</span>
                    <span className="block truncate text-sm text-slate-700">{p.email}</span>
                  </span>
                  <span className="hidden flex-wrap justify-end gap-2 sm:flex">
                    {p.role === "admin" ? <Badge tone="violet"><Crown aria-hidden className="size-3" /> Site owner</Badge> : <Badge tone="violet">{ACCOUNT_TYPE_LABEL[p.account_type as AccountType]}</Badge>}
                    <Badge tone={st.tone}>{st.label}</Badge>
                    {custom.length > 0 && <Badge tone="warning">{custom.length} custom</Badge>}
                  </span>
                  <ArrowRight aria-hidden className="size-4 shrink-0 text-slate transition-transform group-hover:translate-x-1" />
                </Link>
              </li>
            );
          })}
        </ul>
        {customPeople.length > 0 && (
          <Panel title="Custom access in place">
            <ul className="space-y-2 text-sm">
              {overrides.map((o) => {
                const p = byId.get(o.user_id);
                return (
                  <li key={`${o.user_id}:${o.capability}`} className="flex flex-wrap items-center gap-2">
                    <Link href={`/admin/platform/people/${o.user_id}`} className="font-semibold text-ink underline-offset-4 hover:underline">{p?.full_name || p?.email || "Unknown"}</Link>
                    <span className={o.allowed ? "text-success" : "text-danger"}>{o.allowed ? "can" : "can't"}</span>
                    <span className="text-slate-700">{CAPABILITY_LABEL[o.capability as Capability]?.label.toLowerCase()}</span>
                  </li>
                );
              })}
            </ul>
          </Panel>
        )}
      </section>

      <section aria-labelledby="changes" className="space-y-3">
        <h2 id="changes" className="flex items-center gap-2 font-display text-xl text-ink"><History aria-hidden className="size-5 text-navy" /> Recent changes</h2>
        <Panel>
          {!auditRes.data?.length ? (
            <p className="text-sm text-slate-700">No access or account changes yet.</p>
          ) : (
            <ol className="space-y-3 text-sm">
              {auditRes.data.map((a, i) => {
                const actor = a.actor_id ? byId.get(a.actor_id) : null;
                const what = a.entity === "access_rules" ? "changed an account type's permissions" : a.entity === "access_overrides" ? `changed individual access for ${byId.get(a.entity_id ?? "")?.full_name ?? "someone"}` : `updated the account of ${byId.get(a.entity_id ?? "")?.full_name ?? "someone"}`;
                return (
                  <li key={i} className="flex flex-wrap items-baseline justify-between gap-2">
                    <span><span className="font-semibold text-ink">{actor?.full_name ?? "System"}</span> <span className="text-slate-700">{what}</span></span>
                    <time className="text-xs text-slate" dateTime={a.created_at}>{when(a.created_at)}</time>
                  </li>
                );
              })}
            </ol>
          )}
          <Link href="/admin/audit" className="mt-4 inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-navy underline-offset-4 hover:underline">
            <ShieldCheck aria-hidden className="size-4" /> Full audit log
          </Link>
        </Panel>
      </section>
    </div>
  );
}

function btn() {
  return "inline-flex min-h-11 items-center justify-center gap-2 rounded-[3px] bg-navy px-5 text-sm font-semibold text-paper hover:bg-navy-700";
}
