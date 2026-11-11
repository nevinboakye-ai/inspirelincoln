"use client";
import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import { Camera, CameraOff, CheckCircle2, Keyboard, Loader2, RotateCcw, ScanLine, Search, TriangleAlert, UserCheck, XCircle } from "lucide-react";
import { checkInCode, checkInPerson, deskStatus, searchAttendees, undoCheckIn, type Recent, type SearchHit } from "@/app/admin/checkin/actions";
import { outcomeText } from "@/components/card/card-actions";
import { rolesLabel } from "@/lib/accounts";
import { sortedRoles, type CheckInOutcome } from "@/lib/card";
import { inputClass } from "@/components/forms/field";
import { cn } from "@/lib/cn";
import { btn } from "./ui";

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type Status = { expected: number; checkedIn: number; recent: Recent[] };
type Shown = { outcome: CheckInOutcome; at: number } | { error: string; at: number };

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" });

/** A short tone: higher for a good check-in, lower for anything that needs a look. */
function beep(good: boolean) {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = good ? 880 : 300;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (good ? 0.18 : 0.4));
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.45);
    o.onended = () => ctx.close();
  } catch {}
  navigator.vibrate?.(good ? 60 : [80, 60, 80]);
}

/**
 * The check-in desk. Scan the QR code on someone's Delegate Card with this
 * device's camera (any modern phone, including iPhone), type the code, or
 * find them by name. Every check-in can be undone.
 */
