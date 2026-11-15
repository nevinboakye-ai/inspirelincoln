import Link from "next/link";
import { ArrowRight, Clock, ClipboardCheck, MapPin, MessageSquareHeart, Mic, PencilLine, ScanLine } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasRole } from "@/lib/accounts";
import { formatTime } from "@/lib/time";
import type { Profile } from "@/lib/auth";

type Session = { id: string; title: string; starts_at: string | null; ends_at: string | null; rooms: { id: string; name: string; building: string | null } | null };

/** The speaker profile linked to this account, with their sessions. */
export async function loadMySpeaker(db: SupabaseClient, me: string) {
  const { data, error } = await db
    .from("speakers")
    .select("id, slug, full_name, position, institution, credentials, bio, published, session_speakers(sessions(id, title, starts_at, ends_at, published, rooms(id, name, building)))")
    .eq("profile_id", me)
    .maybeSingle();
  if (error || !data) return null;
  const sessions = ((data.session_speakers ?? []) as unknown as { sessions: (Session & { published: boolean }) | null }[])
    .map((s) => s.sessions)
    .filter((s): s is Session & { published: boolean } => Boolean(s))
    .sort((a, b) => (a.starts_at ?? "9").localeCompare(b.starts_at ?? "9"));
  return { ...data, sessions };
}

/**
 * My Hub for the people who come on the day in a professional role, and
 * presenters once their feedback is released: the judging portal for
 * judges, sessions for speakers, and judges' feedback for presenters.
 */
export async function GuestHub({ db, profile }: { db: SupabaseClient; profile: Profile }) {
  const judge = profile.access.can.judge_presentations && !profile.access.owner;
  const speaker = hasRole(profile, "speaker") && profile.accountStatus === "approved";
  const presenter = hasRole(profile, "oral_presenter", "poster_presenter", "oral_waitlist") && profile.accountStatus === "approved";
  const [mine, feedback] = await Promise.all([
    speaker ? loadMySpeaker(db, profile.id) : Promise.resolve(null),
    presenter ? db.rpc("my_judging_feedback").then((r) => (r.error ? null : (r.data as { released: boolean; items?: unknown[] }))) : Promise.resolve(null),
  ]);
  const feedbackCount = feedback?.released ? (feedback.items?.length ?? 0) : 0;
  if (!judge && !speaker && !feedbackCount) return null;

  return (
    <div className="space-y-4">
      {judge && (
        <section aria-labelledby="judge-h" className="relative overflow-hidden rounded-xl bg-midnight p-4 text-paper sm:p-5">
          <div aria-hidden className="lanyard-grid pointer-events-none absolute inset-0 opacity-15" />
          <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-gold/25 blur-3xl" />
          <div className="relative flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-gold text-midnight">
              <ClipboardCheck aria-hidden className="size-5" />
            </span>
            <div className="min-w-0">
              <h2 id="judge-h" className="font-display text-xl">You&apos;re judging at INSPIRE</h2>
              <p className="mt-1 text-sm text-paper/75">Open the judging portal on your phone on the day. Scan a presenter&apos;s Delegate Card to go straight to their marking page.</p>
            </div>
          </div>
          <div className="relative mt-4 grid grid-cols-2 gap-2">
            <Link href="/judge" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gold px-3 text-sm font-semibold text-midnight">
              Judging portal <ArrowRight aria-hidden className="size-4" />
            </Link>
            <Link href="/judge/scan" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/25 px-3 text-sm font-semibold">
              <ScanLine aria-hidden className="size-4" /> Scan a card
            </Link>
          </div>
        </section>
      )}

      {speaker && (
        <section aria-labelledby="speaker-h" className="rounded-xl border border-navy/10 bg-white p-4 sm:p-5">
          <h2 id="speaker-h" className="flex items-center gap-2 font-display text-lg text-ink">
            <Mic aria-hidden className="size-4 text-electric-600" /> {mine?.sessions.length === 1 ? "Your session" : "Your sessions"}
          </h2>
          {!mine ? (
            <p className="mt-2 text-sm text-slate-700">The committee will link your account to your speaker profile shortly. Your sessions, rooms and times will then appear here.</p>
          ) : mine.sessions.length === 0 ? (
            <p className="mt-2 text-sm text-slate-700">Your session times and room will appear here once the programme is confirmed.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {mine.sessions.map((s) => (
                <li key={s.id} className="rounded-lg border border-navy/10 bg-paper/60 p-3">
                  <p className="font-semibold leading-snug text-ink">{s.title}</p>
                  <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-700">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock aria-hidden className="size-3.5 text-electric-600" />
                      {s.starts_at ? `${formatTime(s.starts_at)}${s.ends_at ? ` to ${formatTime(s.ends_at)}` : ""}` : "Time to be confirmed"}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin aria-hidden className="size-3.5 text-electric-600" />
                      {s.rooms ? (
                        <Link href={`/map?room=${encodeURIComponent(s.rooms.id)}`} className="underline underline-offset-4">
                          {s.rooms.name}
                        </Link>
                      ) : (
                        "Room to be confirmed"
                      )}
                    </span>
                  </p>
                </li>
              ))}
            </ul>
          )}
          {mine && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/portal/speaker" className="inline-flex min-h-11 items-center gap-2 rounded-[3px] bg-navy px-4 text-sm font-semibold text-paper">
                <PencilLine aria-hidden className="size-4" /> {mine.bio ? "Update your biography" : "Add your biography"}
              </Link>
              {mine.published && (
                <Link href={`/speakers/${mine.slug}`} className="inline-flex min-h-11 items-center gap-2 rounded-[3px] border border-navy/15 px-4 text-sm font-semibold text-ink">
                  Your public profile <ArrowRight aria-hidden className="size-4" />
                </Link>
              )}
            </div>
          )}
        </section>
      )}

      {feedbackCount > 0 && (
        <Link href="/portal/feedback" className="group flex items-center gap-3 rounded-xl border border-gold/50 bg-gold/10 p-4 transition-colors hover:bg-gold/15">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-gold text-midnight">
            <MessageSquareHeart aria-hidden className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-lg leading-tight text-ink">Your judges&apos; feedback is ready</span>
            <span className="block text-sm text-slate-700">
              {feedbackCount} {feedbackCount === 1 ? "judge" : "judges"} reviewed your presentation. Read what went well and what to work on.
            </span>
          </span>
          <ArrowRight aria-hidden className="size-5 shrink-0 text-ink transition-transform group-hover:translate-x-1" />
        </Link>
      )}
    </div>
  );
}
