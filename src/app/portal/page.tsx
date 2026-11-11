import Link from "next/link";
import QRCode from "qrcode";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock,
  Gauge,
  HeartHandshake,
  UserRound,
  Hourglass,
  LayoutDashboard,
  MapPin,
  Megaphone,
  Ticket,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { signAvatar } from "@/lib/avatar";
import { getLogoMap } from "@/lib/university-logos-server";
import { uniKey } from "@/lib/university-logos";
import { PRESENTING, cardPath, formatCode, sortedRoles } from "@/lib/card";
import { SITE_URL } from "@/lib/site";
import { getSwitches } from "@/lib/switches";
import { getConferenceBundle } from "@/lib/data/content";
import { formatEventDate } from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/notice";
import { SavedAgenda } from "@/components/portal/saved-agenda";
import { Lanyard, type LanyardTone } from "@/components/portal/lanyard";
import { Countdown, HubItem, HubStagger, ReadinessRing } from "@/components/portal/hub-motion";
import { MaskRise } from "@/components/motion/effects";
import { AttendanceCard, type AttendanceAnswer } from "@/components/portal/attendance-card";
import { WorkshopRanking, type RankPlace, type RankWorkshop } from "@/components/portal/workshop-ranking";
import { closingTimePassed, loadWorkshopChoices, pairLabel, rankingIsOpen } from "@/lib/workshops/choices";
import {
  ACCOUNT_STATUS_LABEL,
  ACCOUNT_TYPE_LABEL,
  SUBMISSION_LABEL,
  SUBMISSION_STATUS_LABEL,
  hasRole,
  presenterKindOf,
  rolesLabel,
  rolesOf,
  EXEC_TYPES,
} from "@/lib/accounts";
import type { AccountType, SubmissionStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

function Card({
  title,
  icon: Icon,
  children,
  className = "",
}: {
  title: string;
  icon: typeof Ticket;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-navy/10 bg-white p-5 transition-shadow duration-300 hover:shadow-[0_14px_34px_-22px_rgba(14,27,49,0.45)] sm:p-7 ${className}`}
    >
      <h2 className="flex items-center gap-2 font-display text-xl text-ink">
        <Icon aria-hidden className="size-5 text-electric-600" /> {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

const TONE: Partial<Record<AccountType, LanyardTone>> = { delegate: "delegate", poster_presenter: "poster", oral_presenter: "oral", oral_waitlist: "waitlist" };

/**
 * Every role for the lanyard, most senior first. Presenters and the oral
 * waiting list don't also show "Delegate". With a single committee role,
 * their committee position (for example "Head of Logistics") reads better
 * than the team name.
 */
function lanyardRoles(p: { accountType: AccountType; extraTypes: AccountType[]; committeePosition: string | null }) {
  const all = rolesOf(p.accountType, p.extraTypes);
  const presenting = all.some((t) => PRESENTING.has(t));
  const roles = sortedRoles(all).filter((t) => !(t === "delegate" && presenting));
  const committee = roles.filter((t) => !TONE[t]);
  return roles.map((t) => ({
    label: !TONE[t] && committee.length === 1 && p.committeePosition ? p.committeePosition : ACCOUNT_TYPE_LABEL[t],
    tone: TONE[t] ?? ((EXEC_TYPES.includes(t) ? "executive" : "committee") as LanyardTone),
  }));
}

const linkBtn =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-[3px] px-5 font-ui text-sm font-semibold";

export default async function PortalHome({
  searchParams,
}: {
  searchParams: Promise<{
    denied?: string;
    password?: string;
    welcome?: string;
  }>;
}) {
  const sp = await searchParams;
  const { profile, db, user } = await requireUser("/portal");
  const switches = await getSwitches();
  const showCard = switches.delegate_card || profile.access.owner;
  // While the website is closed, delegates only use My Hub for their profile and their slides or poster.
  const focus =
    !switches.site_open && !profile.access.committee && !profile.access.owner;
  const { edition, sessions, workshops } = await getConferenceBundle();
  const kind = presenterKindOf(profile);
  const status = profile.accountStatus;
  // Approved oral and poster presenters confirm whether they'll be there to present.
  const presenting = Boolean(kind) && status === "approved";

  const [
    { data: registration },
    { data: latestSub },
    { data: announcements },
    { data: waitPos },
    { data: attendance },
  ] = await Promise.all([
    db
      .from("registrations")
      .select("status, checkin_token, checked_in_at")
      .eq("user_id", user.id)
      .eq("edition_id", edition.id)
      .maybeSingle(),
    kind
      ? db
          .from("presentation_submissions")
          .select("status, version, title")
          .eq("user_id", user.id)
          .eq("kind", kind)
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    db
      .from("announcements")
      .select("id, title, body, level")
      .eq("published", true)
      .in(
        "audience",
        kind ? ["public", "delegates", "presenters"] : ["public", "delegates"],
      )
      .order("pinned", { ascending: false })
      .order("published_at", { ascending: false })
      .limit(3),
    status === "waitlisted"
      ? db.rpc("my_waitlist_position")
      : Promise.resolve({ data: null }),
    presenting
      ? db.from("presenter_attendance").select("response, note, responded_at").eq("user_id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const answer: AttendanceAnswer = attendance
    ? { response: attendance.response as "confirmed" | "unavailable", note: attendance.note, respondedAt: attendance.responded_at }
    : null;

  // One code for everything: delegates scan it to see the card, the check-in desk scans it on the day.
  const cardCode = status === "approved" ? profile.cardCode : null;
  const qr = cardCode
    ? await QRCode.toString(`${SITE_URL}${cardPath(cardCode)}`, {
        errorCorrectionLevel: "M",
        type: "svg",
        margin: 1,
        color: { dark: "#0c182c", light: "#ffffff" },
      })
    : null;
  const photo = showCard ? await signAvatar(db, profile.avatarPath) : null;
  const uniLogo = showCard && profile.institution ? ((await getLogoMap())[uniKey(profile.institution)] ?? null) : null;
  const s = ACCOUNT_STATUS_LABEL[status];
  const subStatus = latestSub
    ? SUBMISSION_STATUS_LABEL[latestSub.status as SubmissionStatus]
    : null;

  const firstName = profile.fullName?.split(" ")[0];
  const steps = [
    { label: "Account approved", done: status === "approved", href: null as string | null },
    { label: "Your details", done: Boolean(profile.fullName && profile.institution), href: "/portal/profile" },
    { label: "A photo of you for your Delegate Card", done: Boolean(profile.avatarPath), href: "/portal/profile#photo" },
    { label: "A short bio for your profile", done: Boolean(profile.bio), href: "/portal/profile#bio" },
    ...(presenting
      ? [{
          label: answer?.response === "unavailable" ? "You've said you can't attend" : "Confirm you'll be there to present",
          done: Boolean(answer),
          href: "#attend-h",
        }]
      : []),
    ...(kind
      ? [{
          label: latestSub?.status === "changes_requested" ? `Update your ${SUBMISSION_LABEL[kind].noun} (feedback waiting)` : `Upload your ${SUBMISSION_LABEL[kind].noun}`,
          done: Boolean(latestSub) && latestSub!.status !== "changes_requested",
          href: "/portal/submission",
        }]
      : []),
  ];
  // Workshop choices: shown to anyone with a confirmed place once ranking has opened.
  const choices = status === "approved" || profile.access.owner ? await loadWorkshopChoices(db, user.id) : null;
  const rankOpen = choices ? rankingIsOpen(choices.settings) : false;
  const rankWorkshops: RankWorkshop[] = (choices?.workshops ?? []).map((w) => ({
    id: w.id,
    slug: w.slug,
    title: w.title,
    strapline: w.strapline,
    pair: pairLabel(w),
    slot: w.slot,
    time: choices?.sessions.find((x) => x.slot === w.slot)?.time ?? null,
  }));
  const myPlaces: RankPlace[] | null =
    choices?.settings.resultsPublished && choices.places.length
      ? choices.places.flatMap((p) => {
          const w = rankWorkshops.find((x) => x.id === p.workshopId);
          const sess = choices.sessions.find((x) => x.slot === p.slot);
          return w ? [{ slot: p.slot, time: sess?.time ?? null, room: sess?.room ?? null, workshop: w, choice: p.choice }] : [];
        })
      : null;
  const closedAfterOpening = Boolean(choices && closingTimePassed(choices.settings));
  const showRanking = Boolean(choices?.settings.ready && rankWorkshops.length && (rankOpen || choices.ranking || myPlaces || closedAfterOpening));
  if (showRanking && rankOpen && !choices!.ranking) steps.push({ label: "Rank the workshops", done: false, href: "#workshops" });
  else if (showRanking && choices!.ranking) steps.push({ label: "Rank the workshops", done: true, href: "#workshops" });
  const doneCount = steps.filter((x) => x.done).length;
  const needsGiven = Boolean(profile.accessibilityNeeds || profile.dietaryRequirements);
  const lanyard = status === "approved" && showCard;

  return (
    <div className="space-y-5 sm:space-y-6">
      {sp.denied && (
        <Notice tone="warning">You don&apos;t have access to that area.</Notice>
      )}
      {sp.password && <Notice>Your password has been updated.</Notice>}
      {hasRole(profile, "oral_waitlist") && status === "approved" && (
        <Notice title="You're on the waiting list for an oral presentation">
          Your delegate place is confirmed. If a presentation slot opens up, the committee will be in touch and your hub will change to let you upload your slides.
        </Notice>
      )}
      {sp.welcome === "first" ? (
        <Notice title="Welcome to INSPIRE">Your password is saved. This is My Hub, where you can get everything ready for the day.</Notice>
      ) : sp.welcome ? (
        <Notice title="Email verified">
          Thank you. Your account is set up.
        </Notice>
      ) : null}

      {lanyard ? (
        // The lanyard carries the name, role, date, venue and countdown, so there's no banner above it.
        <h1 className="sr-only">My Hub{firstName ? `, ${firstName}` : ""}</h1>
      ) : (
        <header className="relative isolate overflow-hidden rounded-2xl bg-midnight px-6 py-8 text-paper sm:px-9 sm:py-10">
          <span aria-hidden className="hub-orb -left-16 -top-20 size-72 bg-navy-600/70" />
          <span aria-hidden className="hub-orb -bottom-24 right-[-4rem] size-80 bg-gold/25 [animation-delay:-6s]" />
          <span aria-hidden className="hub-orb left-1/2 top-1/3 size-52 bg-cyan/15 [animation-delay:-11s]" />
          <div aria-hidden className="lanyard-grid pointer-events-none absolute inset-0 opacity-25" />
          <img src="/brand/crest-white.png" alt="" aria-hidden className="pointer-events-none absolute -bottom-12 -right-8 h-56 w-auto opacity-[0.06]" />
          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="eyebrow text-gold">{rolesLabel(rolesOf(profile.accountType, profile.extraTypes))} · INSPIRE {edition.year}</p>
              <h1 className="mt-3 font-display text-4xl leading-[1.05] sm:text-5xl">
                <MaskRise onMount>Hello{firstName ? `, ${firstName}` : ""}</MaskRise>
              </h1>
              <p className="mt-3 max-w-xl text-paper/75">{edition.theme}</p>
              <p className="mt-5 flex flex-wrap gap-x-5 gap-y-1 text-sm text-paper/75">
                <span className="flex items-center gap-2">
                  <CalendarDays aria-hidden className="size-4 text-cyan" /> {formatEventDate(edition.date)}
                </span>
                <span className="flex items-center gap-2">
                  <MapPin aria-hidden className="size-4 text-cyan" /> {edition.venueName}
                </span>
              </p>
            </div>
            <Countdown date={edition.date} time={edition.startTime} />
          </div>
        </header>
      )}

      <HubStagger className="grid gap-5 sm:gap-6 xl:grid-cols-[minmax(0,1fr)_20.5rem] xl:items-start">
        <div className="min-w-0 space-y-5 sm:space-y-6">
          {showRanking && (
            <HubItem>
              <WorkshopRanking
                workshops={rankWorkshops}
                initial={choices!.ranking}
                rankedAt={choices!.rankedAt}
                open={rankOpen}
                closesAt={choices!.settings.closesAt}
                places={myPlaces}
              />
            </HubItem>
          )}
          {presenting && (
            <HubItem>
              <AttendanceCard
                answer={answer}
                kind={kind!}
                dateLabel={formatEventDate(edition.date)}
                venue={edition.venueName}
              />
            </HubItem>
          )}
          {status === "approved" && !showCard ? (
            <HubItem>
              <section className="flex items-center gap-4 rounded-xl border border-success/25 bg-success/[0.06] p-5 sm:p-6">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-success/15 text-success">
                  <Ticket aria-hidden className="size-5" />
                </span>
                <div>
                  <h2 className="font-semibold text-ink">Your place is confirmed</h2>
                  <p className="text-sm text-slate-700">Use My Hub to get your presentation and profile ready before the day.</p>
                </div>
              </section>
            </HubItem>
          ) : status !== "approved" ? (
            <HubItem>
              <section className="rounded-xl border border-navy/10 bg-white p-5 sm:p-7" aria-labelledby="status-title">
                <div className="flex items-start gap-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-paper-200">
                    {status === "pending" ? (
                      <Hourglass aria-hidden className="size-5 text-navy" />
                    ) : status === "waitlisted" ? (
                      <Clock aria-hidden className="size-5 text-[#7a4a00]" />
                    ) : (
                      <XCircle aria-hidden className="size-5 text-danger" />
                    )}
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
                    {status === "declined" && (
                      <Link href="/portal/enquiries" className={`${linkBtn} mt-4 border border-navy/15 text-ink`}>Contact the committee</Link>
                    )}
                  </div>
                </div>
              </section>
            </HubItem>
          ) : null}

          <HubItem>
            <section aria-labelledby="ready-h" className="rounded-xl border border-navy/10 bg-white p-5 sm:p-7">
              <div className="flex items-center gap-5">
                <ReadinessRing done={doneCount} total={steps.length} />
                <div className="min-w-0">
                  <h2 id="ready-h" className="font-display text-xl text-ink">
                    {doneCount === steps.length ? "You're all set for the day" : "Get ready for INSPIRE"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-700">
                    {doneCount === steps.length ? "Everything we need is in. See you on the day." : `${steps.length - doneCount} ${steps.length - doneCount === 1 ? "thing" : "things"} left to do.`}
                  </p>
                </div>
              </div>
              <ol className="mt-5 divide-y divide-navy/5 border-t border-navy/5">
                {steps.map((x) => {
                  const inner = (
                    <>
                      <span className={`grid size-7 shrink-0 place-items-center rounded-full ${x.done ? "bg-success text-white" : "border-2 border-navy/15 text-transparent"}`}>
                        <Check aria-hidden className="size-4" />
                      </span>
                      <span className={`min-w-0 flex-1 ${x.done ? "text-slate-700" : "font-semibold text-ink"}`}>
                        {x.label}
                        <span className="sr-only">{x.done ? ", done" : ", to do"}</span>
                      </span>
                      {x.href && !x.done && <ArrowRight aria-hidden className="size-4 shrink-0 text-slate transition-transform group-hover:translate-x-1" />}
                    </>
                  );
                  return (
                    <li key={x.label}>
                      {x.href && !x.done ? (
                        <Link href={x.href} className="group flex min-h-12 items-center gap-3 py-2.5 text-sm">{inner}</Link>
                      ) : (
                        <span className="flex min-h-12 items-center gap-3 py-2.5 text-sm">{inner}</span>
                      )}
                    </li>
                  );
                })}
              </ol>
              <p className="mt-3 text-xs text-slate">
                Optional: {needsGiven ? "thank you for telling us about your access or dietary needs." : "tell us about any access or dietary needs."}{" "}
                <Link href="/portal/profile#needs" className="font-semibold text-electric-600 underline underline-offset-4">{needsGiven ? "Review" : "Add them"}</Link>
              </p>
            </section>
          </HubItem>

          {kind && (
            <HubItem>
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
                    {status === "approved"
                      ? `You haven't uploaded your ${SUBMISSION_LABEL[kind].noun} yet.`
                      : `You can upload your ${SUBMISSION_LABEL[kind].noun} once your account is approved.`}
                  </p>
                )}
                <Link href="/portal/submission" className={`${linkBtn} mt-4 w-full bg-navy text-paper sm:w-auto`}>
                  {latestSub
                    ? latestSub.status === "changes_requested"
                      ? "See feedback and upload a new version"
                      : "View submission"
                    : `Upload ${SUBMISSION_LABEL[kind].noun}`}{" "}
                  <ArrowRight aria-hidden className="size-4" />
                </Link>
              </Card>
            </HubItem>
          )}

          {profile.access.owner && (
            <HubItem>
              <Link href="/admin/platform" className="group flex items-center gap-4 rounded-xl border border-cyan/40 bg-midnight p-5 text-paper transition-colors hover:border-cyan sm:p-6">
                <Gauge aria-hidden className="size-6 shrink-0 text-cyan" />
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-xl">Platform dashboard</span>
                  <span className="block text-sm text-paper/75">Site switches, view as anyone, who can do what, accounts and submissions</span>
                </span>
                <ArrowRight aria-hidden className="size-5 shrink-0 transition-transform group-hover:translate-x-1" />
              </Link>
            </HubItem>
          )}

          {profile.access.committee && (
            <HubItem>
              <Link href="/admin" className="group flex items-center gap-4 rounded-xl bg-navy p-5 text-paper sm:p-6">
                <LayoutDashboard aria-hidden className="size-6 shrink-0 text-cyan" />
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-xl">Committee dashboard</span>
                  <span className="block text-sm text-paper/75">Accounts, slides and posters, and editing the website</span>
                </span>
                <ArrowRight aria-hidden className="size-5 shrink-0 transition-transform group-hover:translate-x-1" />
              </Link>
            </HubItem>
          )}

          {focus ? (
            <HubItem>
              <Card title="Your profile" icon={UserRound}>
                <p className="text-slate-700">Check your details, add a short bio and LinkedIn, and tell us about any access or dietary needs.</p>
                <Link href="/portal/profile" className={`${linkBtn} mt-4 w-full bg-navy text-paper sm:w-auto`}>
                  Go to your profile <ArrowRight aria-hidden className="size-4" />
                </Link>
              </Card>
            </HubItem>
          ) : (
            <div className="grid gap-5 sm:gap-6 2xl:grid-cols-2">
              <HubItem>
                <Card title="My agenda" icon={CalendarDays}>
                  <SavedAgenda sessions={sessions} workshops={workshops} />
                </Card>
              </HubItem>
              {(announcements?.length ?? 0) > 0 && (
                <HubItem>
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
                </HubItem>
              )}
              <HubItem>
                <Card title="Access and dietary needs" icon={HeartHandshake}>
                  <p className="text-slate-700">
                    {needsGiven
                      ? "Thank you. The committee has your details for the day."
                      : "Tell us about anything that would make the day easier for you, such as step-free access, a quiet space or dietary needs."}
                  </p>
                  <Link href="/portal/profile#needs" className="mt-3 inline-flex min-h-11 items-center gap-2 font-semibold text-electric-600">
                    {needsGiven ? "Review your details" : "Add your needs"} <ArrowRight aria-hidden className="size-4" />
                  </Link>
                </Card>
              </HubItem>
            </div>
          )}
        </div>

        {lanyard && (
          <aside aria-labelledby="lanyard-h" className="order-first xl:sticky xl:top-28 xl:order-last">
            <h2 id="lanyard-h" className="sr-only">Your INSPIRE {edition.year} lanyard</h2>
            <Lanyard
              year={edition.year}
              theme={edition.theme}
              name={profile.fullName ?? profile.email}
              photo={photo}
              uniLogo={uniLogo}
              detail={[profile.institution, profile.yearOfStudy].filter(Boolean).join(" · ") || null}
              roles={lanyardRoles(profile)}
              dateLabel={formatEventDate(edition.date, { weekday: "short", month: "short" })}
              venue={edition.venueName}
              qr={qr}
              reference={cardCode ? formatCode(cardCode) : null}
              checkedIn={Boolean(registration?.checked_in_at)}
              shared={profile.cardShared}
              previewHref={cardCode ? cardPath(cardCode) : null}
              countdown={{ date: edition.date, time: edition.startTime }}
              previewNote={!switches.delegate_card ? "Only you can see this card for now. Turn on the Delegate card switch in the Platform dashboard to show it to everyone." : null}
            />
          </aside>
        )}
      </HubStagger>
    </div>
  );
}
