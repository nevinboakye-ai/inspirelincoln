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

function Action({ href, icon: Icon, title, value, note, tone = "tone-navy" }: { href: string; icon: typeof UserCheck; title: string; value?: number | string; note?: string; tone?: string }) {
  return (
    <Link href={href} className="app-card-link group flex flex-col gap-3 p-3.5 sm:flex-row sm:items-start sm:gap-4 sm:p-5">
      <span className="flex items-center justify-between sm:contents">
        <span className={`icon-chip ${tone}`}><Icon aria-hidden className="size-5" /></span>
        <ArrowRight aria-hidden className="size-4 shrink-0 text-slate transition-transform group-hover:translate-x-0.5 sm:order-last sm:mt-1" />
      </span>
      <span className="min-w-0 flex-1">
        {value !== undefined && <span className="block font-display text-[1.75rem] leading-none text-ink sm:order-2 sm:mt-1 sm:text-3xl">{value}</span>}
        <span className="mt-1.5 block text-[0.85rem] font-medium leading-snug text-slate-700 sm:text-sm">{title}</span>
        {note && <span className="mt-1 block text-xs leading-snug text-slate">{note}</span>}
      </span>
    </Link>
  );
}

export default async function CommitteeHome({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const sp = await searchParams;
  const { db, profile } = await requireAccess("any", "/admin");
  const { access } = profile;
  // Every count is fetched at once, so the overview costs one round trip, not five.
  const editionP = getEdition();
  const [edition, { data: subs }, { data: peopleRows }, checkedIn, { data: attendanceRows }] = await Promise.all([
    editionP,
    db.from("presentation_submissions").select("user_id, kind, status, version").order("version", { ascending: false }).limit(2000),
    access.exec ? db.from("profiles").select("account_status, account_type, extra_types").limit(5000) : Promise.resolve({ data: [] }),
    access.exec
      ? editionP.then(async (e) => (await db.from("registrations").select("id", { count: "exact", head: true }).eq("edition_id", e.id).not("checked_in_at", "is", null)).count ?? 0)
      : 0,
    access.exec ? db.from("presenter_attendance").select("response").limit(5000) : Promise.resolve({ data: [] }),
  ]);
  const latest = new Map<string, string>();
  for (const s of subs ?? []) if (!latest.has(`${s.user_id}:${s.kind}`)) latest.set(`${s.user_id}:${s.kind}`, s.status);
  const toReview = [...latest.values()].filter((s) => s === "submitted").length;

  const people = ((peopleRows ?? []) as { account_status: string; account_type: string; extra_types: string[] | null }[]).map((p) => ({ ...p, roles: rolesOf(p.account_type as AccountType, p.extra_types as AccountType[] | null) }));
  const pending = people.filter((p) => p.account_status === "pending").length;
  const waitlisted = people.filter((p) => p.account_status === "waitlisted").length;
  const approved = people.filter((p) => p.account_status === "approved");
  const byType = ACCOUNT_TYPES.map((t) => [t, approved.filter((p) => p.roles.includes(t)).length] as [AccountType, number]);
  const attendance = (attendanceRows ?? []) as { response: string }[];
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
        <div className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-3">
          {access.exec && <Action href="/admin/accounts" icon={UserCheck} tone="tone-coral" title="Accounts awaiting review" value={pending} note={waitlisted ? `${waitlisted} on the waitlist` : undefined} />}
          {access.exec && (
            <Action
              href="/admin/attendance"
              icon={CalendarCheck2}
              tone="tone-teal"
              title="Presenters who've confirmed"
              value={`${attendance.length - cantMake} of ${presenterCount}`}
              note={cantMake ? `${cantMake} can't make it` : "Oral and poster presenters"}
            />
          )}
          <Action href="/admin/submissions?status=submitted" icon={FileStack} tone="tone-gold" title="Slides and posters to review" value={toReview} />
          {access.leadership && <Action href="/admin/email" icon={Mail} tone="tone-plum" title="Email a group" note="Delegates, presenters or the committee" />}
        </div>
      </section>

      <section aria-labelledby="site">
        <h2 id="site" className="mb-3 font-display text-xl text-ink">Update the website</h2>
        <div className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-3">
          <Action href="/admin/content/announcements" icon={Megaphone} tone="tone-rose" title="Post an announcement" note="Shows on the homepage and in everyone's account" />
          <Action href="/admin/content/sessions" icon={CalendarCog} tone="tone-sky" title="Edit the programme" note="Times, rooms and speakers" />
          <Action href="/admin/content/map" icon={MapPin} tone="tone-teal" title="Edit the campus map" note="Pin buildings and rooms" />
        </div>
      </section>

      {access.exec && (
        <Panel title="Who's coming">
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            {byType.map(([t, n]) => (
              <div key={t} className="rounded-xl bg-paper/70 p-3">
                <dt className="text-sm text-slate-700">{ACCOUNT_TYPE_LABEL[t]}</dt>
                <dd className="font-display text-2xl text-ink">{n}</dd>
              </div>
            ))}
            <div className="rounded-xl bg-success/10 p-3">
              <dt className="text-sm text-success">Checked in</dt>
              <dd className="font-display text-2xl text-ink">{checkedIn}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-slate">Approved accounts only. Live from the database.</p>
        </Panel>
      )}
    </div>
  );
}
