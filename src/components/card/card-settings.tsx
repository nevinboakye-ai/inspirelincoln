"use client";
import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { Eye, Loader2, RefreshCw } from "lucide-react";
import { newCardCode, setCardShared } from "@/app/portal/card-actions";
import { cn } from "@/lib/cn";

const small = "inline-flex min-h-11 items-center justify-center gap-2 rounded-[3px] border border-navy/15 bg-white px-4 font-ui text-sm font-semibold text-ink hover:border-navy/40 disabled:opacity-60";

/** Choose whether people who scan your card see your details, and replace the code if you need to. */
export function CardSettings({ shared: initial, previewHref, presenting, showsEmail }: { shared: boolean; previewHref: string; presenting: boolean; showsEmail: boolean }) {
  const [shared, setShared] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const [resetting, startReset] = useTransition();
  const id = useId();

  const toggle = (on: boolean) => {
    setShared(on);
    start(async () => {
      try {
        const res = await setCardShared(on);
        if (!res?.ok) setShared(!on);
        setMsg({ ok: Boolean(res?.ok), text: (res?.ok ? res.message : res?.error) ?? "" });
      } catch {
        setShared(!on);
        setMsg({ ok: false, text: "That didn't save. Check your connection and try again." });
      }
    });
  };
  const reset = () =>
    startReset(async () => {
      try {
        const res = await newCardCode();
        setMsg({ ok: Boolean(res?.ok), text: (res?.ok ? res.message : res?.error) ?? "" });
      } catch {
        setMsg({ ok: false, text: "That didn't work. Check your connection and try again." });
      }
      setConfirm(false);
    });

  return (
    <div className="space-y-5">
      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-navy/10 bg-paper/60 p-4">
        <input type="checkbox" checked={shared} onChange={(e) => toggle(e.target.checked)} disabled={pending} className="mt-0.5 size-5 shrink-0 accent-navy" aria-describedby={`${id}-what`} />
        <span>
          <span className="block font-semibold text-ink">Let delegates who scan my card see my details</span>
          <span className="block text-sm text-slate-700">Untick to keep everything private. The committee can still scan it to check you in.</span>
        </span>
      </label>
      <div id={`${id}-what`} className={cn("text-sm text-slate-700", !shared && "opacity-60")}>
        <p className="font-semibold text-ink">{shared ? "What they see" : "What they would see"}</p>
        <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
          <li>Your name, roles, medical school and year</li>
          <li>Your bio and LinkedIn, if you&apos;ve added them above</li>
          <li>{showsEmail ? "Your email, because you've chosen to show it above" : "Not your email, unless you choose to show it above"}</li>
          {presenting && <li>The title of your presentation or poster</li>}
        </ul>
        <p className="mt-2">Only confirmed delegates who are logged in can see your card. They can save you to their People I&apos;ve met with a private note.</p>
      </div>
      <p role="status" aria-live="polite" className={cn("text-sm font-medium empty:hidden", msg?.ok ? "text-success" : "text-danger")}>
        {msg?.text}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Link href={previewHref} className={small}>
          <Eye aria-hidden className="size-4" /> See what people see
        </Link>
        {confirm ? (
          <span className="flex flex-wrap items-center gap-2 rounded-lg border border-warning/30 bg-warning/[0.06] p-2 pl-3 text-sm text-ink">
            Your current QR code will stop working, for saving and for check-in.
            <button type="button" onClick={reset} disabled={resetting} className={cn(small, "border-navy bg-navy text-paper hover:bg-navy-700")}>
              {resetting && <Loader2 aria-hidden className="size-4 animate-spin" />} Get a new code
            </button>
            <button type="button" onClick={() => setConfirm(false)} className={small}>
              Cancel
            </button>
          </span>
        ) : (
          <button type="button" onClick={() => setConfirm(true)} className={small}>
            <RefreshCw aria-hidden className="size-4" /> Get a new QR code
          </button>
        )}
      </div>
      <p className="text-xs text-slate-700">If a photo of your card has been shared somewhere you didn&apos;t intend, a new code stops anyone using the old one.</p>
    </div>
  );
}
