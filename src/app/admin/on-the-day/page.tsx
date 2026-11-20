import type { Metadata } from "next";
import Link from "next/link";
import { BellRing, CalendarClock, DoorOpen, Users } from "lucide-react";
import { requireAccess } from "@/lib/auth";
import { AdminHeader, Panel } from "@/components/admin/ui";
import { Notice } from "@/components/ui/notice";
import { AddAssignmentForm, AlertSettingsForm, PreviewAlertButton, RemoveAssignmentButton, SendAlertForm, StopAlertButton, type SessionChoice } from "@/components/admin/on-the-day-forms";
import { dayContext } from "@/lib/day/server";
import { ASSIGNMENT_LABEL_THEM, buildDay, workshopSlots, type AssignmentRole } from "@/lib/day/plan";
import { formatTime } from "@/lib/time";
import { workshopColour } from "@/lib/workshops/colours";

export const metadata: Metadata = { title: "On the day" };
export const dynamic = "force-dynamic";

const when = (d: string) => new Date(d).toLocaleString("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * Everything for running the day: the "where to go next" alerts, alerts
 * sent to every screen, who goes to which room when two things run at once,
 * and how many people have been marked in at each workshop.
 */
export default async function OnTheDayPage() {
  const { db, profile } = await requireAccess(["live_alerts", "day_scanner", "allocate_workshops", "check_in"], "/admin/on-the-day");
  const a = profile.access;
  const canAlerts = a.owner || a.can.live_alerts;
  const canPlace = canAlerts || a.can.allocate_workshops;
  const ctx = await dayContext();
  const ed = ctx.edition.id;

  const [settings, alerts, assignments, summary] = await Promise.all([
    db.from("live_alert_settings").select("auto_enabled, lead_minutes").eq("edition_id", ed).maybeSingle(),
    canAlerts ? db.from("live_alerts").select("id, title, body, place, audience, starts_at, ends_at, profiles(full_name)").order("created_at", { ascending: false }).limit(8) : Promise.resolve({ data: [], error: null }),
    canPlace
      ? db.from("programme_assignments").select("id, session_id, role, note, user_id, profiles!programme_assignments_user_id_fkey(full_name, institution)").eq("edition_id", ed)
      : Promise.resolve({ data: [], error: null }),
    db.rpc("workshop_attendance_summary"),
  ]);
  const notSetUp = Boolean(settings.error);

  const sessions = [...ctx.sessions].sort((x, y) => (x.startsAt ?? "").localeCompare(y.startsAt ?? ""));
  const parallel = new Set(sessions.filter((s) => s.startsAt && s.category !== "workshop" && sessions.some((o) => o.id !== s.id && o.startsAt === s.startsAt && o.category !== "workshop")).map((s) => s.id));
  const roomName = (id: string | null) => ctx.rooms.find((r) => r.id === id)?.name ?? null;
  const choices: SessionChoice[] = sessions
    .filter((s) => s.category !== "workshop")
    .map((s) => ({
      id: s.id,
      parallel: parallel.has(s.id),
      label: `${s.startsAt ? `${formatTime(s.startsAt)} · ` : ""}${s.title}${roomName(s.roomId) ? ` (${roomName(s.roomId)})` : ""}`,
    }));

  type Row = { id: string; session_id: string; role: AssignmentRole; note: string | null; user_id: string; profiles: { full_name: string | null; institution: string | null } | null };
  const rows = ((assignments.data ?? []) as unknown as Row[]).sort((x, y) => (x.profiles?.full_name ?? "").localeCompare(y.profiles?.full_name ?? ""));
  const bySession = new Map<string, Row[]>();
  for (const r of rows) bySession.set(r.session_id, [...(bySession.get(r.session_id) ?? []), r]);

  // A sample for the preview: the next part with a room, or the first.
  const publicDay = buildDay({ ...ctx, places: [], placesPublished: true, assignments: [] }).filter((i) => i.room || i.options.length);
  const sample = publicDay.find((i) => i.startsAt && new Date(i.startsAt).getTime() > Date.now()) ?? publicDay[0] ?? null;

  const slotOf = workshopSlots(ctx.sessions);
  const slotTimes = [...slotOf.entries()].map(([id, slot]) => ({ slot, s: ctx.sessions.find((x) => x.id === id)! })).sort((x, y) => x.slot - y.slot);
  const counts = (summary.data ?? []) as { slot: number; workshop_id: string; placed: number; marked: number }[];

  return (
    <div className="space-y-6">
      <AdminHeader
        title="On the day"
        description={
          <>
            The &quot;where to go next&quot; alerts, alerts to every screen, who goes to which room, and workshop attendance. Committee members scan Delegate Cards from the scanner at the top of{" "}
            <Link href="/portal" className="font-semibold text-electric-600 underline underline-offset-4">My Hub</Link>.
          </>
        }
      />
      {notSetUp && <Notice tone="warning">This page needs setup SQL 42 (personal programme and live alerts). Run it in Supabase, then refresh.</Notice>}

      {canAlerts && (
        <div className="grid gap-6 xl:grid-cols-2">
          <Panel title="Where to go next" actions={<PreviewAlertButton item={sample} />}>
            <div className="mb-4 flex items-start gap-3 rounded-lg bg-paper p-3 text-sm text-slate-700">
              <CalendarClock aria-hidden className="mt-0.5 size-4 shrink-0 text-electric-600" />
              <p>Shows once to each person, on whatever page they&apos;re on. Workshops use each person&apos;s own room from Workshop places once places are published. Sessions without a room are skipped.</p>
            </div>
            <AlertSettingsForm auto={settings.data ? Boolean(settings.data.auto_enabled) : true} lead={Number(settings.data?.lead_minutes ?? 10)} />
          </Panel>
          <Panel title="Send an alert to every screen">
            <SendAlertForm places={ctx.mapPlaces.filter((p) => p.lat != null || p.roomId).map((p) => ({ slug: p.slug, name: p.name }))} />
            {(alerts.data?.length ?? 0) > 0 && (
              <div className="mt-6 border-t border-navy/10 pt-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <BellRing aria-hidden className="size-4 text-electric-600" /> Recent alerts
                </h3>
                <ul className="mt-2 divide-y divide-navy/10">
                  {(alerts.data as unknown as { id: string; title: string; audience: string; starts_at: string; ends_at: string; profiles: { full_name: string | null } | null }[]).map((x) => {
                    const live = new Date(x.ends_at).getTime() > Date.now();
                    return (
                      <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                        <span className="min-w-0">
                          <span className="block font-semibold text-ink">{x.title}</span>
                          <span className="block text-xs text-slate-700">
                            {when(x.starts_at)} · {x.audience === "everyone" ? "Everyone" : x.audience === "signed_in" ? "Signed in" : "Committee"}
                            {x.profiles?.full_name ? ` · ${x.profiles.full_name}` : ""} · {live ? `live until ${formatTime(x.ends_at)}` : "ended"}
                          </span>
                        </span>
                        {live && <StopAlertButton id={x.id} />}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </Panel>
        </div>
      )}

      {canPlace && (
        <Panel title="Who goes where">
          <p className="mb-4 max-w-3xl text-sm text-slate-700">
            When two things run at once (like the oral presentations in two rooms), delegates see both and can pick. Put presenters, judges, chairs and helpers in the one they&apos;re needed in, and it shows in their day and their alerts. Workshops come from{" "}
            <Link href="/admin/workshops" className="font-semibold text-electric-600 underline underline-offset-4">Workshop places</Link>, and oral presenters&apos; rooms from{" "}
            <Link href="/admin/orals" className="font-semibold text-electric-600 underline underline-offset-4">Oral presentation rooms</Link> once they&apos;re shown to presenters.
          </p>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
            <div className="rounded-lg border border-navy/10 p-4">
              <h3 className="mb-3 flex items-center gap-2 font-semibold text-ink">
                <Users aria-hidden className="size-4 text-electric-600" /> Add someone
              </h3>
              <AddAssignmentForm sessions={choices} />
            </div>
            <div className="min-w-0 space-y-3">
              {sessions
                .filter((s) => s.category !== "workshop" && (parallel.has(s.id) || bySession.has(s.id)))
                .map((s) => {
                  const people = bySession.get(s.id) ?? [];
                  return (
                    <section key={s.id} className="rounded-lg border border-navy/10">
                      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-navy/10 bg-paper px-3 py-2">
                        <h3 className="font-semibold text-ink">
                          {s.title}
                          {roomName(s.roomId) && <span className="font-normal text-slate-700"> · {roomName(s.roomId)}</span>}
                        </h3>
                        <span className="text-xs text-slate-700">
                          {s.startsAt ? formatTime(s.startsAt) : "Time to be confirmed"} · {people.length} placed
                        </span>
                      </header>
                      {people.length ? (
                        <ul className="divide-y divide-navy/10">
                          {people.map((p) => (
                            <li key={p.id} className="flex items-center gap-2 px-3 py-1.5">
                              <span className="min-w-0 flex-1">
                                <span className="block text-sm font-semibold text-ink">{p.profiles?.full_name ?? "No name"}</span>
                                <span className="block truncate text-xs text-slate-700">
                                  {ASSIGNMENT_LABEL_THEM[p.role]}
                                  {p.profiles?.institution ? ` · ${p.profiles.institution}` : ""}
                                  {p.note ? ` · “${p.note}”` : ""}
                                </span>
                              </span>
                              <RemoveAssignmentButton id={p.id} label={p.profiles?.full_name ?? "this person"} />
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="px-3 py-2.5 text-sm text-slate-700">No one placed here yet.</p>
                      )}
                    </section>
                  );
                })}
              {!parallel.size && !rows.length && <p className="text-sm text-slate-700">Nothing in the programme runs at the same time, and no one has been placed yet.</p>}
            </div>
          </div>
        </Panel>
      )}

      <Panel title="Workshop attendance">
        {summary.error ? (
          <p className="text-sm text-slate-700">Attendance shows here once setup SQL 42 has been run.</p>
        ) : (
          <>
            <p className="mb-4 flex items-start gap-2 text-sm text-slate-700">
              <DoorOpen aria-hidden className="mt-0.5 size-4 shrink-0 text-electric-600" />
              Marked in with the scanner in My Hub (choose &quot;Workshop door&quot;). Updates when you refresh.
            </p>
            <div className="grid gap-4 lg:grid-cols-3">
              {slotTimes.map(({ slot, s }) => {
                const inSlot = counts.filter((c) => c.slot === slot);
                const placed = inSlot.reduce((n, c) => n + Number(c.placed), 0);
                const marked = inSlot.reduce((n, c) => n + Number(c.marked), 0);
                return (
                  <section key={slot} className="rounded-lg border border-navy/10 p-3">
                    <h3 className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold text-ink">Session {slot}</span>
                      <span className="text-xs text-slate-700">{s.startsAt ? formatTime(s.startsAt) : ""}</span>
                    </h3>
                    <p className="mt-0.5 text-sm text-slate-700">
                      {marked} of {placed} marked in
                    </p>
                    <ul className="mt-2 space-y-2">
                      {ctx.workshops.map((w) => {
                        const c = inSlot.find((x) => x.workshop_id === w.id);
                        const pl = Number(c?.placed ?? 0);
                        const mk = Number(c?.marked ?? 0);
                        const col = workshopColour(w.number);
                        return (
                          <li key={w.id}>
                            <div className="flex items-center justify-between gap-2 text-sm">
                              <span className="flex min-w-0 items-center gap-1.5">
                                <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: col.solid }} />
                                <span className="truncate text-ink">{w.title}</span>
                              </span>
                              <span className="shrink-0 tabular-nums text-slate-700">
                                {mk}/{pl}
                              </span>
                            </div>
                            <div aria-hidden className="mt-1 h-1.5 overflow-hidden rounded-full bg-paper-200">
                              <div className="h-full rounded-full" style={{ width: `${pl ? Math.min(100, (mk / pl) * 100) : 0}%`, background: col.solid }} />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}
