import Link from "next/link";
import { Suspense } from "react";
import QRCode from "qrcode";
import {
  ArrowRight,
  CalendarDays,
  Clock,
  Gauge,
  UserRound,
  Hourglass,
  LayoutDashboard,
  MapPin,
  Presentation,
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
import { getConferenceBundle, getSponsors } from "@/lib/data/content";
import { formatEventDate, formatTime } from "@/lib/time";
import { cleanRoomName } from "@/lib/orals/room-name";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/notice";
import { SavedAgenda } from "@/components/portal/saved-agenda";
import { HubAnnouncements, HubChecklist } from "@/components/portal/hub-sections";
import { Lanyard } from "@/components/portal/lanyard";
import { isGoldCard, type LanyardTone } from "@/lib/lanyard-tone";
import { Countdown, HubItem, HubStagger } from "@/components/portal/hub-motion";
import { MaskRise } from "@/components/motion/effects";
import { AttendanceCard, type AttendanceAnswer } from "@/components/portal/attendance-card";
import { TravelCard } from "@/components/portal/travel-card";
import { WhatsAppCard } from "@/components/portal/whatsapp-card";
import { ParkingCard } from "@/components/portal/parking-card";
import { GuestHub } from "@/components/portal/guest-hub";
import { CardDock } from "@/components/portal/card-dock";
import { isTravelMode, type TravelAnswer } from "@/lib/travel";
import { HubScanner } from "@/components/day/hub-scanner";
import { MyDayCard } from "@/components/day/my-day-card";
import { workshopSlots } from "@/lib/day/plan";
import { WorkshopRanking, type RankPlace, type RankWorkshop } from "@/components/portal/workshop-ranking";
import { closingTimePassed, loadWorkshopChoices, rankingIsOpen } from "@/lib/workshops/choices";
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
  isStaffOnly,
} from "@/lib/accounts";
import type { AccountType, SubmissionStatus } from "@/lib/types";
import { getMyResearch, needsDecision } from "@/lib/research/server";
import { STAGE_LABEL } from "@/lib/research/instrument";
import { formatWhen, windowOf } from "@/lib/research/schedule";
import { ResearchTaskCard } from "@/components/research/research-task-card";
import { getPostConference } from "@/lib/post-conference/server";
import { PartyPopper } from "lucide-react";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Card({
  title,
  icon: Icon,
  children,
  className = "",
  tone = "tone-navy",
}: {
  title: string;
  icon: typeof Ticket;
  tone?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`app-card p-4 sm:p-5 ${className}`}
    >
      <h2 className="flex items-center gap-2 font-display text-lg text-ink">
        <span className={`icon-chip-sm ${tone}`}>
          <Icon aria-hidden className="size-4" />
        </span>
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

const TONE: Partial<Record<AccountType, LanyardTone>> = { delegate: "delegate", poster_presenter: "poster", oral_presenter: "oral", oral_waitlist: "waitlist", speaker: "guest", judge: "guest" };

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
  "tap inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-5 font-ui text-sm font-semibold";

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
  const kind = presenterKindOf(profile);
  const status = profile.accountStatus;
  // Approved oral and poster presenters confirm whether they'll be there to present.
  const presenting = Boolean(kind) && status === "approved";
  // Staff (speakers, workshop leads, judges) skip delegate tasks: no checklist, workshop ranking or travel question.
  const staffOnly = isStaffOnly(profile.accountType, profile.extraTypes);
  const wantChoices = !staffOnly && (status === "approved" || profile.access.owner || profile.access.can.allocate_workshops);
  // One code for everything: delegates scan it to see the card, the check-in desk scans it on the day.
  const cardCode = status === "approved" ? profile.cardCode : null;

  // Everything below is fetched at once rather than one query after another,
  // so the hub costs about one round trip to the database instead of eight.
  const switchesP = getSwitches();
  const contentP = Promise.all([getConferenceBundle(), getSponsors()]);
  const cardShownP = switchesP.then((sw) => sw.delegate_card || profile.access.owner);
  const [
    switches,
    [{ edition, sessions, workshops, rooms }, sponsors],
    { data: registration },
    { data: latestSub },
    { data: announcements },
    { data: waitPos },
    { data: attendance },
    { data: travel },
    qr,
    photo,
    uniLogo,
    choices,
    research,
    { data: oralTalk },
  ] = await Promise.all([
    switchesP,
    contentP,
    contentP.then(([b]) =>
      db
        .from("registrations")
        .select("status, checkin_token, checked_in_at")
        .eq("user_id", user.id)
        .eq("edition_id", b.edition.id)
        .maybeSingle(),
    ),
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
      .select("id, title, body, level, pinned, published_at")
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
    // Before setup SQL 36 the table isn't there; the query just returns nothing and the card asks.
    status === "approved"
      ? db.from("delegate_travel").select("mode, car_registration, updated_at").eq("user_id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    cardCode
      ? QRCode.toString(`${SITE_URL}${cardPath(cardCode)}`, {
          errorCorrectionLevel: "M",
          type: "svg",
          margin: 1,
          color: { dark: "#0c182c", light: "#ffffff" },
        })
      : null,
    cardShownP.then((shown) => (shown ? signAvatar(db, profile.avatarPath) : null)),
    cardShownP.then(async (shown) => (shown && profile.institution ? ((await getLogoMap())[uniKey(profile.institution)] ?? null) : null)),
    // Workshop choices: shown to anyone with a confirmed place once ranking has opened.
    wantChoices ? contentP.then(([b]) => loadWorkshopChoices(db, user.id, UUID.test(b.edition.id) ? b.edition.id : undefined)) : null,
    // The research study: invited delegates are asked to answer the invitation, either way.
    getMyResearch(db, profile),
    // An oral presenter's room, once the committee shows it. Nothing before the oral rooms setup file is run.
    // Everyone else: their room for all the oral presentations, once shown.
    presenting && kind === "slides"
      ? Promise.resolve(db.rpc("my_oral_talk")).then((r) => (r.error ? { data: null } : r), () => ({ data: null }))
      : status === "approved"
        ? Promise.resolve(db.rpc("my_oral_room")).then((r) => (r.error ? { data: null } : r), () => ({ data: null }))
        : Promise.resolve({ data: null }),
  ]);
  // Same request as the layout, so this is already loaded.
  const after = await getPostConference(db, profile);
  const showCard = switches.delegate_card || profile.access.owner;
  // While the website is closed, delegates only use My Hub for their profile and their slides or poster.
  const focus =
    !switches.site_open && !profile.access.committee && !profile.access.owner;
  const travelAnswer: TravelAnswer =
    travel && isTravelMode(travel.mode) ? { mode: travel.mode, carRegistration: travel.car_registration, updatedAt: travel.updated_at } : null;
  const answer: AttendanceAnswer = attendance
    ? { response: attendance.response as "confirmed" | "unavailable", note: attendance.note, respondedAt: attendance.responded_at }
    : null;

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
    ...(status === "approved" && !staffOnly
      ? [{ label: "Tell us how you're getting here", done: Boolean(travelAnswer), href: "#travel" }]
      : []),
    ...(kind
      ? [{
          label: latestSub?.status === "changes_requested" ? `Update your ${SUBMISSION_LABEL[kind].noun} (feedback waiting)` : `Upload your ${SUBMISSION_LABEL[kind].noun}`,
          done: Boolean(latestSub) && latestSub!.status !== "changes_requested",
          href: "/portal/submission",
        }]
      : []),
  ];
  if (needsDecision(research)) steps.push({ label: `Complete the research study by ${formatWhen(research.settings.preClosesAt)}`, done: false, href: "/portal/research" });
  else if (research.due) steps.push({ label: `Research study: ${STAGE_LABEL[research.due].title.toLowerCase()} questionnaire`, done: false, href: `/portal/research/${research.due}` });
  else if (research.eligible && research.decision && research.settings.enabled) steps.push({ label: "Research study", done: true, href: "/portal/research" });
  const rankOpen = choices ? rankingIsOpen(choices.settings) : false;
  const rankWorkshops: RankWorkshop[] = (choices?.workshops ?? []).map((w) => ({
    number: w.number,
    summary: w.summary ?? null,
    description: w.description ?? null,
    topics: w.topics ?? [],
    outcomes: w.outcomes ?? [],
    audience: w.audience ?? null,
    facilitator: w.facilitator ?? null,
    id: w.id,
    slug: w.slug,
    title: w.title,
    strapline: w.strapline,
    room: w.room ?? null,
  }));
  const myPlaces: RankPlace[] | null =
    choices?.settings.resultsPublished && choices.places.length
      ? choices.places.flatMap((p) => {
          const w = rankWorkshops.find((x) => x.id === p.workshopId);
          const sess = choices.sessions.find((x) => x.slot === p.slot);
          return w ? [{ slot: p.slot, time: sess?.time ?? null, room: w.room ?? sess?.room ?? null, workshop: w, choice: p.choice }] : [];
        })
      : null;
  const closedAfterOpening = Boolean(choices && closingTimePassed(choices.settings));
  const showRanking = Boolean(choices?.settings.ready && rankWorkshops.length && (rankOpen || choices.ranking || myPlaces || closedAfterOpening));
  // Before ranking opens, the people who run workshop places see a private preview.
  const rankPreview = Boolean(!showRanking && choices?.settings.ready && rankWorkshops.length && profile.access.can.allocate_workshops);
  const rankBy = choices?.settings.closesAt
    ? new Date(choices.settings.closesAt).toLocaleString("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }).replace(":00", "")
    : null;
  if (showRanking && rankOpen && !choices!.ranking) steps.push({ label: rankBy ? `Rank your workshops by ${rankBy}` : "Rank your workshops", done: false, href: "#workshops" });
  else if (showRanking && choices!.ranking) steps.push({ label: "Rank your workshops", done: true, href: "#workshops" });
  const needsGiven = Boolean(profile.accessibilityNeeds || profile.dietaryRequirements);
  const lanyard = status === "approved" && showCard;
  // The WhatsApp group: confirmed delegates and the committee, once the switch is on. Whoever runs the switches can preview it.
  const canSwitch = profile.access.owner || profile.access.can.manage_platform;
  const whatsapp = switches.whatsapp_group ? status === "approved" || profile.access.committee || profile.access.owner : canSwitch;

  const attendPending = presenting && !answer;
  const travelPending = status === "approved" && !travelAnswer && !staffOnly;

  // Where an oral presenter gives their talk.
  const talk = oralTalk as { session_id: string; position?: number; of?: number } | null;
  const talkSession = talk ? sessions.find((x) => x.id === talk.session_id) : undefined;
  const talkRoom = talkSession?.roomId ? rooms.find((r) => r.id === talkSession.roomId) : undefined;
  const talkPlace = talkSession ? (talkRoom ? cleanRoomName(talkRoom.name) : talkSession.title.split(/:\s/).slice(1).join(": ") || talkSession.title) : null;

  // Short answers (travel, attendance, slides) sit side by side as slim tiles.
  const tiles = [
    talk && talkSession && (
      <section key="talk" aria-labelledby="talk-h" className="app-card flex items-center gap-3 p-3 pr-2 sm:p-4 sm:pr-3">
        <span className="icon-chip tone-gold">
          <Presentation aria-hidden className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="talk-h" className="font-ui text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate">
            {talk.position ? "Your talk" : "Your oral presentations room"}
          </h2>
          <p className="text-sm font-semibold leading-snug text-ink">
            {talk.position ? `${talkPlace}, talk ${talk.position} of ${talk.of}` : `${talkPlace}, for all the talks`}
          </p>
          <p className="text-xs leading-snug text-slate-700">
            {[talkRoom?.building, talkSession.startsAt ? `Session ${formatTime(talkSession.startsAt)}${talkSession.endsAt ? ` to ${formatTime(talkSession.endsAt)}` : ""}` : null].filter(Boolean).join(" · ")}
          </p>
        </div>
        {talkRoom && (
          <Link
            href={`/map?room=${talkRoom.id}`}
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 font-ui text-sm font-semibold text-electric-600 tap hover:bg-paper-200"
          >
            Map
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        )}
      </section>
    ),
    presenting && !attendPending && (
      <AttendanceCard key="attend" answer={answer} kind={kind!} dateLabel={formatEventDate(edition.date)} venue={edition.venueName} />
    ),
    status === "approved" && !travelPending && !staffOnly && <TravelCard key="travel" answer={travelAnswer} />,
    status === "approved" && staffOnly && (
      <ParkingCard key="parking" registration={travelAnswer?.mode === "car" ? travelAnswer.carRegistration : null} />
    ),
    kind && (
      <section key="sub" aria-labelledby="sub-h" className="app-card flex items-center gap-3 p-3 pr-2 sm:p-4 sm:pr-3">
        <span className="icon-chip tone-gold">
          <UploadCloud aria-hidden className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="sub-h" className="font-ui text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate">
            {kind === "slides" ? "Your slides" : "Your poster"}
          </h2>
          {latestSub ? (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink">
              <span className="line-clamp-2 font-semibold leading-snug">{latestSub.title}</span>
              <Badge tone={subStatus!.tone}>{subStatus!.label}</Badge>
              <span className="text-xs text-slate">v{latestSub.version}</span>
            </p>
          ) : (
            <p className="text-sm font-semibold leading-snug text-ink">
              {status === "approved" ? "Not uploaded yet" : "Opens once you're approved"}
            </p>
          )}
        </div>
        <Link
          href="/portal/submission"
          className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 font-ui text-sm font-semibold tap ${latestSub && latestSub.status !== "changes_requested" ? "text-electric-600 hover:bg-paper-200" : "bg-navy text-paper"}`}
        >
          {latestSub ? (latestSub.status === "changes_requested" ? "See feedback" : "View") : "Upload"}
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </section>
    ),
    status === "approved" && !showCard && (
      <section key="place" className="flex items-center gap-3 rounded-xl border border-success/25 bg-success/[0.06] p-3 sm:p-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-success/15 text-success">
          <Ticket aria-hidden className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="font-semibold leading-snug text-ink">Your place is confirmed</h2>
          <p className="text-sm text-slate-700">Get your presentation and profile ready before the day.</p>
        </div>
      </section>
    ),
  ].filter(Boolean);

  // The on-the-day scanner: committee members, right at the top of their hub.
  const can = profile.access.can;
  const scanner = profile.access.owner || can.day_scanner || can.check_in || can.allocate_workshops;
  const slotOf = workshopSlots(sessions);
  const scannerSessions = sessions
    .filter((x) => slotOf.has(x.id))
    .map((x) => ({ slot: slotOf.get(x.id)!, title: x.title, startsAt: x.startsAt, endsAt: x.endsAt }))
    .sort((a, b) => a.slot - b.slot);

  const dashboards = (profile.access.can.manage_platform || profile.access.committee) && (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
      {profile.access.can.manage_platform && (
        <Link href="/admin/platform" className="group flex items-center gap-3 tap rounded-2xl border border-cyan/40 bg-midnight px-4 py-3.5 text-paper transition-colors hover:border-cyan">
          <Gauge aria-hidden className="size-5 shrink-0 text-cyan" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold leading-snug">Platform dashboard</span>
            <span className="block truncate text-xs text-paper/70">{profile.access.owner ? "Switches, view as anyone, access, accounts" : "Switches, access, activity and metrics"}</span>
          </span>
          <ArrowRight aria-hidden className="size-4 shrink-0 transition-transform group-hover:translate-x-1" />
        </Link>
      )}
      {profile.access.committee && (
        <Link href="/admin" className="group flex items-center gap-3 tap rounded-2xl bg-gradient-to-br from-navy to-navy-600 px-4 py-3.5 text-paper">
          <LayoutDashboard aria-hidden className="size-5 shrink-0 text-cyan" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold leading-snug">Committee dashboard</span>
            <span className="block truncate text-xs text-paper/70">Accounts, submissions, the website</span>
          </span>
          <ArrowRight aria-hidden className="size-4 shrink-0 transition-transform group-hover:translate-x-1" />
        </Link>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
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
        <header className="relative isolate overflow-hidden rounded-2xl bg-midnight px-5 py-5 text-paper sm:px-7 sm:py-6">
          <span aria-hidden className="hub-orb -left-16 -top-20 size-60 bg-navy-600/70" />
          <span aria-hidden className="hub-orb -bottom-24 right-[-4rem] size-64 bg-gold/25 [animation-delay:-6s]" />
          <div aria-hidden className="lanyard-grid pointer-events-none absolute inset-0 opacity-25" />
          <img src="/brand/crest-white.png" alt="" aria-hidden className="pointer-events-none absolute -bottom-10 -right-6 h-40 w-auto opacity-[0.06]" />
          <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              <p className="eyebrow text-gold">{rolesLabel(rolesOf(profile.accountType, profile.extraTypes))} · INSPIRE {edition.year}</p>
              <h1 className="mt-1.5 font-display text-3xl leading-[1.05] sm:text-4xl">
                <MaskRise onMount>Hello{firstName ? `, ${firstName}` : ""}</MaskRise>
              </h1>
              <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-paper/75">
                <span className="flex items-center gap-1.5">
                  <CalendarDays aria-hidden className="size-4 text-cyan" /> {formatEventDate(edition.date)}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin aria-hidden className="size-4 text-cyan" /> {edition.venueName}
                </span>
              </p>
            </div>
            <Countdown date={edition.date} time={edition.startTime} />
          </div>
        </header>
      )}

      {after.member && (after.done || profile.access.owner) && (
        <Link
          href="/portal/after"
          className="group relative isolate flex items-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-br from-navy to-navy-600 p-4 text-paper shadow-[var(--shadow-soft)] tap sm:p-5"
        >
          <span aria-hidden className="hub-orb -right-10 -top-16 size-44 bg-gold/30" />
          <span className="icon-chip bg-gold/20 text-gold-300">
            <PartyPopper aria-hidden className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-lg leading-tight">Post-conference hub</span>
            <span className="block text-sm text-paper/75">Photos from the day, certificates, the booklet{kind ? " and judges' feedback" : ""}</span>
          </span>
          <ArrowRight aria-hidden className="size-5 shrink-0 transition-transform group-hover:translate-x-1" />
        </Link>
      )}

      {needsDecision(research) ? (
        <ResearchTaskCard
          title="Research study"
          detail={`About 5 minutes. Please complete by ${formatWhen(research.settings.preClosesAt)}.`}
          href="/portal/research"
          cta="Start"
        />
      ) : research.due ? (
        <ResearchTaskCard
          title={`Research study: ${STAGE_LABEL[research.due].title.toLowerCase()}`}
          detail={`About ${STAGE_LABEL[research.due].minutes} minutes. Open until ${formatWhen(windowOf(research.settings, research.due).closes)}.`}
          href={`/portal/research/${research.due}`}
          cta="Start now"
        />
      ) : null}

      <HubStagger className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20.5rem] xl:grid-rows-[auto_1fr] xl:items-start">
        {/* Side column on wide screens; on phones the card folds into a bar and the to-do list comes first. */}
        <div className="min-w-0 space-y-4 xl:col-start-2 xl:row-start-1">
          {lanyard && (
            <HubItem>
              <aside aria-labelledby="lanyard-h">
                <h2 id="lanyard-h" className="sr-only">Your INSPIRE {edition.year} lanyard</h2>
                <CardDock year={edition.year} name={profile.fullName ?? profile.email} role={rolesLabel(rolesOf(profile.accountType, profile.extraTypes))} photo={photo} gold={isGoldCard(lanyardRoles(profile))}>
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
                    sponsors={sponsors.filter((s) => s.onCard)}
                    previewNote={!switches.delegate_card ? "Only you can see this card for now. Turn on the Delegate card switch in the Platform dashboard to show it to everyone." : null}
                  />
                </CardDock>
              </aside>
            </HubItem>
          )}

          {!staffOnly && (
            <HubItem>
              <HubChecklist steps={steps} needsGiven={needsGiven} />
            </HubItem>
          )}

          {whatsapp && (
            <HubItem>
              <WhatsAppCard previewNote={!switches.whatsapp_group ? "Only you can see this for now. Turn on the WhatsApp group switch in the Platform dashboard to show it to delegates." : null} />
            </HubItem>
          )}

          {!focus && (announcements?.length ?? 0) > 0 && (
            <HubItem>
              <HubAnnouncements items={announcements!} />
            </HubItem>
          )}
        </div>

        {dashboards && <HubItem className="order-last xl:order-none xl:col-start-2 xl:row-start-2">{dashboards}</HubItem>}

        <div className="min-w-0 space-y-4 xl:col-start-1 xl:row-span-2 xl:row-start-1">
          {scanner && (
            <HubItem>
              <HubScanner
                workshops={workshops.map((w) => ({ id: w.id, number: w.number, title: w.title, slug: w.slug, room: w.room ?? null }))}
                sessions={scannerSessions}
                canCheckIn={profile.access.owner || can.check_in || can.manage_people}
              />
            </HubItem>
          )}
          {status === "approved" && !focus && (
            <Suspense fallback={null}>
              <MyDayCard db={db} userId={user.id} />
            </Suspense>
          )}
          {status !== "approved" && (
            <HubItem>
              <section className="app-card p-4 sm:p-5" aria-labelledby="status-title">
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-paper-200">
                    {status === "pending" ? (
                      <Hourglass aria-hidden className="size-5 text-navy" />
                    ) : status === "waitlisted" ? (
                      <Clock aria-hidden className="size-5 text-[#7a4a00]" />
                    ) : (
                      <XCircle aria-hidden className="size-5 text-danger" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <h2 id="status-title" className="flex flex-wrap items-center gap-x-2 gap-y-1 font-display text-xl text-ink">
                      {status === "pending" ? "We're reviewing your account" : status === "waitlisted" ? "You're on the waitlist" : "Your account wasn't approved"}
                      <Badge tone={s.tone}>{s.label}</Badge>
                    </h2>
                    <p className="mt-1.5 text-sm text-slate-700">
                      {status === "pending"
                        ? "The executive committee checks every new account. We'll email you as soon as yours is approved."
                        : status === "waitlisted"
                          ? `Places are full right now.${waitPos ? ` You're number ${waitPos} in the queue.` : ""} If a place opens up, we'll approve your account and email you straight away.`
                          : "If you think this is a mistake, please get in touch and we'll take another look."}
                    </p>
                    {profile.reviewNote && <p className="mt-2 rounded-md bg-paper p-2.5 text-sm text-ink">Note from the committee: {profile.reviewNote}</p>}
                    {status === "declined" && (
                      <Link href="/portal/enquiries" className={`${linkBtn} mt-3 border border-navy/15 text-ink`}>Contact the committee</Link>
                    )}
                  </div>
                </div>
              </section>
            </HubItem>
          )}

          <GuestHub db={db} profile={profile} />

          {(showRanking || rankPreview) && (
            <HubItem>
              <WorkshopRanking
                workshops={rankWorkshops}
                initial={choices!.ranking}
                rankedAt={choices!.rankedAt}
                open={rankOpen}
                closesAt={choices!.settings.closesAt}
                places={myPlaces}
                preview={rankPreview}
                canEdit={profile.access.owner || profile.access.can.edit_workshops}
              />
            </HubItem>
          )}
          {attendPending && (
            <HubItem>
              <AttendanceCard answer={answer} kind={kind!} dateLabel={formatEventDate(edition.date, { weekday: "short", month: "short" })} venue={edition.venueName} />
            </HubItem>
          )}
          {travelPending && (
            <HubItem>
              <TravelCard answer={travelAnswer} />
            </HubItem>
          )}
          {tiles.length > 0 && (
            <HubItem>
              <div className="grid gap-3 lg:grid-cols-2">{tiles}</div>
            </HubItem>
          )}

          {focus ? (
            <HubItem>
              <Card title="Your profile" icon={UserRound} tone="tone-plum">
                <p className="text-sm text-slate-700">Check your details, add a short bio and LinkedIn, and tell us about any access or dietary needs.</p>
                <Link href="/portal/profile" className={`${linkBtn} mt-3 w-full bg-navy text-paper sm:w-auto`}>
                  Go to your profile <ArrowRight aria-hidden className="size-4" />
                </Link>
              </Card>
            </HubItem>
          ) : (
            <HubItem>
              <Card title="My agenda" icon={CalendarDays} tone="tone-sky">
                <SavedAgenda sessions={sessions} workshops={workshops} />
              </Card>
            </HubItem>
          )}
        </div>
      </HubStagger>
    </div>
  );
}
