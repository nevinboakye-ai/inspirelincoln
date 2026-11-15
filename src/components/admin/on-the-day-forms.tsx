"use client";
import { useActionState, useEffect, useId, useState, useTransition } from "react";
import { Eye, Loader2, Search, Send, Square, Trash2, UserPlus, X } from "lucide-react";
import { addAssignment, findPeople, removeAssignment, saveAlertSettings, sendAlert, stopAlert, type FormResult, type PersonHit } from "@/app/admin/on-the-day/actions";
import { PREVIEW_EVENT } from "@/components/day/live-alerts";
import { inputClass } from "@/components/forms/field";
import { cn } from "@/lib/cn";
import { ASSIGNMENT_LABEL_THEM, ASSIGNMENT_ROLES, type DayItem } from "@/lib/day/plan";
import { btn } from "./ui";

function Result({ state }: { state: FormResult }) {
  if (!state) return null;
  return (
    <p role="status" className={cn("text-sm font-medium", state.ok ? "text-success" : "text-danger")}>
      {state.ok ? state.message : state.error}
    </p>
  );
}

export function AlertSettingsForm({ auto, lead }: { auto: boolean; lead: number }) {
  const [state, action, pending] = useActionState(saveAlertSettings, null);
  const id = useId();
  return (
    <form action={action} className="space-y-4">
      <label className="flex items-start gap-3">
        <input type="checkbox" name="auto" defaultChecked={auto} className="mt-1 size-5 accent-navy" />
        <span>
          <span className="block font-semibold text-ink">Show &quot;where to go next&quot; automatically</span>
          <span className="block text-sm text-slate-700">Before each part of the programme with a room, every open page shows where to go. Signed-in delegates see their own workshop room.</span>
        </span>
      </label>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor={`${id}-lead`} className="text-sm font-semibold text-ink">
            Minutes before it starts
          </label>
          <select id={`${id}-lead`} name="lead_minutes" defaultValue={String(lead)} className={cn(inputClass, "mt-1.5 w-40")}>
            {[3, 5, 8, 10, 12, 15, 20, 30].map((m) => (
              <option key={m} value={m}>
                {m} minutes
              </option>
            ))}
          </select>
        </div>
        <button disabled={pending} className={btn.primary}>
          {pending && <Loader2 aria-hidden className="size-4 animate-spin" />} Save
        </button>
      </div>
      <Result state={state} />
    </form>
  );
}

/** Shows the alert on this screen only, as delegates will see it. */
export function PreviewAlertButton({ item }: { item: DayItem | null }) {
  if (!item) return null;
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent(PREVIEW_EVENT, { detail: { kind: "item", key: `preview:${item.id}`, item, personal: true } }))}
      className={btn.secondary}
    >
      <Eye aria-hidden className="size-4" /> Preview on this screen
    </button>
  );
}

export function SendAlertForm({ places }: { places: { slug: string; name: string }[] }) {
  const [state, action, pending] = useActionState(sendAlert, null);
  const id = useId();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [place, setPlace] = useState("");
  const [slug, setSlug] = useState("");
  useEffect(() => {
    if (state?.ok) {
      setTitle("");
      setBody("");
      setPlace("");
      setSlug("");
    }
  }, [state]);
  return (
    <form action={action} className="space-y-3">
      <div>
        <label htmlFor={`${id}-t`} className="text-sm font-semibold text-ink">Headline</label>
        <input id={`${id}-t`} name="title" required maxLength={90} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Closing and prizes start in 5 minutes" className={cn(inputClass, "mt-1.5")} />
      </div>
      <div>
        <label htmlFor={`${id}-b`} className="text-sm font-semibold text-ink">Message <span className="font-normal text-slate">(optional)</span></label>
        <textarea id={`${id}-b`} name="body" maxLength={300} rows={2} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Please make your way to the lecture theatre now." className={cn(inputClass, "mt-1.5")} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-p`} className="text-sm font-semibold text-ink">Where <span className="font-normal text-slate">(optional)</span></label>
          <input id={`${id}-p`} name="place" maxLength={90} value={place} onChange={(e) => setPlace(e.target.value)} placeholder="INB0114 Lecture Theatre" className={cn(inputClass, "mt-1.5")} />
        </div>
        <div>
          <label htmlFor={`${id}-m`} className="text-sm font-semibold text-ink">Map button <span className="font-normal text-slate">(optional)</span></label>
          <select
            id={`${id}-m`}
            name="map_slug"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              const p = places.find((x) => x.slug === e.target.value);
              if (p && !place) setPlace(p.name);
            }}
            className={cn(inputClass, "mt-1.5")}
          >
            <option value="">No map button</option>
            {places.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-a`} className="text-sm font-semibold text-ink">Who sees it</label>
          <select id={`${id}-a`} name="audience" defaultValue="everyone" className={cn(inputClass, "mt-1.5")}>
            <option value="everyone">Everyone on the website</option>
            <option value="signed_in">Everyone signed in</option>
            <option value="committee">The committee only</option>
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-d`} className="text-sm font-semibold text-ink">Live for</label>
          <select id={`${id}-d`} name="minutes" defaultValue="15" className={cn(inputClass, "mt-1.5")}>
            {[5, 10, 15, 30, 60, 120].map((m) => (
              <option key={m} value={m}>
                {m < 60 ? `${m} minutes` : `${m / 60} hour${m > 60 ? "s" : ""}`}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending || title.trim().length < 2} className={btn.primary}>
          {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Send aria-hidden className="size-4" />} Send to every screen
        </button>
        <button
          type="button"
          disabled={title.trim().length < 2}
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent(PREVIEW_EVENT, {
                detail: { kind: "broadcast", key: "preview:broadcast", alert: { id: "preview", title, body: body || null, place: place || null, mapHref: slug ? `/map?place=${slug}` : null, startsAt: new Date().toISOString(), endsAt: new Date().toISOString() } },
              }),
            )
          }
          className={btn.secondary}
        >
          <Eye aria-hidden className="size-4" /> Preview
        </button>
      </div>
      <Result state={state} />
    </form>
  );
}

