import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Award, BookOpen, CheckCircle2, Clock, FlaskConical, Images, MessageSquareQuote, PartyPopper, ShieldCheck, Upload } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { presenterKindOf } from "@/lib/accounts";
import { getPostConference } from "@/lib/post-conference/server";
import { loadGallery } from "@/lib/post-conference/gallery";
import { getMyResearch } from "@/lib/research/server";
import { STAGE_LABEL } from "@/lib/research/instrument";
import { formatWhen, windowOf } from "@/lib/research/schedule";
import { getEdition } from "@/lib/data/content";
import { FeedbackUnlock } from "@/components/post-conference/feedback-gate";
import { Notice } from "@/components/ui/notice";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Post-conference hub" };
export const dynamic = "force-dynamic";

/**
 * The post-conference hub: photos, certificates, the booklet and presenter
 * feedback, opened by giving quick feedback. Parts that aren't ready yet
 * show as coming soon.
 */
export default async function AfterHub({ searchParams }: { searchParams: Promise<{ thanks?: string; form?: string }> }) {
  const sp = await searchParams;
  const { db, profile } = await requireUser("/portal/after");
  const after = await getPostConference(db, profile);
  if (!after.member) redirect("/portal");
  const presenter = Boolean(presenterKindOf(profile));
  const firstName = profile.fullName?.split(" ")[0] ?? null;

  if (!after.ready) {
    return (
      <Notice tone="warning" title="One database step left">
        Run <code>20261223000000_post_conference_feedback_and_gallery.sql</code> in the Supabase SQL editor to add feedback, the post-conference hub and the gallery.
      </Notice>
    );
  }
  // The committee can look at the form without sending anything.
  if (sp.form === "preview") return <FeedbackUnlock presenter={presenter} firstName={firstName} preview />;
  // Everyone else meets the form in front of My Hub (see the portal layout). The site owner is never held up, but can open it here.
  if (!after.done && (!profile.access.owner || sp.form)) return <FeedbackUnlock presenter={presenter} firstName={firstName} />;

  const [research, photos, edition, judged, waiting] = await Promise.all([
    getMyResearch(db, profile),
    loadGallery(db),
    getEdition(),
    presenter ? Promise.resolve(db.rpc("my_judging_feedback")).then((r) => (r.error ? null : (r.data as { released?: boolean } | null)), () => null) : null,
    after.moderator ? db.from("gallery_photos").select("id", { count: "exact", head: true }).eq("status", "pending").then((r) => r.count ?? 0) : 0,
  ]);
  const released = Boolean(judged?.released);
  const postDue = research.due === "post";
  const postDone = research.done.includes("post");
  const preview = photos.slice(-4).reverse();

  return (
    <div className="space-y-4">
      {sp.thanks && (
        <p role="status" className="pop-in flex items-start gap-2 rounded-xl border border-success/25 bg-success/[0.06] p-4 text-sm font-medium text-success">
          <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0" /> Thank you. Your feedback is in and your post-conference hub is open.
        </p>
      )}
      {profile.access.owner && !after.done && (
        <Notice title="You're the site owner, so you're never asked for feedback">
          Everyone else with a confirmed place sees the feedback form first when they open My Hub.{" "}
          <Link href="/portal/after?form=1" className="font-semibold text-electric-600 underline">
            See the form
          </Link>
          {!after.open && " The Post-conference hub switch is off, so only you can see this for now."}
        </Notice>
      )}

      <header className="relative isolate overflow-hidden rounded-2xl bg-midnight px-5 py-6 text-paper sm:px-7 sm:py-7">
        <span aria-hidden className="hub-orb -left-16 -top-20 size-60 bg-navy-600/70" />
        <span aria-hidden className="hub-orb -bottom-24 right-[-4rem] size-64 bg-gold/25 [animation-delay:-6s]" />
        <div aria-hidden className="lanyard-grid pointer-events-none absolute inset-0 opacity-25" />
        <img src="/brand/crest-white.png" alt="" aria-hidden className="pointer-events-none absolute -bottom-10 -right-6 h-40 w-auto opacity-[0.06]" />
        <div className="relative">
          <p className="eyebrow flex items-center gap-1.5 text-gold">
            <PartyPopper aria-hidden className="size-3.5" /> INSPIRE {edition.year} · after the day
          </p>
          <h1 className="mt-1.5 font-display text-3xl leading-[1.05] sm:text-4xl">Post-conference hub</h1>
          <p className="mt-2 max-w-xl text-sm text-paper/75 sm:text-base">
            Photos from the day, your certificate, the booklet{presenter ? " and the judges' feedback" : ""}. Each part opens here as soon as it&apos;s ready.
          </p>
        </div>
      </header>

      {postDue && (
        <section aria-labelledby="study-h" className="relative overflow-hidden rounded-2xl border-2 border-cyan/40 bg-white p-4 shadow-[var(--shadow-soft)] sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <span className="icon-chip bg-cyan/15 text-[#28506E]">
              <FlaskConical aria-hidden className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="eyebrow text-[#28506E]">{sp.thanks ? "One more thing" : "Your research study task"}</p>
              <h2 id="study-h" className="mt-0.5 font-display text-xl leading-tight text-ink">Please complete the post-conference study</h2>
              <p className="mt-1 text-sm text-slate-700">
                About {STAGE_LABEL.post.minutes} minutes, open until {formatWhen(windowOf(research.settings, "post").closes)}. It&apos;s separate from your feedback and is what shows whether conferences like INSPIRE make a difference.
              </p>
            </div>
            <Link href="/portal/research/post" className="tap inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-navy px-6 font-ui text-sm font-semibold text-paper">
              Start the study <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* The gallery is live, so it leads, across the full width on big screens. */}
        <section aria-labelledby="gallery-h" className="app-card overflow-hidden lg:col-span-2">
          <div className="grid gap-0 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <Link href="/portal/gallery" className="group relative block aspect-[16/10] bg-midnight md:aspect-auto md:min-h-64" aria-label={photos.length ? "Open the gallery" : "Open the gallery and add photos"}>
              {preview.length ? (
                <div className={cn("grid size-full gap-0.5", preview.length > 1 && "grid-cols-2", preview.length > 2 && "grid-rows-2")}>
                  {preview.map((p, i) => (
                    <img
                      key={p.id}
                      src={p.url}
                      alt=""
                      className={cn("size-full object-cover transition-transform duration-700 group-hover:scale-[1.03]", preview.length === 3 && i === 0 && "row-span-2")}
                    />
                  ))}
                </div>
              ) : (
                <div className="grid size-full place-items-center p-6 text-center text-paper/70">
                  <div>
                    <Images aria-hidden className="mx-auto size-10 text-cyan" />
                    <p className="mt-2 text-sm">Photos from the day will appear here</p>
                  </div>
                </div>
              )}
            </Link>
            <div className="flex flex-col p-4 sm:p-6">
              <h2 id="gallery-h" className="flex items-center gap-2 font-display text-xl text-ink">
                <span className="icon-chip-sm tone-sky">
                  <Images aria-hidden className="size-4" />
                </span>
                Gallery
                <Badge tone="success">Open</Badge>
              </h2>
              <p className="mt-2 text-sm text-slate-700">
                {photos.length
                  ? `${photos.length} photo${photos.length === 1 ? "" : "s"} from INSPIRE ${edition.year}. Flick through them and add your own.`
                  : "No photos yet. The committee is adding the official photos, and you can add yours too."}{" "}
                The committee checks every photo before it&apos;s shown.
              </p>
              <div className="mt-auto flex flex-wrap gap-2 pt-4">
                <Link href="/portal/gallery" className="tap inline-flex min-h-12 items-center gap-2 rounded-full bg-navy px-5 font-ui text-sm font-semibold text-paper">
                  Open the gallery <ArrowRight aria-hidden className="size-4" />
                </Link>
                <Link href="/portal/gallery#add" className="tap inline-flex min-h-12 items-center gap-2 rounded-full border border-navy/15 bg-white px-5 font-ui text-sm font-semibold text-ink">
                  <Upload aria-hidden className="size-4" /> Add photos
                </Link>
              </div>
              {after.moderator && (
                <Link href="/admin/gallery" className="tap mt-3 inline-flex items-center gap-2 self-start rounded-full px-2 py-1.5 text-sm font-semibold text-electric-600 hover:bg-paper-200">
                  <ShieldCheck aria-hidden className="size-4" />
                  {waiting ? `${waiting} photo${waiting === 1 ? "" : "s"} waiting for review` : "Review photos"}
                </Link>
              )}
            </div>
          </div>
        </section>

        <Soon icon={Award} tone="tone-gold" title="Certificates" body={`Your certificate of attendance${presenter ? " and presentation" : ""}, ready to download for your portfolio.`} />
        <Soon icon={BookOpen} tone="tone-plum" title="Post-conference booklet" body="The abstracts, prize winners and highlights from the day, in one booklet." />

        {presenter &&
          (released ? (
            <section className="app-card flex items-center gap-3 p-4 sm:p-5">
              <span className="icon-chip tone-teal">
                <MessageSquareQuote aria-hidden className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-lg text-ink">Judges&apos; feedback</h2>
                <p className="text-sm text-slate-700">What went well and what to work on next.</p>
              </div>
              <Link href="/portal/feedback" className="tap inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-navy px-4 font-ui text-sm font-semibold text-paper">
                Read it <ArrowRight aria-hidden className="size-4" />
              </Link>
            </section>
          ) : (
            <Soon icon={MessageSquareQuote} tone="tone-teal" title="Judges' feedback" body="The judges' marks and comments on your presentation, once prizes have been announced." />
          ))}

        {postDone && (
          <section className="flex items-center gap-3 rounded-2xl border border-success/25 bg-success/[0.06] p-4 sm:p-5">
            <span className="icon-chip tone-success">
              <CheckCircle2 aria-hidden className="size-5" />
            </span>
            <div className="min-w-0">
              <h2 className="font-semibold text-ink">Post-conference study done</h2>
              <p className="text-sm text-slate-700">
                Thank you.{research.next ? ` The last questionnaire opens ${formatWhen(research.next.opens)}, and we'll remind you.` : ""}
              </p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function Soon({ icon: Icon, tone, title, body }: { icon: typeof Award; tone: string; title: string; body: string }) {
  return (
    <section className="app-card relative flex items-start gap-3 overflow-hidden p-4 sm:p-5">
      <span className={`icon-chip ${tone}`}>
        <Icon aria-hidden className="size-5" />
      </span>
      <div className="min-w-0">
        <h2 className="flex flex-wrap items-center gap-2 font-display text-lg text-ink">
          {title}
          <span className="inline-flex items-center gap-1 rounded-full bg-paper-200 px-2.5 py-0.5 font-ui text-[0.7rem] font-semibold uppercase tracking-wider text-slate-700">
            <Clock aria-hidden className="size-3" /> Coming soon
          </span>
        </h2>
        <p className="mt-1 text-sm text-slate-700">{body}</p>
      </div>
    </section>
  );
}
