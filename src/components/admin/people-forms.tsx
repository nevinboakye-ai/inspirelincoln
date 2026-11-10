"use client";
import { submitWithoutReset } from "@/lib/use-action-form";
import { useActionState, useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { addRegistration, checkIn, reviewPoster, setRegistrationStatus, setRole, updateEnquiry, type CheckInResult } from "@/app/admin/people-actions";
import type { ActionResult } from "@/app/portal/actions";
import { Field, inputClass } from "@/components/forms/field";
import { ResultBanner } from "@/components/portal/profile-forms";
import { btn } from "./ui";

const small = "min-h-10 rounded-[3px] border border-navy/15 bg-white px-3 text-sm";

/** A compact select that saves on change. */
function AutoSelect({ action, hidden, name, value, options, label }: { action: (s: ActionResult, f: FormData) => Promise<ActionResult>; hidden: Record<string, string>; name: string; value: string; options: [string, string][]; label: string }) {
  const [state, act, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form ref={ref} onSubmit={submitWithoutReset(act)} className="flex items-center gap-2">
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <select name={name} defaultValue={value} aria-label={label} onChange={() => ref.current?.requestSubmit()} className={small} disabled={pending}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      {pending && <Loader2 aria-hidden className="size-4 animate-spin text-slate" />}
      {state?.error && <span role="alert" className="text-xs text-danger">{state.error}</span>}
      {state?.ok && !pending && <span className="sr-only" role="status">Saved</span>}
    </form>
  );
}

export const RegistrationStatus = ({ id, status }: { id: string; status: string }) => (
  <AutoSelect action={setRegistrationStatus} hidden={{ id }} name="status" value={status} label="Registration status" options={[["pending", "Pending"], ["confirmed", "Confirmed"], ["waitlisted", "Waitlisted"], ["cancelled", "Cancelled"]]} />
);
export const RoleSelect = ({ id, role }: { id: string; role: string }) => (
  <AutoSelect action={setRole} hidden={{ id }} name="role" value={role} label="Role" options={[["delegate", "No extra access"], ["reviewer", "Abstract reviewer"], ["editor", "Website editor"], ["admin", "Site owner"]]} />
);
export const EnquiryStatus = ({ id, status }: { id: string; status: string }) => (
  <AutoSelect action={updateEnquiry} hidden={{ id }} name="status" value={status} label="Enquiry status" options={[["new", "New"], ["in_progress", "In progress"], ["closed", "Closed"]]} />
);

export function DeleteEnquiry({ id }: { id: string }) {
  const [state, act, pending] = useActionState(updateEnquiry, null);
  return (
    <form action={act} onSubmit={(e) => { if (!confirm("Delete this enquiry permanently?")) e.preventDefault(); }}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="intent" value="delete" />
      <button disabled={pending} className="min-h-10 rounded-[3px] px-3 text-sm font-medium text-danger hover:bg-danger/[0.05]">Delete</button>
      {state?.error && <span role="alert" className="text-xs text-danger">{state.error}</span>}
    </form>
  );
}

export function AddRegistrationForm() {
  const [state, act, pending] = useActionState(addRegistration, null);
  return (
    <form action={act} className="space-y-3">
      <ResultBanner state={state} />
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
        <Field id="email" label="Delegate's account email" error={state?.fieldErrors?.email}>
          <input id="email" name="email" type="email" required className={inputClass} />
        </Field>
        <Field id="status" label="Status">
          <select id="status" name="status" defaultValue="confirmed" className={inputClass}>
            <option value="confirmed">Confirmed</option><option value="pending">Pending</option><option value="waitlisted">Waitlisted</option>
          </select>
        </Field>
        <Field id="reference" label="External reference">
          <input id="reference" name="reference" className={inputClass} placeholder="Optional" />
        </Field>
        <button disabled={pending} className={btn.primary}>{pending && <Loader2 aria-hidden className="size-4 animate-spin" />} Add</button>
      </div>
    </form>
  );
}

export function PosterReviewForm({ id, status, note }: { id: string; status: string; note: string }) {
  const [state, act, pending] = useActionState(reviewPoster, null);
  return (
    <form onSubmit={submitWithoutReset(act)} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <select name="status" defaultValue={status} aria-label="Poster status" className={small}>
        <option value="received">Received</option><option value="approved">Approved</option><option value="needs_changes">Changes requested</option>
      </select>
      <input name="note" defaultValue={note} placeholder="Note to presenter" aria-label="Note to presenter" className={`${small} min-w-48 flex-1`} />
      <button disabled={pending} className={btn.secondary}>Save</button>
      {state?.error && <span role="alert" className="text-xs text-danger">{state.error}</span>}
      {state?.ok && <span role="status" className="text-xs text-success">Saved</span>}
    </form>
  );
}

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };

