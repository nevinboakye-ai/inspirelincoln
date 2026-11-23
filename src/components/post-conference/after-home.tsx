import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  FlaskConical,
  Gauge,
  Images,
  LayoutDashboard,
  MessageCircle,
  MessageSquareQuote,
  MessagesSquare,
  NotebookPen,
  Presentation,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Profile, requireUser } from "@/lib/auth";
import { presenterKindOf, SUBMISSION_LABEL } from "@/lib/accounts";
import type { PostConference } from "@/lib/post-conference/server";
import { loadGallery } from "@/lib/post-conference/gallery";
import { getMyResearch } from "@/lib/research/server";
import { STAGE_LABEL } from "@/lib/research/instrument";
import { formatWhen, windowOf } from "@/lib/research/schedule";
import { getConferenceBundle } from "@/lib/data/content";
import { getSwitches } from "@/lib/switches";
import { signAvatars } from "@/lib/avatar";
import { formatEventDate, formatTime } from "@/lib/time";
import { HubAnnouncements } from "@/components/portal/hub-sections";
import { HubItem, HubStagger, ReadinessRing } from "@/components/portal/hub-motion";
import { MaskRise } from "@/components/motion/effects";
import { Notice } from "@/components/ui/notice";
import { cn } from "@/lib/cn";

type SupabaseClient = Awaited<ReturnType<typeof requireUser>>["db"];

const ok = <T,>(p: PromiseLike<{ data: T | null; error: unknown }>) =>
  Promise.resolve(p).then(
    (r) => (r.error ? null : r.data),
    () => null,
  );

/**
 * My Hub once the conference is over: a look back at the day (their photos,
 * their workshops, the people they met), what's still to do, the gallery,
 * what's coming (certificates, the booklet, judges' feedback), and a way to
 * start their own research with INSPIRE. Deliberately light and warm, unlike
 * the dark, countdown-led hub before the day.
 */
