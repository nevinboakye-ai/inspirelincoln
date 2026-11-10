import Link from "next/link";
import QRCode from "qrcode";
import { ArrowRight, CalendarDays, Clock, Gauge, HeartHandshake, Hourglass, LayoutDashboard, MapPin, Megaphone, Ticket, UploadCloud, XCircle } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getConferenceBundle } from "@/lib/data/content";
import { formatEventDate } from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/notice";
import { SavedAgenda } from "@/components/portal/saved-agenda";
import { ACCOUNT_STATUS_LABEL, ACCOUNT_TYPE_LABEL, SUBMISSION_LABEL, SUBMISSION_STATUS_LABEL, submissionKindFor } from "@/lib/accounts";
import type { SubmissionStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

function Card({ title, icon: Icon, children, className = "" }: { title: string; icon: typeof Ticket; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-navy/10 bg-white p-5 sm:p-7 ${className}`}>
      <h2 className="flex items-center gap-2 font-display text-xl text-ink">
        <Icon aria-hidden className="size-5 text-electric-600" /> {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

const linkBtn = "inline-flex min-h-12 items-center justify-center gap-2 rounded-[3px] px-5 font-ui text-sm font-semibold";

export default async function PortalHome({ searchParams }: { searchParams: Promise<{ denied?: string; password?: string; welcome?: string }> }) {
  const sp = await searchParams;
  const { profile, db, user } = await requireUser("/portal");
  const { edition, sessions, workshops } = await getConferenceBundle();
  const kind = submissionKindFor(profile.accountType);
  const status = profile.accountStatus;

  const [{ data: registration }, { data: latestSub }, { data: announcements }, { data: waitPos }] = await Promise.all([
    db.from("registrations").select("status, checkin_token, checked_in_at").eq("user_id", user.id).eq("edition_id", edition.id).maybeSingle(),
    kind
      ? db.from("presentation_submissions").select("status, version, title").eq("user_id", user.id).eq("kind", kind).order("version", { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
    db
      .from("announcements")
      .select("id, title, body, level")
      .eq("published", true)
      .in("audience", kind ? ["public", "delegates", "presenters"] : ["public", "delegates"])
      .order("pinned", { ascending: false })
      .order("published_at", { ascending: false })
      .limit(3),
    status === "waitlisted" ? db.rpc("my_waitlist_position") : Promise.resolve({ data: null }),
  ]);

  const ticket = status === "approved" && registration?.status === "confirmed";
  const qr = ticket
    ? await QRCode.toString(`INSPIRE-CHECKIN:${registration!.checkin_token}`, { type: "svg", margin: 1, color: { dark: "#0c182c", light: "#ffffff" } })
    : null;
  const s = ACCOUNT_STATUS_LABEL[status];
  const subStatus = latestSub ? SUBMISSION_STATUS_LABEL[latestSub.status as SubmissionStatus] : null;

  return (
    <div className="space-y-5 sm:space-y-6">
      {sp.denied && <Notice tone="warning">You don&apos;t have access to that area.</Notice>}
      {sp.password && <Notice>Your password has been updated.</Notice>}
      {sp.welcome && <Notice title="Email verified">Thank you. Your account is set up.</Notice>}

      <header className="relative overflow-hidden rounded-xl bg-midnight p-6 text-paper sm:p-8">
        <img src="/brand/crest-white.png" alt="" aria-hidden className="pointer-events-none absolute -bottom-10 -right-6 h-48 w-auto opacity-[0.07]" />
        <div className="relative">
          <p className="eyebrow text-cyan">{ACCOUNT_TYPE_LABEL[profile.accountType]}</p>
          <h1 className="mt-3 font-display text-3xl sm:text-4xl">Hello{profile.fullName ? `, ${profile.fullName.split(" ")[0]}` : ""}</h1>
          <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-paper/75">
            <span className="flex items-center gap-2"><CalendarDays aria-hidden className="size-4 text-cyan" /> {formatEventDate(edition.date)}</span>
            <span className="flex items-center gap-2"><MapPin aria-hidden className="size-4 text-cyan" /> {edition.venueName}</span>
          </p>
        </div>
      </header>

      {/* Account status and ticket */}
      {status === "approved" ? (
        <Card title="Your ticket" icon={Ticket}>
          {ticket ? (
            <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
              <figure className="w-56 shrink-0 sm:w-44">
                <div className="rounded-md border border-navy/10 bg-white p-2" dangerouslySetInnerHTML={{ __html: qr! }} role="img" aria-label="Your check-in QR code" />
                <figcaption className="mt-2 text-center font-mono text-[0.65rem] text-slate">{registration!.checkin_token.slice(0, 8).toUpperCase()}</figcaption>
              </figure>
              <div className="space-y-3 text-center sm:text-left">
                <Badge tone="success">{registration!.checked_in_at ? "Checked in" : "Confirmed"}</Badge>
                <p className="text-slate-700">
                  {registration!.checked_in_at
                    ? "You're checked in. Enjoy the conference."
                    : "Show this code at registration on the day. Turn your screen brightness up to make it quicker to scan."}
                </p>
                <p className="text-xs text-slate">The code holds a reference number only, no personal details.</p>
              </div>
            </div>
          ) : (
            <p className="text-slate-700">Your account is approved. Your ticket will appear here shortly.</p>
          )}
        </Card>
      ) : (
        <section className="rounded-xl border border-navy/10 bg-white p-5 sm:p-7" aria-labelledby="status-title">
          <div className="flex items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-paper-200">
              {status === "pending" ? <Hourglass aria-hidden className="size-5 text-navy" /> : status === "waitlisted" ? <Clock aria-hidden className="size-5 text-[#7a4a00]" /> : <XCircle aria-hidden className="size-5 text-danger" />}
            </span>
            <div className="min-w-0">
              <h2 id="status-title" className="font-display text-xl text-ink">
                {status === "pending" ? "We're reviewing your account" : status === "waitlisted" ? "You're on the waitlist" : "Your account wasn't approved"}
              </h2>
              <Badge tone={s.tone} className="mt-2">{s.label}</Badge>
              <p className="mt-3 text-slate-700">
                {status === "pending"
                  ? "The executive committee checks every new account. We'll email you as soon as yours is approved."
                  : status === "waitlisted"
                    ? `Places are full right now.${waitPos ? ` You're number ${waitPos} in the queue.` : ""} If a place opens up, we'll approve your account and email you straight away.`
                    : "If you think this is a mistake, please get in touch and we'll take another look."}
              </p>
              {profile.reviewNote && <p className="mt-3 rounded-md bg-paper p-3 text-sm text-ink">Note from the committee: {profile.reviewNote}</p>}
              {status === "declined" && <Link href="/contact" className={`${linkBtn} mt-4 border border-navy/15 text-ink`}>Contact the committee</Link>}
            </div>
          </div>
        </section>
      )}

      {/* Presenters */}
      {kind && (
        <Card title={kind === "slides" ? "Your slides" : "Your poster"} icon={UploadCloud}>
          {latestSub ? (
            <div className="space-y-3">
              <p className="font-medium text-ink">{latestSub.title}</p>
              <p className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
                <Badge tone={subStatus!.tone}>{subStatus!.label}</Badge> Version {latestSub.version}
              </p>
            </div>
          ) : (
            <p className="text-slate-700">
              {status === "approved" ? `You haven't uploaded your ${SUBMISSION_LABEL[kind].noun} yet.` : `You can upload your ${SUBMISSION_LABEL[kind].noun} once your account is approved.`}
            </p>
          )}
          <Link href="/portal/submission" className={`${linkBtn} mt-4 w-full bg-navy text-paper sm:w-auto`}>
            {latestSub ? (latestSub.status === "changes_requested" ? "See feedback and upload a new version" : "View submission") : `Upload ${SUBMISSION_LABEL[kind].noun}`} <ArrowRight aria-hidden className="size-4" />
          </Link>
        </Card>
      )}

      {/* Site owner */}
      {profile.access.owner && (
        <Link href="/admin/platform" className="group flex items-center gap-4 rounded-xl border border-cyan/40 bg-midnight p-5 text-paper transition-colors hover:border-cyan sm:p-6">
          <Gauge aria-hidden className="size-6 shrink-0 text-cyan" />
          <span className="min-w-0 flex-1">
            <span className="block font-display text-xl">Platform dashboard</span>
            <span className="block text-sm text-paper/75">Who can see and do what, committee profiles, accounts and submissions</span>
          </span>
          <ArrowRight aria-hidden className="size-5 shrink-0 transition-transform group-hover:translate-x-1" />
        </Link>
      )}

      {/* Committee */}
      {profile.access.committee && (
        <Link href="/admin" className="flex items-center gap-4 rounded-xl bg-navy p-5 text-paper sm:p-6">
          <LayoutDashboard aria-hidden className="size-6 shrink-0 text-cyan" />
          <span className="min-w-0 flex-1">
            <span className="block font-display text-xl">Committee dashboard</span>
            <span className="block text-sm text-paper/75">Accounts, slides and posters, and editing the website</span>
          </span>
          <ArrowRight aria-hidden className="size-5 shrink-0" />
        </Link>
      )}

      <div className="grid gap-5 sm:gap-6 xl:grid-cols-2">
        <Card title="My agenda" icon={CalendarDays}>
          <SavedAgenda sessions={sessions} workshops={workshops} />
        </Card>

        {(announcements?.length ?? 0) > 0 && (
          <Card title="Announcements" icon={Megaphone}>
            <ul className="space-y-3">
              {announcements!.map((a) => (
                <li key={a.id} className="rounded-md bg-paper p-4">
                  <p className="font-medium text-ink">{a.title}</p>
                  {a.body && <p className="mt-1 text-sm text-slate-700">{a.body}</p>}
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card title="Access and dietary needs" icon={HeartHandshake}>
          <p className="text-slate-700">
            {profile.accessibilityNeeds || profile.dietaryRequirements
              ? "Thank you. The committee has your details for the day."
              : "Tell us about anything that would make the day easier for you, such as step-free access, a quiet space or dietary needs."}
          </p>
          <Link href="/portal/profile#needs" className="mt-3 inline-flex min-h-11 items-center gap-2 font-semibold text-electric-600">
            {profile.accessibilityNeeds || profile.dietaryRequirements ? "Review your details" : "Add your needs"} <ArrowRight aria-hidden className="size-4" />
          </Link>
        </Card>
      </div>
    </div>
  );
}
