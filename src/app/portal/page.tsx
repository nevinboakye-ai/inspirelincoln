import Link from "next/link";
import QRCode from "qrcode";
import { ArrowRight, CalendarDays, Download, FileText, MapPin, Megaphone, Ticket } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getConferenceBundle, getResources } from "@/lib/data/content";
import { formatEventDate } from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/notice";
import { SavedAgenda } from "@/components/portal/saved-agenda";
import { ABSTRACT_STATUS_LABEL } from "@/lib/validation/abstract";

export const dynamic = "force-dynamic";

function Card({ title, icon: Icon, children, className = "" }: { title: string; icon: typeof Ticket; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-navy/10 bg-white p-6 sm:p-7 ${className}`}>
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
        <Icon aria-hidden className="size-5 text-electric-600" /> {title}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default async function PortalHome({ searchParams }: { searchParams: Promise<{ denied?: string; password?: string }> }) {
  const sp = await searchParams;
  const { profile, db, user } = await requireUser("/portal");
  const [{ edition, sessions, workshops }, resources] = await Promise.all([getConferenceBundle(), getResources()]);

  const [{ data: registration }, { data: abstracts }] = await Promise.all([
    db.from("registrations").select("status, checkin_token, checked_in_at").eq("user_id", user.id).eq("edition_id", edition.id).maybeSingle(),
    db.from("abstracts").select("id, title, status, reference").eq("submitter_id", user.id).order("created_at", { ascending: false }),
  ]);
  const isPresenter = (abstracts ?? []).some((a) => a.status === "accepted");
  const { data: announcements } = await db
    .from("announcements")
    .select("id, title, body, level, audience")
    .eq("published", true)
    .in("audience", isPresenter ? ["public", "delegates", "presenters"] : ["public", "delegates"])
    .order("pinned", { ascending: false })
    .order("published_at", { ascending: false })
    .limit(5);

  const qr = registration?.status === "confirmed" ? await QRCode.toString(`INSPIRE-CHECKIN:${registration.checkin_token}`, { type: "svg", margin: 1, color: { dark: "#1A3154", light: "#ffffff" } }) : null;

  return (
    <div className="space-y-6">
      {sp.denied && <Notice tone="warning">You don&apos;t have access to that area.</Notice>}
      {sp.password && <Notice>Your password has been updated.</Notice>}
      <header className="relative overflow-hidden rounded-xl bg-navy p-8 text-paper">
        <div aria-hidden className="grid-lines absolute inset-0 opacity-60" />
        <div className="relative">
          <p className="eyebrow text-cyan">My Conference</p>
          <h1 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">Welcome{profile.fullName ? `, ${profile.fullName.split(" ")[0]}` : ""}</h1>
          <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-paper/70">
            <span className="flex items-center gap-2"><CalendarDays aria-hidden className="size-4 text-cyan" /> {formatEventDate(edition.date)}</span>
            <span className="flex items-center gap-2"><MapPin aria-hidden className="size-4 text-cyan" /> {edition.venueName}</span>
          </p>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Registration" icon={Ticket}>
          {registration ? (
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              <div className="flex-1 space-y-3">
                <Badge tone={registration.status === "confirmed" ? "success" : registration.status === "cancelled" ? "danger" : "warning"}>
                  {registration.status === "confirmed" ? "Confirmed" : registration.status === "pending" ? "Pending confirmation" : registration.status === "waitlisted" ? "Waitlisted" : "Cancelled"}
                </Badge>
                <p className="text-sm text-slate-700">
                  {registration.status === "confirmed"
                    ? registration.checked_in_at
                      ? "You're checked in. Enjoy the conference!"
                      : "Show this code at registration on the day. It contains a reference number only, no personal details."
                    : "Your registration record has been created and is awaiting confirmation by the conference team."}
                </p>
              </div>
              {qr && (
                <figure className="w-40 shrink-0">
                  <div className="rounded-md border border-navy/10 p-2" dangerouslySetInnerHTML={{ __html: qr }} role="img" aria-label="Check-in QR code" />
                  <figcaption className="mt-1 text-center text-xs text-slate">Check-in code<span className="mt-1 block break-all font-mono text-[0.65rem]">{registration.checkin_token}</span></figcaption>
                </figure>
              )}
            </div>
          ) : (
            <div className="space-y-3 text-sm text-slate-700">
              <p>We haven&apos;t found a registration record linked to this account.</p>
              <p>If you registered through the official registration route, the conference team will link it to the email address on your account. Registration is not confirmed until it appears here.</p>
              {edition.registrationUrl && edition.status === "registration_open" && (
                <a href={edition.registrationUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 font-semibold text-electric-600">
                  Register for {edition.name} <ArrowRight aria-hidden className="size-4" />
                </a>
              )}
            </div>
          )}
        </Card>

        <Card title="Announcements" icon={Megaphone}>
          {announcements?.length ? (
            <ul className="space-y-3">
              {announcements.map((a) => (
                <li key={a.id} className="rounded-md bg-paper p-4">
                  <p className="font-medium text-ink">{a.title}</p>
                  <p className="mt-1 text-sm text-slate-700">{a.body}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-700">No announcements right now.</p>
          )}
        </Card>

        <Card title="My agenda" icon={CalendarDays}>
          <SavedAgenda sessions={sessions} workshops={workshops} />
        </Card>

        <Card title="Presentations" icon={FileText}>
          {abstracts?.length ? (
            <ul className="divide-y divide-navy/10">
              {abstracts.map((a) => {
                const s = ABSTRACT_STATUS_LABEL[a.status];
                return (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                    <Link href={`/portal/abstracts/${a.id}`} className="min-w-0">
                      <span className="block text-xs text-slate">{a.reference}</span>
                      <span className="block truncate font-medium text-ink">{a.title}</span>
                    </Link>
                    <Badge tone={s.tone}>{s.label}</Badge>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-slate-700">You haven&apos;t submitted any abstracts.</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/portal/presenter" className="inline-flex min-h-11 items-center rounded-[3px] border border-navy/15 px-4 text-sm font-medium text-ink hover:border-navy/40">Presenter portal</Link>
            {edition.abstractConfig.submissionsOpen && (
              <Link href="/portal/abstracts/new" className="inline-flex min-h-11 items-center rounded-[3px] bg-navy px-4 text-sm font-medium text-paper">Submit an abstract</Link>
            )}
          </div>
        </Card>

        <Card title="Resources" icon={Download} className="xl:col-span-2">
          <ul className="grid gap-2 sm:grid-cols-2">
            <li><Link href="/conference#venue" className="text-electric-600 underline underline-offset-4">Venue and travel</Link></li>
            <li><Link href="/research#presenters" className="text-electric-600 underline underline-offset-4">Presenter guidance</Link></li>
            {resources.slice(0, 4).map((r) => (
              <li key={r.id}>
                <a href={r.url ?? "#"} target="_blank" rel="noopener noreferrer" className="text-electric-600 underline underline-offset-4">{r.title}</a>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
