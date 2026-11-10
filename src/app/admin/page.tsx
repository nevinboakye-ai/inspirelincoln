import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getEdition } from "@/lib/data/content";
import { formatEventDate, toZonedInputValue } from "@/lib/time";
import { AdminHeader, Panel } from "@/components/admin/ui";
import { CONFERENCE_STATUS_LABEL } from "@/lib/types";

export const dynamic = "force-dynamic";

function Stat({ label, value, href, note }: { label: string; value: number | string; href?: string; note?: string }) {
  const body = (
    <>
      <span className="block text-sm text-slate-700">{label}</span>
      <span className="mt-2 block font-display text-3xl font-semibold text-ink">{value}</span>
      {note && <span className="mt-1 block text-xs text-slate">{note}</span>}
    </>
  );
  return href ? (
    <Link href={href} className="block rounded-xl border border-navy/10 bg-white p-5 transition-colors hover:border-navy/30">{body}</Link>
  ) : (
    <div className="rounded-xl border border-navy/10 bg-white p-5">{body}</div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any -- query builder chaining for count helpers */
export default async function AdminHome() {
  const { db, profile } = await requireRole(["editor"], "/admin");
  const edition = await getEdition();
  const isAdmin = profile.role === "admin";
  const count = async (table: string, f?: (q: any) => any) => {
    let q = db.from(table).select("*", { count: "exact", head: true });
    if (f) q = f(q);
    const { count: c } = await q;
    return c ?? 0;
  };
  const ed = (q: any) => q.eq("edition_id", edition.id);
  const [sessions, speakers, workshops, announcements] = await Promise.all([
    count("sessions", ed), count("speakers", (q) => q.eq("published", true)), count("workshops", ed), count("announcements", (q) => q.eq("published", true)),
  ]);
  const admin = isAdmin
    ? await Promise.all([
        count("registrations", (q) => ed(q).eq("status", "confirmed")),
        count("registrations", (q) => ed(q).not("checked_in_at", "is", null)),
        count("registrations", (q) => ed(q).eq("status", "pending")),
        count("abstracts", (q) => ed(q).neq("status", "draft")),
        count("abstracts", (q) => ed(q).in("status", ["submitted", "under_review"])),
        count("abstracts", (q) => ed(q).eq("status", "accepted")),
        count("review_assignments"),
        count("reviews", (q) => q.eq("status", "submitted")),
        count("contact_enquiries", (q) => q.eq("status", "new")),
        count("profiles"),
        count("poster_uploads", (q) => q.eq("status", "received")),
      ])
    : null;
  const todayUk = toZonedInputValue(new Date().toISOString()).slice(0, 10);
  const days = Math.round((Date.parse(edition.date) - Date.parse(todayUk)) / 86400000);

  return (
    <div className="space-y-8">
      <AdminHeader
        title="Dashboard"
        description={<>{edition.name} · {formatEventDate(edition.date)} · {days > 0 ? `${days} day${days === 1 ? "" : "s"} to go` : days === 0 ? "Today" : "Concluded"} · Status: <strong>{edition.status ? CONFERENCE_STATUS_LABEL[edition.status] : "Not set"}</strong></>}
        actions={<Link href="/admin/settings" className="inline-flex min-h-11 items-center rounded-full bg-navy px-5 text-sm font-semibold text-paper">Conference settings</Link>}
      />
      <p className="text-sm text-slate">All figures are live counts from the database.</p>
      {admin && (
        <section aria-labelledby="people-stats">
          <h2 id="people-stats" className="mb-3 font-display text-lg font-semibold text-ink">Delegates and research</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Confirmed registrations" value={admin[0]} href="/admin/registrations" note={admin[2] ? `${admin[2]} pending` : undefined} />
            <Stat label="Checked in" value={admin[1]} href="/admin/checkin" />
            <Stat label="Abstracts submitted" value={admin[3]} href="/admin/abstracts" note={`${admin[4]} awaiting decision · ${admin[5]} accepted`} />
            <Stat label="Reviews submitted" value={`${admin[7]} / ${admin[6]}`} href="/admin/abstracts" note="Submitted / assigned" />
            <Stat label="New enquiries" value={admin[8]} href="/admin/enquiries" />
            <Stat label="Posters awaiting check" value={admin[10]} href="/admin/posters" />
            <Stat label="User accounts" value={admin[9]} href="/admin/users" />
          </div>
        </section>
      )}
      <section aria-labelledby="content-stats">
        <h2 id="content-stats" className="mb-3 font-display text-lg font-semibold text-ink">Content</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Programme sessions" value={sessions} href="/admin/content/sessions" />
          <Stat label="Published speakers" value={speakers} href="/admin/content/speakers" />
          <Stat label="Workshops" value={workshops} href="/admin/content/workshops" />
          <Stat label="Live announcements" value={announcements} href="/admin/content/announcements" />
        </div>
      </section>
      <Panel title="Before the day">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-700">
          {!edition.startTime && <li>Set the conference start and end times in <Link className="underline" href="/admin/settings">settings</Link> to enable the precise countdown and calendar downloads.</li>}
          {!edition.status && <li>Choose a registration status so the site shows the right call to action.</li>}
          {!edition.registrationUrl && <li>Add the registration link once registration opens.</li>}
          <li>Add confirmed speakers and session times as they are agreed. Sessions without times are labelled provisional.</li>
          <li>Switch on event-day mode on the morning of the conference to show live &ldquo;now and next&rdquo; information.</li>
        </ul>
      </Panel>
    </div>
  );
}
