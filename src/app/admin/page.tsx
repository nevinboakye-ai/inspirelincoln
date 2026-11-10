import Link from "next/link";
import { ArrowRight, CalendarCheck2, CalendarCog, FileStack, Mail, MapPin, Megaphone, UserCheck } from "lucide-react";
import { requireAccess } from "@/lib/auth";
import { getEdition } from "@/lib/data/content";
import { formatEventDate, toZonedInputValue } from "@/lib/time";
import { AdminHeader, Panel } from "@/components/admin/ui";
import { Notice } from "@/components/ui/notice";
import { ACCOUNT_TYPE_LABEL, ACCOUNT_TYPES, rolesOf } from "@/lib/accounts";
import type { AccountType } from "@/lib/types";

export const dynamic = "force-dynamic";

function Action({ href, icon: Icon, title, value, note }: { href: string; icon: typeof UserCheck; title: string; value?: number | string; note?: string }) {
  return (
    <Link href={href} className="group flex items-start gap-4 rounded-xl border border-navy/10 bg-white p-5 transition-colors hover:border-navy/30">
      <span className="grid size-10 shrink-0 place-items-center rounded-[3px] bg-navy text-cyan"><Icon aria-hidden className="size-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-slate-700">{title}</span>
        {value !== undefined && <span className="mt-1 block font-display text-3xl text-ink">{value}</span>}
        {note && <span className="mt-1 block text-xs text-slate">{note}</span>}
      </span>
      <ArrowRight aria-hidden className="mt-1 size-4 shrink-0 text-slate transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

export default async function CommitteeHome({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const sp = await searchParams;
  const { db, profile } = await requireAccess("any", "/admin");
  const { access } = profile;
  const edition = await getEdition();

  const { data: subs } = await db.from("presentation_submissions").select("user_id, kind, status, version").order("version", { ascending: false }).limit(2000);
  const latest = new Map<string, string>();
  for (const s of subs ?? []) if (!latest.has(`${s.user_id}:${s.kind}`)) latest.set(`${s.user_id}:${s.kind}`, s.status);
  const toReview = [...latest.values()].filter((s) => s === "submitted").length;

  const people = access.exec ? ((await db.from("profiles").select("*").limit(5000)).data ?? []).map((p) => ({ ...p, roles: rolesOf(p.account_type as AccountType, p.extra_types as AccountType[] | null) })) : [];
  const pending = people.filter((p) => p.account_status === "pending").length;
  const waitlisted = people.filter((p) => p.account_status === "waitlisted").length;
  const approved = people.filter((p) => p.account_status === "approved");
  const byType = ACCOUNT_TYPES.map((t) => [t, approved.filter((p) => p.roles.includes(t)).length] as [AccountType, number]);
  const checkedIn = access.exec
    ? ((await db.from("registrations").select("id", { count: "exact", head: true }).eq("edition_id", edition.id).not("checked_in_at", "is", null)).count ?? 0)
    : 0;

  const attendance = access.exec ? (await db.from("presenter_attendance").select("response").limit(5000)).data ?? [] : [];
  const presenterCount = approved.filter((p) => p.roles.includes("oral_presenter") || p.roles.includes("poster_presenter")).length;
  const cantMake = attendance.filter((a) => a.response === "unavailable").length;

  const todayUk = toZonedInputValue(new Date().toISOString()).slice(0, 10);
  const days = Math.round((Date.parse(edition.date) - Date.parse(todayUk)) / 86400000);

  return (
    <div className="space-y-8">
      {sp.denied && <Notice tone="warning">{"You don't have permission for that page. The site owner can change this on the platform dashboard."}</Notice>}
      <AdminHeader
        title={`Hello${profile.fullName ? `, ${profile.fullName.split(" ")[0]}` : ""}`}
        description={<>{formatEventDate(edition.date)} · {days > 0 ? `${days} day${days === 1 ? "" : "s"} to go` : days === 0 ? "It's conference day" : "The conference has finished"}</>}
      />

      <section aria-labelledby="todo">
        <h2 id="todo" className="mb-3 font-display text-xl text-ink">Needs you</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {access.exec && <Action href="/admin/accounts" icon={UserCheck} title="Accounts awaiting review" value={pending} note={waitlisted ? `${waitlisted} on the waitlist` : undefined} />}
          {access.exec && (
            <Action
              href="/admin/attendance"
              icon={CalendarCheck2}
              title="Presenters who've confirmed"
              value={`${attendance.length - cantMake} of ${presenterCount}`}
              note={cantMake ? `${cantMake} can't make it` : "Oral and poster presenters"}
            />
          )}
          <Action href="/admin/submissions?status=submitted" icon={FileStack} title="Slides and posters to review" value={toReview} />
          {access.leadership && <Action href="/admin/email" icon={Mail} title="Email a group" note="Delegates, presenters or the committee" />}
        </div>
      </section>

      <section aria-labelledby="site">
        <h2 id="site" className="mb-3 font-display text-xl text-ink">Update the website</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Action href="/admin/content/announcements" icon={Megaphone} title="Post an announcement" note="Shows on the homepage and in everyone's account" />
          <Action href="/admin/content/sessions" icon={CalendarCog} title="Edit the programme" note="Times, rooms and speakers" />
          <Action href="/admin/content/map" icon={MapPin} title="Edit the campus map" note="Pin buildings and rooms" />
        </div>
      </section>

      {access.exec && (
        <Panel title="Who's coming">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
            {byType.map(([t, n]) => (
              <div key={t}>
                <dt className="text-sm text-slate-700">{ACCOUNT_TYPE_LABEL[t]}</dt>
                <dd className="font-display text-2xl text-ink">{n}</dd>
              </div>
            ))}
            <div>
              <dt className="text-sm text-slate-700">Checked in</dt>
              <dd className="font-display text-2xl text-ink">{checkedIn}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-slate">Approved accounts only. Live from the database.</p>
        </Panel>
      )}
    </div>
  );
}
