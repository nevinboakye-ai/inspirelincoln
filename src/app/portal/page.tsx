import Link from "next/link";
import QRCode from "qrcode";
import { ArrowRight, CalendarDays, Clock, Gauge, HeartHandshake, Hourglass, LayoutDashboard, MapPin, Megaphone, Ticket, UploadCloud, XCircle } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getSwitches } from "@/lib/switches";
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
  const switches = await getSwitches();
  const showCard = switches.delegate_card || profile.access.owner;
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
          <p className="eyebrow text-gold">{ACCOUNT_TYPE_LABEL[profile.accountType]}</p>
          <h1 className="mt-3 font-display text-3xl sm:text-4xl">Hello{profile.fullName ? `, ${profile.fullName.split(" ")[0]}` : ""}</h1>
          <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-paper/75">
            <span className="flex items-center gap-2"><CalendarDays aria-hidden className="size-4 text-cyan" /> {formatEventDate(edition.date)}</span>
            <span className="flex items-center gap-2"><MapPin aria-hidden className="size-4 text-cyan" /> {edition.venueName}</span>
          </p>
        </div>
      </header>

      {/* Account status and ticket */}
      {status === "approved" && !showCard ? (
        <section className="flex items-center gap-4 rounded-xl border border-success/25 bg-success/[0.06] p-5 sm:p-6">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-success/15 text-success"><Ticket aria-hidden className="size-5" /></span>
          <div>
            <h2 className="font-semibold text-ink">Your place is confirmed</h2>
            <p className="text-sm text-slate-700">Use My Hub to get your presentation and profile ready before the day.</p>
          </div>
        </section>
      ) : status === "approved" ? (
        <section aria-labelledby="card-title" className="relative overflow-hidden rounded-xl bg-midnight p-5 text-paper ring-1 ring-gold/40 sm:p-7">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-gold-600 via-gold-300 to-gold-600" />
          <img src="/brand/crest-white.png" alt="" aria-hidden className="pointer-events-none absolute -right-8 -top-6 h-44 w-auto opacity-[0.06]" />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <h2 id="card-title" className="flex items-center gap-2 font-ui text-xs font-semibold uppercase tracking-[0.18em] text-gold">
                <Ticket aria-hidden className="size-4" /> Your Delegate Card
              </h2>
              {!switches.delegate_card && (
                <p className="mt-2 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs text-paper/80">Only you can see this. Turn it on in the Platform dashboard.</p>
              )}
              <p className="mt-4 font-display text-2xl leading-tight sm:text-3xl">{profile.fullName ?? profile.email}</p>
              <p className="mt-1 text-sm text-paper/75">{[profile.institution, profile.yearOfStudy].filter(Boolean).join(" · ") || ACCOUNT_TYPE_LABEL[profile.accountType]}</p>
              <p className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full bg-gold/15 px-3 py-1 text-xs font-semibold text-gold-300 ring-1 ring-inset ring-gold/40">{ACCOUNT_TYPE_LABEL[profile.accountType]}</span>
                {ticket && (
                  <span className="inline-flex items-center rounded-full bg-white/8 px-3 py-1 text-xs font-medium text-paper/85 ring-1 ring-inset ring-white/15">
                    {registration!.checked_in_at ? "Checked in" : "Confirmed"}
                  </span>
                )}
              </p>
              <p className="mt-4 max-w-md text-sm text-paper/75">
                {ticket
                  ? registration!.checked_in_at
                    ? "You're checked in. Enjoy the conference."
                    : "Show the code at registration on the day. Turn your screen brightness up to make it quicker to scan."
                  : "Your place is confirmed. Your check-in code will appear here shortly."}
              </p>
            </div>
            {ticket && (
              <figure className="mx-auto w-48 shrink-0 sm:mx-0 sm:w-40">
                <div className="rounded-md bg-white p-2 ring-2 ring-gold/50" dangerouslySetInnerHTML={{ __html: qr! }} role="img" aria-label="Your check-in QR code" />
                <figcaption className="mt-2 text-center font-mono text-[0.65rem] text-paper/60">{registration!.checkin_token.slice(0, 8).toUpperCase()}</figcaption>
              </figure>
            )}
          </div>
          {ticket && <p className="relative mt-4 text-xs text-paper/55">The code holds a reference number only, no personal details.</p>}
        </section>
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