export async function AfterHome({ db, profile, after, thanks = false }: { db: SupabaseClient; profile: Profile; after: PostConference; thanks?: boolean }) {
  const kind = presenterKindOf(profile);
  const presenter = Boolean(kind);
  const firstName = profile.fullName?.split(" ")[0] ?? null;

  const [{ edition, workshops }, switches, photos, research] = await Promise.all([getConferenceBundle(), getSwitches(), loadGallery(db), getMyResearch(db, profile)]);
  const showPeople = profile.access.owner || switches.delegate_card;
  const ed = edition.id;

  const [reg, places, sub, contacts, interest, myPhotos, judged, waiting, announcements] = await Promise.all([
    ok(db.from("registrations").select("checked_in_at").eq("user_id", profile.id).eq("edition_id", ed).maybeSingle()),
    ok(db.from("workshop_allocations").select("slot, workshop_id").eq("user_id", profile.id).eq("edition_id", ed).order("slot")),
    kind
      ? ok(db.from("presentation_submissions").select("title, status").eq("user_id", profile.id).eq("kind", kind).order("version", { ascending: false }).limit(1).maybeSingle())
      : null,
    showPeople ? ok(db.rpc("my_contacts")) : null,
    ok(db.rpc("my_research_interest")),
    ok(db.from("gallery_photos").select("id").eq("uploaded_by", profile.id).limit(50)),
    presenter ? ok(db.rpc("my_judging_feedback")) : null,
    after.moderator ? db.from("gallery_photos").select("id", { count: "exact", head: true }).eq("status", "pending").then((r) => r.count ?? 0) : 0,
    ok(
      db
        .from("announcements")
        .select("id, title, body, level, pinned, published_at")
        .eq("published", true)
        .in("audience", kind ? ["public", "delegates", "presenters"] : ["public", "delegates"])
        // Only news from the day onwards: reminders from before it are done with.
        .gte("published_at", edition.date)
        .order("pinned", { ascending: false })
        .order("published_at", { ascending: false })
        .limit(2),
    ),
  ]);

  const checkedIn = (reg as { checked_in_at: string | null } | null)?.checked_in_at ?? null;
  const myWorkshops = ((places as { slot: number; workshop_id: string }[] | null) ?? []).flatMap((p) => {
    const w = workshops.find((x) => x.id === p.workshop_id);
    return w ? [w] : [];
  });
  const talk = sub as { title: string | null; status: string } | null;
  const people = (contacts as { contact_id: string; card: { full_name?: string | null; avatar_path?: string | null } | null }[] | null) ?? [];
  const faces = people.slice(0, 5);
  const faceUrls = faces.length ? await signAvatars(db, faces.map((p) => p.card?.avatar_path ?? null)) : new Map<string, string | null>();
  const keen = interest === true;
  const uploaded = ((myPhotos as unknown[] | null) ?? []).length;
  const released = Boolean((judged as { released?: boolean } | null)?.released);
  const postDue = research.due === "post";
  const postDone = research.done.includes("post");
  const studyOpen = research.eligible && research.settings.enabled && (research.decision !== "declined" || research.canJoin);
  const year = edition.year;

  // The to-do list after the day, in the order people tend to do them.
  const todo: { label: string; detail?: string; done: boolean; href: string | null; soon?: boolean; icon: LucideIcon; tone: string }[] = [
    { label: "Give your feedback", done: after.done, href: after.done ? null : "/portal/after?form=1", icon: MessageSquareQuote, tone: "tone-coral" },
    ...(research.eligible && (postDue || postDone)
      ? [
          {
            label: "Complete the post-conference study",
            detail: postDue ? `About ${STAGE_LABEL.post.minutes} minutes, open until ${formatWhen(windowOf(research.settings, "post").closes)}` : undefined,
            done: postDone,
            href: postDone ? null : "/portal/research/post",
            icon: FlaskConical,
            tone: "tone-teal",
          },
        ]
      : []),
    { label: "Add your photos to the gallery", detail: uploaded ? undefined : "Your best shots from the day", done: uploaded > 0, href: "/portal/gallery#add", icon: Images, tone: "tone-sky" },
    ...(presenter
      ? [{ label: "Read the judges' feedback", done: false, href: released ? "/portal/feedback" : null, soon: !released, icon: MessageSquareQuote, tone: "tone-gold" }]
      : []),
    { label: "Download your certificate", done: false, href: null, soon: true, icon: Award, tone: "tone-plum" },
  ];
  const doneCount = todo.filter((t) => t.done).length;

  // Photos for the hero's stacked prints: the newest three.
  const prints = photos.slice(-3).reverse();
  const recap = [
    checkedIn && { key: "in", icon: CheckCircle2, tone: "text-teal", big: formatTime(checkedIn), label: "Checked in", sub: formatEventDate(edition.date, { weekday: "long", month: "long" }) },
    myWorkshops.length > 0 && {
      key: "ws",
      icon: Sparkles,
      tone: "text-plum",
      big: String(myWorkshops.length),
      label: myWorkshops.length === 1 ? "Workshop" : "Workshops",
      sub: myWorkshops.map((w) => w.title).join(", "),
    },
    kind && talk?.title && { key: "talk", icon: Presentation, tone: "text-gold-700", big: kind === "slides" ? "Talk" : "Poster", label: "You presented", sub: talk.title },
    showPeople && { key: "people", icon: Users, tone: "text-sky", big: String(people.length), label: people.length === 1 ? "Person met" : "People met", sub: people.length ? "Saved from their Delegate Cards" : "Scan a card to save someone", href: "/portal/people" },
    { key: "photos", icon: Images, tone: "text-coral", big: String(photos.length), label: photos.length === 1 ? "Photo shared" : "Photos shared", sub: "In the gallery so far", href: "/portal/gallery" },
  ].filter(Boolean) as { key: string; icon: LucideIcon; tone: string; big: string; label: string; sub: string; href?: string }[];

  const can = profile.access.can;

  return (
    <div className="space-y-5">
      {thanks && (
        <p role="status" className="pop-in flex items-start gap-2 rounded-xl border border-success/25 bg-success/[0.06] p-4 text-sm font-medium text-success">
          <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0" /> Thank you. Your feedback is in and your post-conference hub is open.
        </p>
      )}
      {profile.access.owner && !after.open && (
        <Notice title="Only you can see this for now">
          This is My Hub once the conference is over. Turn on the Post-conference hub switch in the Platform dashboard to show it to everyone, and ask them for feedback.
        </Notice>
      )}

      {/* Light and warm, with prints of the day: a different feel from the dark countdown before it. */}
      <header className="relative isolate overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-[#fbf3df] via-paper to-[#f3e3d3] px-5 pb-6 pt-6 ring-1 ring-gold/25 sm:px-8 sm:pb-8 sm:pt-8">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_10%,rgba(212,175,90,0.28),transparent_45%),radial-gradient(circle_at_0%_100%,rgba(194,65,12,0.10),transparent_40%)]" />
        <img src="/brand/crest-navy.png" alt="" aria-hidden className="pointer-events-none absolute -bottom-8 -left-6 h-36 w-auto opacity-[0.05]" />
        <div className="relative grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 font-ui text-xs font-semibold text-gold-700 ring-1 ring-gold/30">
              <span className="size-1.5 rounded-full bg-gold-600" /> INSPIRE {year} · that&apos;s a wrap
            </p>
            <h1 className="mt-3 font-display text-[2.1rem] leading-[1.02] text-ink sm:text-5xl">
              <MaskRise onMount>{firstName ? `Thank you, ${firstName}.` : "Thank you."}</MaskRise>
            </h1>
            <p className="mt-3 max-w-lg text-[0.95rem] text-slate-700 sm:text-base">
              {formatEventDate(edition.date, { weekday: "long", month: "long" })} at {edition.venueName} is done. Here&apos;s your day to look back on, and everything that follows from it.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/portal/gallery" className="tap inline-flex min-h-12 items-center gap-2 rounded-full bg-ink px-5 font-ui text-sm font-semibold text-paper shadow-[0_10px_24px_-12px_rgba(12,24,44,0.8)]">
                <Images aria-hidden className="size-4" /> See the photos
              </Link>
              <Link href="/portal/gallery#add" className="tap inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-5 font-ui text-sm font-semibold text-ink ring-1 ring-navy/15">
                <Upload aria-hidden className="size-4" /> Add yours
              </Link>
            </div>
          </div>
          <Link href="/portal/gallery" aria-label="Open the gallery" className="group relative mx-auto hidden h-56 w-72 shrink-0 sm:block md:mx-0">
            {[0, 1, 2].map((i) => {
              const p = prints[i];
              return (
                <span
                  key={i}
                  className={cn(
                    "absolute block w-44 bg-white p-2 pb-7 shadow-[0_18px_36px_-18px_rgba(12,24,44,0.55)] ring-1 ring-navy/10 transition-transform duration-500",
                    i === 0 && "left-24 top-2 z-30 rotate-[5deg] group-hover:rotate-[8deg]",
                    i === 1 && "left-10 top-6 z-20 -rotate-[4deg] group-hover:-rotate-[8deg]",
                    i === 2 && "left-0 top-14 z-10 -rotate-[11deg] group-hover:-rotate-[15deg]",
                  )}
                >
                  {p ? (
                    <img src={p.url} alt="" className="aspect-[4/3] w-full object-cover" />
                  ) : (
                    <span className="grid aspect-[4/3] w-full place-items-center bg-gradient-to-br from-navy to-navy-600 text-cyan">
                      <Images aria-hidden className="size-7" />
                    </span>
                  )}
                  {i === 0 && <span className="absolute inset-x-0 bottom-1.5 text-center font-display text-sm text-slate-700">INSPIRE {year}</span>}
                </span>
              );
            })}
          </Link>
        </div>
      </header>

      {postDue && (
        <section aria-labelledby="study-h" className="relative overflow-hidden rounded-2xl border-2 border-cyan/50 bg-white p-4 shadow-[var(--shadow-soft)] sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <span className="icon-chip bg-cyan/15 text-[#28506E]">
              <FlaskConical aria-hidden className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="eyebrow text-[#28506E]">{thanks ? "One more thing" : "Your research study task"}</p>
              <h2 id="study-h" className="mt-0.5 font-display text-xl leading-tight text-ink">
                Please complete the post-conference study
              </h2>
              <p className="mt-1 text-sm text-slate-700">
                About {STAGE_LABEL.post.minutes} minutes, open until {formatWhen(windowOf(research.settings, "post").closes)}. It&apos;s separate from your feedback and shows whether conferences like INSPIRE make a difference.
              </p>
            </div>
            <Link href="/portal/research/post" className="tap inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-navy px-6 font-ui text-sm font-semibold text-paper">
              Start the study <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
        </section>
      )}

      <HubStagger className="space-y-5">
        {/* Your day, in numbers. */}
        <HubItem>
          <section aria-labelledby="recap-h">
            <h2 id="recap-h" className="mb-2 flex items-center gap-2 px-1 font-ui text-xs font-semibold uppercase tracking-[0.16em] text-slate">
              Your INSPIRE {year}
            </h2>
            <ul className="no-scrollbar -mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
              {recap.slice(0, 4).map((r) => {
                const body = (
                  <>
                    <r.icon aria-hidden className={cn("size-5", r.tone)} />
                    <p className="mt-3 font-display text-4xl leading-none text-ink">{r.big}</p>
                    <p className="mt-1 font-semibold text-ink">{r.label}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-700">{r.sub}</p>
                  </>
                );
                return (
                  <li key={r.key} className="w-[11.5rem] shrink-0 snap-start sm:w-auto">
                    {r.href ? (
                      <Link href={r.href} className="tap block h-full rounded-2xl border border-navy/10 bg-white p-4 transition-colors hover:border-navy/25">
                        {body}
                      </Link>
                    ) : (
                      <div className="h-full rounded-2xl border border-navy/10 bg-white p-4">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </HubItem>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_21rem] xl:items-start">
          <div className="min-w-0 space-y-5">
            {/* After the day: what's left, ticked off as it's done. */}
            <HubItem>
              <section aria-labelledby="after-todo-h" className="app-card overflow-hidden">
                <div className="flex items-center gap-3 p-4 pb-3">
                  <ReadinessRing small done={doneCount} total={todo.length} />
                  <div className="min-w-0">
                    <h2 id="after-todo-h" className="font-display text-lg leading-tight text-ink">
                      After the day
                    </h2>
                    <p className="text-sm text-slate-700">A few things to finish, and what&apos;s on its way.</p>
                  </div>
                </div>
                <ul className="divide-y divide-navy/[0.07] border-t border-navy/[0.07]">
                  {todo.map((t) => {
                    const inner = (
                      <>
                        <span className={cn("icon-chip-sm", t.done ? "bg-success/15 text-success" : t.soon ? "bg-paper-200 text-slate" : t.tone)}>
                          {t.done ? <Check aria-hidden className="size-4" /> : <t.icon aria-hidden className="size-4" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={cn("block text-sm font-semibold leading-snug", t.done ? "text-slate line-through decoration-slate/40" : "text-ink")}>{t.label}</span>
                          {t.detail && !t.done && <span className="block text-xs text-slate-700">{t.detail}</span>}
                        </span>
                        {t.soon ? (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-paper-200 px-2.5 py-0.5 font-ui text-[0.68rem] font-semibold uppercase tracking-wider text-slate-700">
                            <Clock aria-hidden className="size-3" /> Soon
                          </span>
                        ) : t.done ? (
                          <span className="shrink-0 text-xs font-semibold text-success">Done</span>
                        ) : (
                          <ArrowRight aria-hidden className="size-4 shrink-0 text-electric-600" />
                        )}
                      </>
                    );
                    return (
                      <li key={t.label}>
                        {t.href && !t.done ? (
                          <Link href={t.href} className="tap flex min-h-14 items-center gap-3 px-4 py-2.5 hover:bg-paper-200/60">
                            {inner}
                          </Link>
                        ) : (
                          <div className="flex min-h-14 items-center gap-3 px-4 py-2.5">{inner}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            </HubItem>

            {/* The gallery, as a mosaic of the latest photos. */}
            <HubItem>
              <section aria-labelledby="gallery-h" className="overflow-hidden rounded-2xl bg-midnight text-paper">
                <div className="flex items-end justify-between gap-3 p-4 pb-3 sm:p-5 sm:pb-4">
                  <div>
                    <h2 id="gallery-h" className="font-display text-2xl leading-tight">
                      Gallery
                    </h2>
                    <p className="text-sm text-paper/70">
                      {photos.length ? `${photos.length} photo${photos.length === 1 ? "" : "s"} from the day, checked by the committee.` : "Photos from the day will appear here. Add yours too."}
                    </p>
                  </div>
                  <Link href="/portal/gallery" className="tap hidden min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-4 font-ui text-sm font-semibold ring-1 ring-white/15 hover:bg-white/15 sm:inline-flex">
                    Open <ArrowUpRight aria-hidden className="size-4" />
                  </Link>
                </div>
                <Link href="/portal/gallery" aria-label="Open the gallery" className="grid grid-cols-3 grid-rows-2 gap-0.5 sm:grid-cols-4">
                  {/* One big photo and two (phones) or four (wider) small ones. */}
                  {Array.from({ length: 5 }, (_, i) => {
                    const p = photos[photos.length - 1 - i];
                    return (
                      <span
                        key={i}
                        className={cn("relative block aspect-square overflow-hidden bg-white/5", i === 0 && "col-span-2 row-span-2 aspect-auto", i > 2 && "hidden sm:block")}
                      >
                        {p ? <img src={p.url} alt="" className="size-full object-cover transition-transform duration-700 hover:scale-105" /> : <span className="lanyard-grid absolute inset-0 opacity-30" />}
                      </span>
                    );
                  })}
                </Link>
                <div className="flex flex-wrap items-center gap-2 p-4 sm:p-5">
                  <Link href="/portal/gallery" className="tap inline-flex min-h-12 items-center gap-2 rounded-full bg-gold px-5 font-ui text-sm font-semibold text-midnight">
                    Flick through <ArrowRight aria-hidden className="size-4" />
                  </Link>
                  <Link href="/portal/gallery#add" className="tap inline-flex min-h-12 items-center gap-2 rounded-full px-4 font-ui text-sm font-semibold text-paper ring-1 ring-white/20 hover:bg-white/10">
                    <Upload aria-hidden className="size-4" /> Add photos
                  </Link>
                  {after.moderator && (
                    <Link href="/admin/gallery" className="tap ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-cyan hover:bg-white/10">
                      <ShieldCheck aria-hidden className="size-4" />
                      {waiting ? `${waiting} waiting for review` : "Review photos"}
                    </Link>
                  )}
                </div>
              </section>
            </HubItem>

            {/* What's coming to the hub. */}
            <HubItem>
              <section aria-labelledby="coming-h">
                <h2 id="coming-h" className="mb-2 px-1 font-ui text-xs font-semibold uppercase tracking-[0.16em] text-slate">
                  Coming to your hub
                </h2>
                <div className={cn("grid gap-3 sm:grid-cols-2", presenter && "lg:grid-cols-3")}>
                  <Coming icon={Award} tone="tone-gold" title="Certificate" body={`Attendance${presenter ? " and presentation" : ""}, ready for your portfolio.`} />
                  <Coming icon={BookOpen} tone="tone-plum" title="Conference booklet" body="Abstracts, prize winners and highlights in one place." />
                  {presenter && (
                    <Coming
                      icon={MessageSquareQuote}
                      tone="tone-teal"
                      title="Judges' feedback"
                      body={released ? "What went well and what to work on next." : `On your ${SUBMISSION_LABEL[kind!].noun}, once prizes are announced.`}
                      href={released ? "/portal/feedback" : undefined}
                    />
                  )}
                </div>
              </section>
            </HubItem>
          </div>

          <div className="min-w-0 space-y-5">
            {/* Start your own research: the study first, then talk to us. */}
            <HubItem>
              <section aria-labelledby="own-research-h" className={cn("relative isolate overflow-hidden rounded-2xl p-5 text-paper", keen ? "bg-gradient-to-br from-plum to-navy" : "bg-gradient-to-br from-navy to-navy-600")}>
                <span aria-hidden className="hub-orb -right-12 -top-16 size-48 bg-gold/30" />
                <span className="icon-chip bg-white/10 text-gold-300 ring-1 ring-white/15">
                  <FlaskConical aria-hidden className="size-5" />
                </span>
                <p className="mt-3 font-ui text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-gold-300">{keen ? "You asked us to get in touch" : "What's next for you"}</p>
                <h2 id="own-research-h" className="mt-1 font-display text-2xl leading-tight">
                  Start your own research with INSPIRE
                </h2>
                <p className="mt-2 text-sm text-paper/80">
                  {keen
                    ? "Thank you. The committee will be in touch. Meanwhile, take part in the INSPIRE study to see how a real project runs, and send us your idea."
                    : "Got an idea? Take part in the INSPIRE study to see how a real project runs, then get in touch and we'll help you get started."}
                </p>
                <div className="mt-4 grid gap-2">
                  {studyOpen && (
                    <Link
                      href={postDue ? "/portal/research/post" : "/portal/research"}
                      className="tap inline-flex min-h-12 items-center justify-between gap-2 rounded-xl bg-white px-4 font-ui text-sm font-semibold text-ink"
                    >
                      {postDue ? "Do the post-conference study" : "The INSPIRE research study"} <ArrowRight aria-hidden className="size-4" />
                    </Link>
                  )}
                  <Link href="/portal/enquiries?topic=research" className="tap inline-flex min-h-12 items-center justify-between gap-2 rounded-xl bg-white/10 px-4 font-ui text-sm font-semibold ring-1 ring-white/20 hover:bg-white/15">
                    Get in touch about your research <MessagesSquare aria-hidden className="size-4" />
                  </Link>
                </div>
              </section>
            </HubItem>

            {/* Stay in touch. */}
            <HubItem>
              <section aria-labelledby="touch-h" className="app-card p-4 sm:p-5">
                <h2 id="touch-h" className="font-display text-lg text-ink">
                  Stay in touch
                </h2>
                <p className="text-sm text-slate-700">The people you met are saved here, and messages stay open.</p>
                <div className="mt-3 grid gap-2">
                  {showPeople && (
                    <Link href="/portal/people" className="tap flex min-h-14 items-center gap-3 rounded-xl border border-navy/10 px-3 py-2 hover:border-navy/25">
                      {faces.length ? (
                        <span className="flex -space-x-2">
                          {faces.map((f) => {
                            const url = f.card?.avatar_path ? faceUrls.get(f.card.avatar_path) : null;
                            return url ? (
                              <img key={f.contact_id} src={url} alt="" className="size-8 rounded-full object-cover ring-2 ring-white" />
                            ) : (
                              <span key={f.contact_id} className="grid size-8 place-items-center rounded-full bg-sky-100 font-ui text-[0.65rem] font-bold text-sky ring-2 ring-white">
                                {initials(f.card?.full_name ?? "")}
                              </span>
                            );
                          })}
                        </span>
                      ) : (
                        <span className="icon-chip-sm tone-sky">
                          <NotebookPen aria-hidden className="size-4" />
                        </span>
                      )}
                      <span className="min-w-0 flex-1 text-sm font-semibold text-ink">
                        People I&apos;ve met
                        <span className="block text-xs font-normal text-slate-700">{people.length ? `${people.length} saved` : "Nobody saved yet"}</span>
                      </span>
                      <ArrowRight aria-hidden className="size-4 shrink-0 text-electric-600" />
                    </Link>
                  )}
                  <Link href="/portal/messages" className="tap flex min-h-14 items-center gap-3 rounded-xl border border-navy/10 px-3 py-2 hover:border-navy/25">
                    <span className="icon-chip-sm tone-teal">
                      <MessageCircle aria-hidden className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1 text-sm font-semibold text-ink">Messages</span>
                    <ArrowRight aria-hidden className="size-4 shrink-0 text-electric-600" />
                  </Link>
                </div>
              </section>
            </HubItem>

            {(announcements as unknown[] | null)?.length ? (
              <HubItem>
                <HubAnnouncements items={announcements as Parameters<typeof HubAnnouncements>[0]["items"]} />
              </HubItem>
            ) : null}

            {(can.manage_platform || profile.access.committee) && (
              <HubItem>
                <div className="grid gap-2">
                  {profile.access.committee && (
                    <Link href="/admin" className="group flex items-center gap-3 tap rounded-2xl bg-gradient-to-br from-navy to-navy-600 px-4 py-3.5 text-paper">
                      <LayoutDashboard aria-hidden className="size-5 shrink-0 text-cyan" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold leading-snug">Committee dashboard</span>
                        <span className="block truncate text-xs text-paper/70">Feedback, photos, accounts and the website</span>
                      </span>
                      <ArrowRight aria-hidden className="size-4 shrink-0 transition-transform group-hover:translate-x-1" />
                    </Link>
                  )}
                  {can.manage_platform && (
                    <Link href="/admin/platform" className="group flex items-center gap-3 tap rounded-2xl border border-cyan/40 bg-midnight px-4 py-3.5 text-paper">
                      <Gauge aria-hidden className="size-5 shrink-0 text-cyan" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold leading-snug">Platform dashboard</span>
                        <span className="block truncate text-xs text-paper/70">Switches, access, accounts</span>
                      </span>
                      <ArrowRight aria-hidden className="size-4 shrink-0 transition-transform group-hover:translate-x-1" />
                    </Link>
                  )}
                </div>
              </HubItem>
            )}
          </div>
        </div>

        <HubItem>
          <p className="flex items-center justify-center gap-2 py-2 text-center font-display text-lg text-slate-700">
            <Sparkles aria-hidden className="size-4 text-gold-600" /> Thank you for being part of INSPIRE {year}.
          </p>
        </HubItem>
      </HubStagger>
    </div>
  );
}

function Coming({ icon: Icon, tone, title, body, href }: { icon: LucideIcon; tone: string; title: string; body: string; href?: string }) {
  const inner = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className={`icon-chip-sm ${tone}`}>
          <Icon aria-hidden className="size-4" />
        </span>
        {href ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-0.5 font-ui text-[0.68rem] font-semibold uppercase tracking-wider text-success">Ready</span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-paper-200 px-2.5 py-0.5 font-ui text-[0.68rem] font-semibold uppercase tracking-wider text-slate-700">
            <Clock aria-hidden className="size-3" /> Coming soon
          </span>
        )}
      </div>
      <h3 className="mt-3 font-display text-lg leading-tight text-ink">{title}</h3>
      <p className="mt-1 text-sm text-slate-700">{body}</p>
    </>
  );
  return href ? (
    <Link href={href} className="tap block rounded-2xl border border-navy/10 bg-white p-4 hover:border-navy/25">
      {inner}
    </Link>
  ) : (
    <div className="rounded-2xl border border-dashed border-navy/15 bg-white/60 p-4">{inner}</div>
  );
}

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}
