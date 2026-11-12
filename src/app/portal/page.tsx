import Link from "next/link";
import QRCode from "qrcode";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock,
  Gauge,
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
import { getConferenceBundle, getSponsors } from "@/lib/data/content";
import { formatEventDate } from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/notice";
import { SavedAgenda } from "@/components/portal/saved-agenda";
import { Lanyard, type LanyardTone } from "@/components/portal/lanyard";
import { Countdown, HubItem, HubStagger, ReadinessRing } from "@/components/portal/hub-motion";
import { MaskRise } from "@/components/motion/effects";
import { AttendanceCard, type AttendanceAnswer } from "@/components/portal/attendance-card";
import { TravelCard } from "@/components/portal/travel-card";
import { CardDock } from "@/components/portal/card-dock";
import { isTravelMode, type TravelAnswer } from "@/lib/travel";
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
      className={`rounded-xl border border-navy/10 bg-white p-4 transition-shadow duration-300 hover:shadow-[0_14px_34px_-22px_rgba(14,27,49,0.45)] sm:p-5 ${className}`}
    >
      <h2 className="flex items-center gap-2 font-display text-lg text-ink">
        <Icon aria-hidden className="size-4 text-electric-600" /> {title}
      </h2>
      <div className="mt-2.5">{children}</div>
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
  const [{ edition, sessions, workshops }, sponsors] = await Promise.all([getConferenceBundle(), getSponsors()]);
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
    { data: travel },
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
    // Before setup SQL 36 the table isn't there; the query just returns nothing and the card asks.
    status === "approved"
      ? db.from("delegate_travel").select("mode, car_registration, updated_at").eq("user_id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const travelAnswer: TravelAnswer =
    travel && isTravelMode(travel.mode) ? { mode: travel.mode, carRegistration: travel.car_registration, updatedAt: travel.updated_at } : null;
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
    ...(status === "approved"
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
  // Workshop choices: shown to anyone with a confirmed place once ranking has opened.
  const choices = status === "approved" || profile.access.owner || profile.access.can.allocate_workshops ? await loadWorkshopChoices(db, user.id) : null;
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
  const doneCount = steps.filter((x) => x.done).length;
  const needsGiven = Boolean(profile.accessibilityNeeds || profile.dietaryRequirements);
  const lanyard = status === "approved" && showCard;

  const attendPending = presenting && !answer;
  const travelPending = status === "approved" && !travelAnswer;
  const todo = steps.filter((x) => !x.done);
  const done = steps.filter((x) => x.done);

  // Short answers (travel, attendance, slides) sit side by side as slim tiles.
  const tiles = [
    presenting && !attendPending && (
      <AttendanceCard key="attend" answer={answer} kind={kind!} dateLabel={formatEventDate(edition.date)} venue={edition.venueName} />
    ),
    status === "approved" && !travelPending && <TravelCard key="travel" answer={travelAnswer} />,
    kind && (
      <section key="sub" aria-labelledby="sub-h" className="flex items-center gap-3 rounded-xl border border-navy/10 bg-white p-3 pr-2 sm:p-4 sm:pr-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-paper-200 text-electric-600">
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
          className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-[3px] px-3 font-ui text-sm font-semibold ${latestSub && latestSub.status !== "changes_requested" ? "text-electric-600 hover:bg-paper-200" : "bg-navy text-paper"}`}
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

  const dashboards = (profile.access.owner || profile.access.committee) && (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
      {profile.access.owner && (
        <Link href="/admin/platform" className="group flex items-center gap-3 rounded-xl border border-cyan/40 bg-midnight px-4 py-3 text-paper transition-colors hover:border-cyan">
          <Gauge aria-hidden className="size-5 shrink-0 text-cyan" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold leading-snug">Platform dashboard</span>
            <span className="block truncate text-xs text-paper/70">Switches, view as anyone, access, accounts</span>
          </span>
          <ArrowRight aria-hidden className="size-4 shrink-0 transition-transform group-hover:translate-x-1" />
        </Link>
      )}
      {profile.access.committee && (
        <Link href="/admin" className="group flex items-center gap-3 rounded-xl bg-navy px-4 py-3 text-paper">
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

      <HubStagger className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20.5rem] xl:grid-rows-[auto_1fr] xl:items-start">
        {/* Side column on wide screens; on phones the card folds into a bar and the to-do list comes first. */}
        <div className="min-w-0 space-y-4 xl:col-start-2 xl:row-start-1">
          {lanyard && (
            <HubItem>
              <aside aria-labelledby="lanyard-h">
                <h2 id="lanyard-h" className="sr-only">Your INSPIRE {edition.year} lanyard</h2>
                <CardDock year={edition.year} name={profile.fullName ?? profile.email} role={rolesLabel(rolesOf(profile.accountType, profile.extraTypes))} photo={photo}>
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

          <HubItem>
            <section aria-labelledby="ready-h" className="rounded-xl border border-navy/10 bg-white p-4">
              <div className="flex items-center gap-3">
                <ReadinessRing small done={doneCount} total={steps.length} />
                <div className="min-w-0">
                  <h2 id="ready-h" className="font-display text-lg leading-tight text-ink">
                    {todo.length === 0 ? "You're all set for the day" : "Get ready for INSPIRE"}
                  </h2>
                  <p className="text-sm text-slate-700">
                    {todo.length === 0 ? "Everything we need is in. See you on the day." : `${todo.length} ${todo.length === 1 ? "thing" : "things"} left to do`}
                  </p>
                </div>
              </div>
              {todo.length > 0 && (
                <ol aria-label="Still to do" className="mt-3 flex flex-wrap gap-1.5">
                  {todo.map((x) => {
                    const inner = (
                      <>
                        <span aria-hidden className="size-3.5 shrink-0 rounded-full border-2 border-gold" />
                        <span className="min-w-0">
                          {x.label}
                          <span className="sr-only">, to do</span>
                        </span>
                        {x.href && <ArrowRight aria-hidden className="size-3.5 shrink-0 text-slate transition-transform group-hover:translate-x-0.5" />}
                      </>
                    );
                    const cls = "flex min-h-10 items-center gap-2 rounded-full border border-gold/50 bg-gold/[0.08] py-1.5 pl-2.5 pr-3 text-[0.8rem] font-semibold leading-snug text-ink";
                    return (
                      <li key={x.label}>
                        {x.href ? (
                          <Link href={x.href} className={`group ${cls} hover:bg-paper-200`}>{inner}</Link>
                        ) : (
                          <span className={cls}>{inner}</span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
              {done.length > 0 && (
                <ul aria-label="Done" className="mt-2.5 flex flex-wrap gap-1.5">
                  {done.map((x) => (
                    <li key={x.label} className="inline-flex items-center gap-1 rounded-full bg-success/10 py-0.5 pl-1 pr-2 text-xs font-medium text-success">
                      <Check aria-hidden className="size-3.5" />
                      {x.label}
                      <span className="sr-only">, done</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2.5 text-xs text-slate">
                Optional: {needsGiven ? "thank you for telling us about your access or dietary needs." : "any access or dietary needs?"}{" "}
                <Link href="/portal/profile#needs" className="font-semibold text-electric-600 underline underline-offset-4">{needsGiven ? "Review" : "Add them"}</Link>
              </p>
            </section>
          </HubItem>
        </div>

        {dashboards && <HubItem className="order-last xl:order-none xl:col-start-2 xl:row-start-2">{dashboards}</HubItem>}

        <div className="min-w-0 space-y-4 xl:col-start-1 xl:row-span-2 xl:row-start-1">
          {status !== "approved" && (
            <HubItem>
              <section className="rounded-xl border border-navy/10 bg-white p-4 sm:p-5" aria-labelledby="status-title">
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
                canEdit={profile.access.can.edit_website}
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
              <Card title="Your profile" icon={UserRound}>
                <p className="text-sm text-slate-700">Check your details, add a short bio and LinkedIn, and tell us about any access or dietary needs.</p>
                <Link href="/portal/profile" className={`${linkBtn} mt-3 w-full bg-navy text-paper sm:w-auto`}>
                  Go to your profile <ArrowRight aria-hidden className="size-4" />
                </Link>
              </Card>
            </HubItem>
          ) : (
            <div className={`grid gap-4 ${(announcements?.length ?? 0) > 0 ? "md:grid-cols-2" : ""}`}>
              <HubItem>
                <Card title="My agenda" icon={CalendarDays}>
                  <SavedAgenda sessions={sessions} workshops={workshops} />
                </Card>
              </HubItem>
              {(announcements?.length ?? 0) > 0 && (
                <HubItem>
                  <Card title="Announcements" icon={Megaphone}>
                    <ul className="space-y-2">
                      {announcements!.map((a) => (
                        <li key={a.id} className="rounded-md bg-paper p-3">
                          <p className="text-sm font-semibold text-ink">{a.title}</p>
                          {a.body && <p className="mt-0.5 text-sm text-slate-700">{a.body}</p>}
                        </li>
                      ))}
                    </ul>
                  </Card>
                </HubItem>
              )}
            </div>
          )}
        </div>
      </HubStagger>
    </div>
  );
}