export function CheckInDesk({ initial }: { initial: Status }) {
  const [status, setStatus] = useState(initial);
  const [shown, setShown] = useState<Shown | null>(null);
  const [pending, start] = useTransition();
  const [scanning, setScanning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const last = useRef<{ v: string; t: number }>({ v: "", t: 0 });
  const pausedRef = useRef(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const ids = useId();

  const refresh = useCallback(async () => {
    try {
      const res = await deskStatus();
      if (res.ok) setStatus(res.data);
    } catch {}
  }, []);

  // Keep counts in step with the other desks.
  useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && refresh(), 20000);
    return () => clearInterval(t);
  }, [refresh]);

  const show = useCallback(
    (s: Shown) => {
      setShown(s);
      setPaused(true);
      const good = "outcome" in s && (s.outcome.result === "checked_in" || s.outcome.result === "undone");
      beep(good);
      refresh();
    },
    [refresh],
  );

  const submit = useCallback(
    (raw: string) =>
      start(async () => {
        try {
          const res = await checkInCode(raw);
          show(res.ok ? { outcome: res.data, at: Date.now() } : { error: res.error, at: Date.now() });
        } catch {
          show({ error: "Check-in didn't go through. Check your connection and try again.", at: Date.now() });
        }
      }),
    [show],
  );

  const runFor = (fn: () => ReturnType<typeof checkInPerson>) =>
    start(async () => {
      try {
        const res = await fn();
        show(res.ok ? { outcome: res.data, at: Date.now() } : { error: res.error, at: Date.now() });
      } catch {
        show({ error: "That didn't go through. Check your connection and try again.", at: Date.now() });
      }
    });

  // After a scan, hold the result on screen, then carry on scanning.
  useEffect(() => {
    if (!scanning || !shown) return;
    pausedRef.current = true;
    const t = setTimeout(() => {
      pausedRef.current = false;
      setPaused(false);
    }, 2600);
    return () => clearTimeout(t);
  }, [shown, scanning]);

  // The camera: the browser's own QR reader where there is one, otherwise jsQR.
  useEffect(() => {
    if (!scanning) return;
    let stream: MediaStream | null = null;
    let timer = 0;
    let stopped = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        if (stopped || !video.current) return stream?.getTracks().forEach((t) => t.stop());
        video.current.srcObject = stream;
        await video.current.play();
        const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
        let detector: Detector | null = null;
        if (BD) {
          try {
            detector = new BD({ formats: ["qr_code"] });
          } catch {}
        }
        const jsQR = detector ? null : (await import("jsqr")).default;

        const tick = async () => {
          if (stopped) return;
          const v = video.current;
          if (v && v.readyState >= 2 && !pausedRef.current) {
            let value: string | undefined;
            try {
              if (detector) {
                value = (await detector.detect(v))[0]?.rawValue;
              } else if (jsQR && ctx) {
                // Read the middle of the frame at a modest size: fast, and where people hold the code.
                const s = Math.min(v.videoWidth, v.videoHeight);
                const size = Math.min(s, 640);
                canvas.width = size;
                canvas.height = size;
                ctx.drawImage(v, (v.videoWidth - s) / 2, (v.videoHeight - s) / 2, s, s, 0, 0, size, size);
                value = jsQR(ctx.getImageData(0, 0, size, size).data, size, size, { inversionAttempts: "dontInvert" })?.data;
              }
            } catch {}
            const now = Date.now();
            if (value && (value !== last.current.v || now - last.current.t > 5000)) {
              last.current = { v: value, t: now };
              pausedRef.current = true;
              submit(value);
            }
          }
          timer = window.setTimeout(tick, detector ? 200 : 120);
        };
        tick();
      } catch (e) {
        const name = (e as { name?: string })?.name;
        setCamError(
          name === "NotAllowedError"
            ? "Camera access was blocked. Allow the camera for this site in your browser settings, or type the code below."
            : name === "NotFoundError"
              ? "No camera was found on this device. Type the code or search by name below."
              : "The camera couldn't start. Type the code or search by name below.",
        );
        setScanning(false);
      }
    })();

    // Let the camera go when the tab is hidden, so it doesn't drain the battery.
    const hide = () => document.visibilityState === "hidden" && setScanning(false);
    document.addEventListener("visibilitychange", hide);
    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
      document.removeEventListener("visibilitychange", hide);
    };
  }, [scanning, submit]);

  const pct = status.expected ? Math.min(100, Math.round((status.checkedIn / status.expected) * 100)) : 0;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-6">
      <div className="min-w-0 space-y-5">
        {/* Counts */}
        <section aria-label="Attendance so far" className="rounded-xl border border-navy/10 bg-white p-5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <p className="font-display text-3xl text-ink">
              {status.checkedIn} <span className="text-lg text-slate">of {status.expected} checked in</span>
            </p>
            <p className="text-sm font-semibold text-slate-700">{pct}%</p>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-paper-200" role="progressbar" aria-label="Checked in" aria-valuemin={0} aria-valuemax={status.expected} aria-valuenow={status.checkedIn}>
            <div className="h-full rounded-full bg-success transition-[width] duration-500" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-xs text-slate-700">Everyone with an approved account. Updates as you scan and every 20 seconds.</p>
        </section>

        {/* Scanner */}
        <section aria-labelledby={`${ids}-scan`} className="space-y-4 rounded-xl border border-navy/10 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id={`${ids}-scan`} className="flex items-center gap-2 font-display text-xl text-ink">
              <ScanLine aria-hidden className="size-5 text-electric-600" /> Scan Delegate Cards
            </h2>
            <button
              type="button"
              onClick={() => {
                setCamError(null);
                setScanning((s) => !s);
              }}
              className={cn(scanning ? btn.secondary : btn.primary, "min-h-12")}
            >
              {scanning ? <CameraOff aria-hidden className="size-4" /> : <Camera aria-hidden className="size-4" />}
              {scanning ? "Stop camera" : "Start camera"}
            </button>
          </div>
          {camError && (
            <p role="alert" className="flex items-start gap-2 rounded-md border border-danger/25 bg-danger/[0.06] p-3 text-sm text-danger">
              <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" /> {camError}
            </p>
          )}
          {scanning ? (
            <div className="relative overflow-hidden rounded-lg bg-midnight">
              <video ref={video} muted playsInline aria-label="Camera view for scanning QR codes" className="aspect-[4/3] w-full object-cover sm:aspect-video" />
              <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
                <div className={cn("aspect-square w-[58%] max-w-72 rounded-2xl border-4 transition-colors sm:w-[42%]", paused ? "border-gold" : "border-white/80")} />
              </div>
              <p aria-hidden className="absolute inset-x-0 bottom-0 bg-midnight/70 px-3 py-2 text-center text-sm font-medium text-paper">
                {pending ? "Checking…" : paused ? "Got it. Scanning again in a moment" : "Hold the QR code inside the square"}
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-700">
              Start the camera and hold each Delegate Card&apos;s QR code in the square. Works on iPhone and Android. You can also scan with any phone&apos;s own camera app: it opens their card with a <strong>Check in</strong> button.
            </p>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (code.trim()) submit(code);
            }}
            className="flex flex-wrap items-end gap-2 border-t border-navy/10 pt-4"
          >
            <div className="min-w-56 flex-1">
              <label htmlFor={`${ids}-code`} className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                <Keyboard aria-hidden className="size-4 text-slate" /> Type a code
              </label>
              <input
                id={`${ids}-code`}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder="ABCD EFGH JKMN PQRS"
                aria-describedby={`${ids}-code-hint`}
                className={cn(inputClass, "mt-1.5 font-mono tracking-[0.12em]")}
              />
              <p id={`${ids}-code-hint`} className="mt-1 text-xs text-slate-700">
                The 16 characters under the QR code on the back of their card.
              </p>
            </div>
            <button disabled={pending || !code.trim()} className={cn(btn.primary, "min-h-12")}>
              {pending && <Loader2 aria-hidden className="size-4 animate-spin" />} Check in
            </button>
          </form>
        </section>

        <FindByName onCheckIn={(id) => runFor(() => checkInPerson(id))} onUndo={(id) => runFor(() => undoCheckIn(id))} pending={pending} stamp={shown?.at ?? 0} />
      </div>

      <div className="min-w-0 space-y-5 lg:sticky lg:top-28 lg:self-start">
        <div ref={resultRef} aria-live="assertive" aria-atomic="true">
          {shown ? (
            <Result shown={shown} pending={pending} onUndo={(id) => runFor(() => undoCheckIn(id))} onDismiss={() => setShown(null)} />
          ) : (
            <div className="rounded-xl border border-dashed border-navy/20 bg-white p-6 text-center text-sm text-slate-700">
              <ScanLine aria-hidden className="mx-auto mb-2 size-7 text-slate" />
              Each result shows here, with a tone and a buzz on phones.
            </div>
          )}
        </div>
        <section aria-labelledby={`${ids}-recent`} className="rounded-xl border border-navy/10 bg-white p-5">
          <h2 id={`${ids}-recent`} className="font-display text-lg text-ink">
            Latest check-ins
          </h2>
          {status.recent.length ? (
            <ol className="mt-3 divide-y divide-navy/10">
              {status.recent.map((r) => (
                <li key={`${r.id}-${r.checked_in_at}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 truncate font-medium text-ink">{r.full_name ?? "No name"}</span>
                  <span className="shrink-0 tabular-nums text-slate-700">{time(r.checked_in_at)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 text-sm text-slate-700">No one checked in yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function Result({ shown, pending, onUndo, onDismiss }: { shown: Shown; pending: boolean; onUndo: (id: string) => void; onDismiss: () => void }) {
  if ("error" in shown) {
    return (
      <div className="rounded-xl border-2 border-danger/40 bg-danger/[0.06] p-6">
        <XCircle aria-hidden className="size-11 text-danger" />
        <p className="mt-3 font-display text-2xl text-ink">Not checked in</p>
        <p className="mt-1 text-slate-700">{shown.error}</p>
      </div>
    );
  }
  const o = shown.outcome;
  const p = o.person;
  const name = p?.full_name ?? (o.result === "unknown" ? "Code not recognised" : "Unnamed account");
  const first = p?.full_name?.split(" ")[0] ?? "They";
  const good = o.result === "checked_in";
  const neutral = o.result === "undone";
  const warn = o.result === "already";
  return (
    <div className={cn("rounded-xl border-2 p-6", good ? "border-success/50 bg-success/[0.07]" : neutral ? "border-navy/20 bg-white" : warn ? "border-warning/50 bg-warning/[0.07]" : "border-danger/40 bg-danger/[0.06]")}>
      {good ? (
        <CheckCircle2 aria-hidden className="size-11 text-success" />
      ) : neutral ? (
        <RotateCcw aria-hidden className="size-11 text-slate" />
      ) : warn ? (
        <TriangleAlert aria-hidden className="size-11 text-warning" />
      ) : (
        <XCircle aria-hidden className="size-11 text-danger" />
      )}
      <p className="mt-3 font-display text-2xl leading-tight text-ink">{name}</p>
      {p?.roles && p.roles.length > 0 && <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-gold-700">{rolesLabel(sortedRoles(p.roles))}</p>}
      {p?.institution && <p className="mt-0.5 text-sm text-slate-700">{p.institution}</p>}
      <p className="mt-3 font-medium text-ink">{outcomeText(o, first)}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {(good || warn) && p?.id && (
          <button type="button" onClick={() => onUndo(p.id)} disabled={pending} className={btn.secondary}>
            <RotateCcw aria-hidden className="size-4" /> Undo check-in
          </button>
        )}
        <button type="button" onClick={onDismiss} className={btn.secondary}>
          Clear
        </button>
      </div>
    </div>
  );
}

/** For anyone who can't show their code. */
function FindByName({ onCheckIn, onUndo, pending, stamp }: { onCheckIn: (id: string) => void; onUndo: (id: string) => void; pending: boolean; stamp: number }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const searching = q.trim().length >= 2;

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) return;
    let live = true;
    const t = setTimeout(async () => {
      try {
        const res = await searchAttendees(query);
        if (!live) return;
        if (res.ok) {
          setHits(res.data);
          setError(null);
        } else setError(res.error);
      } catch {
        if (live) setError("Search isn't working just now.");
      }
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // stamp: search again after each check-in so the list shows who's in.
  }, [q, stamp]);

  return (
    <section aria-labelledby={`${id}-h`} className="space-y-3 rounded-xl border border-navy/10 bg-white p-5">
      <h2 id={`${id}-h`} className="flex items-center gap-2 font-display text-xl text-ink">
        <Search aria-hidden className="size-5 text-electric-600" /> Find by name
      </h2>
      <label htmlFor={`${id}-q`} className="sr-only">
        Name, medical school or email
      </label>
      <input id={`${id}-q`} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, medical school or full email" autoComplete="off" className={inputClass} />
      <p role="status" aria-live="polite" className="sr-only">
        {searching && hits ? `${hits.length} ${hits.length === 1 ? "match" : "matches"}` : ""}
      </p>
      {error && <p className="text-sm text-danger">{error}</p>}
      {searching && hits && hits.length === 0 && <p className="text-sm text-slate-700">No approved accounts match. Check the spelling, or try their medical school.</p>}
      {searching && hits && hits.length > 0 && (
        <ul className="divide-y divide-navy/10">
          {hits.map((h) => (
            <li key={h.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <span className="min-w-0">
                <span className="block font-semibold text-ink">{h.full_name ?? "No name"}</span>
                <span className="block text-sm text-slate-700">{[h.institution, rolesLabel(sortedRoles(h.roles))].filter(Boolean).join(" · ")}</span>
              </span>
              {h.checked_in_at ? (
                <span className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-success">
                    <CheckCircle2 aria-hidden className="size-4" /> In at {time(h.checked_in_at)}
                  </span>
                  <button type="button" onClick={() => onUndo(h.id)} disabled={pending} className={btn.secondary}>
                    Undo<span className="sr-only"> check-in for {h.full_name}</span>
                  </button>
                </span>
              ) : (
                <button type="button" onClick={() => onCheckIn(h.id)} disabled={pending} className={btn.primary}>
                  <UserCheck aria-hidden className="size-4" /> Check in<span className="sr-only"> {h.full_name}</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