export function StopAlertButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <span className="flex items-center gap-2">
      {err && <span className="text-xs text-danger">{err}</span>}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await stopAlert(id);
            if (r && !r.ok) setErr(r.error ?? null);
          })
        }
        className={cn(btn.danger, "min-h-10 px-3")}
      >
        <Square aria-hidden className="size-3.5" /> Stop now
      </button>
    </span>
  );
}

export function RemoveAssignmentButton({ id, label }: { id: string; label: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => start(async () => void (await removeAssignment(id)))} className="grid size-10 shrink-0 place-items-center rounded-full text-slate hover:bg-danger/[0.07] hover:text-danger" aria-label={`Remove ${label}`}>
      {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Trash2 aria-hidden className="size-4" />}
    </button>
  );
}

export type SessionChoice = { id: string; label: string; parallel: boolean };

/** Place one person in one session: find them, pick the session and what they're doing. */
export function AddAssignmentForm({ sessions, preset }: { sessions: SessionChoice[]; preset?: { id: string; name: string } | null }) {
  const [state, action, pending] = useActionState(addAssignment, null);
  const id = useId();
  const [person, setPerson] = useState<{ id: string; name: string } | null>(preset ?? null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<PersonHit[]>([]);
  const [searching, start] = useTransition();
  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) return;
    const t = setTimeout(() => start(async () => setHits(await findPeople(query))), 250);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    if (state?.ok && !preset) {
      setPerson(null);
      setQ("");
      setHits([]);
    }
  }, [state, preset]);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="user_id" value={person?.id ?? ""} />
      {person ? (
        <p className="flex items-center gap-2 rounded-md bg-paper p-2.5 pl-3 text-sm">
          <span className="min-w-0 flex-1 font-semibold text-ink">{person.name}</span>
          {!preset && (
            <button type="button" onClick={() => setPerson(null)} className="grid size-9 place-items-center rounded-full hover:bg-paper-200" aria-label="Choose someone else">
              <X aria-hidden className="size-4" />
            </button>
          )}
        </p>
      ) : (
        <div className="relative">
          <label htmlFor={`${id}-q`} className="text-sm font-semibold text-ink">Person</label>
          <div className="relative mt-1.5">
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate" />
            <input id={`${id}-q`} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, medical school or full email" autoComplete="off" className={cn(inputClass, "pl-9")} />
            {searching && <Loader2 aria-hidden className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-slate" />}
          </div>
          {q.trim().length >= 2 && hits.length > 0 && (
            <ul className="mt-1 max-h-60 divide-y divide-navy/10 overflow-y-auto rounded-md border border-navy/10 bg-white shadow-sm">
              {hits.map((h) => (
                <li key={h.id}>
                  <button type="button" onClick={() => setPerson({ id: h.id, name: h.full_name ?? "No name" })} className="block min-h-12 w-full px-3 py-2 text-left hover:bg-paper">
                    <span className="block text-sm font-semibold text-ink">{h.full_name ?? "No name"}</span>
                    {h.institution && <span className="block text-xs text-slate-700">{h.institution}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem]">
        <div>
          <label htmlFor={`${id}-s`} className="text-sm font-semibold text-ink">Session</label>
          <select id={`${id}-s`} name="session_id" required className={cn(inputClass, "mt-1.5")} defaultValue={sessions.find((s) => s.parallel)?.id ?? ""}>
            <option value="" disabled>
              Choose a session
            </option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-r`} className="text-sm font-semibold text-ink">Doing</label>
          <select id={`${id}-r`} name="role" defaultValue="presenting" className={cn(inputClass, "mt-1.5")}>
            {ASSIGNMENT_ROLES.map((r) => (
              <option key={r} value={r}>
                {ASSIGNMENT_LABEL_THEM[r]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor={`${id}-n`} className="text-sm font-semibold text-ink">Note for them <span className="font-normal text-slate">(optional)</span></label>
        <input id={`${id}-n`} name="note" maxLength={200} placeholder="You're third. Please be there 10 minutes early." className={cn(inputClass, "mt-1.5")} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending || !person} className={btn.primary}>
          {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <UserPlus aria-hidden className="size-4" />} Add to their day
        </button>
        <Result state={state} />
      </div>
    </form>
  );
}