/** Check-in desk: camera QR scanning where the browser supports BarcodeDetector, with manual entry everywhere. */
export function CheckInDesk() {
  const [state, act, pending] = useActionState<CheckInResult, FormData>(checkIn, null);
  const [scanning, setScanning] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const last = useRef<{ v: string; t: number }>({ v: "", t: 0 });

  useEffect(() => setSupported(typeof window !== "undefined" && "BarcodeDetector" in window), []);

  useEffect(() => {
    if (!scanning) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    const BD = (window as unknown as { BarcodeDetector: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
    const detector = new BD({ formats: ["qr_code"] });
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!video.current || stopped) return;
        video.current.srcObject = stream;
        await video.current.play();
        const tick = async () => {
          if (stopped || !video.current) return;
          try {
            const codes = await detector.detect(video.current);
            const v = codes[0]?.rawValue;
            const now = Date.now();
            if (v && (v !== last.current.v || now - last.current.t > 4000)) {
              last.current = { v, t: now };
              if (input.current) input.current.value = v;
              form.current?.requestSubmit();
            }
          } catch {}
          raf = window.setTimeout(tick, 350) as unknown as number;
        };
        tick();
      } catch {
        setScanning(false);
        alert("Camera access was blocked. Use manual entry instead.");
      }
    })();
    return () => {
      stopped = true;
      clearTimeout(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [scanning]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4 rounded-xl border border-navy/10 bg-white p-6">
        {supported && (
          <button type="button" onClick={() => setScanning((s) => !s)} className={scanning ? btn.secondary : btn.primary}>
            <Camera aria-hidden className="size-4" /> {scanning ? "Stop camera" : "Scan QR codes"}
          </button>
        )}
        {supported === false && <p className="text-sm text-slate-700">This browser can&apos;t scan QR codes directly. Use a recent Chrome or Edge on Android, or enter the code manually.</p>}
        {scanning && <video ref={video} muted playsInline className="aspect-video w-full rounded-md bg-midnight object-cover" aria-label="Camera preview" />}
        <form ref={form} action={act} className="flex flex-wrap items-end gap-2">
          <Field id="token" label="Check-in code" className="min-w-56 flex-1" hint="Scan, or type the code shown under the delegate's QR.">
            <input ref={input} id="token" name="token" autoComplete="off" className={inputClass} />
          </Field>
          <button disabled={pending} className={btn.primary}>{pending && <Loader2 aria-hidden className="size-4 animate-spin" />} Check in</button>
        </form>
      </div>
      <div aria-live="assertive" className="min-h-40">
        {state && (
          <div className={`rounded-xl border p-6 ${state.ok ? (state.already ? "border-warning/30 bg-warning/[0.06]" : "border-success/30 bg-success/[0.06]") : "border-danger/30 bg-danger/[0.06]"}`}>
            {state.ok ? <CheckCircle2 aria-hidden className={`size-10 ${state.already ? "text-warning" : "text-success"}`} /> : <XCircle aria-hidden className="size-10 text-danger" />}
            <p className="mt-3 font-display text-2xl font-semibold text-ink">{state.name ?? (state.ok ? "Checked in" : "Not checked in")}</p>
            <p className="mt-1 text-slate-700">
              {state.ok
                ? state.already
                  ? `Already checked in at ${state.at ? new Date(state.at).toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" }) : "an earlier time"}.`
                  : "Checked in. Welcome!"
                : state.error}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
