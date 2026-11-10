"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { ArrowUpRight, Loader2 } from "lucide-react";
import { offerOralSlot } from "@/app/admin/committee-actions";
import { submitWithoutReset } from "@/lib/use-action-form";
import { btn } from "@/components/admin/ui";

/** Two-step "Offer an oral slot" so nobody is moved by a stray tap. */
export function OfferSlotForm({ id, source, name }: { id: string; source: "account" | "list"; name: string }) {
  const [state, action, pending] = useActionState(offerOralSlot, null);
  const [confirming, setConfirming] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);
  const touched = useRef(false);

  useEffect(() => {
    if (!touched.current) return;
    (confirming ? confirmRef : startRef).current?.focus();
  }, [confirming]);

  if (state?.ok) return <p role="status" className="text-sm font-medium text-success">{state.message}</p>;

  return (
    <form onSubmit={submitWithoutReset(action)} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="source" value={source} />
      {state?.error && <p role="alert" className="text-sm font-medium text-danger">{state.error}</p>}
      {confirming ? (
        <div className="space-y-3 rounded-lg border border-navy/10 bg-paper p-3">
          <p className="text-sm text-ink">
            Make <strong>{name}</strong> an oral presenter? {source === "account" ? "Their My Hub will ask them to confirm and upload slides." : "They'll be an oral presenter when they first log in."}
          </p>
          <label className="flex min-h-11 items-center gap-3 text-sm text-ink">
            <input type="checkbox" name="notify" defaultChecked className="size-5 accent-navy" /> Email them to let them know
          </label>
          <div className="flex flex-wrap gap-2">
            <button ref={confirmRef} type="submit" disabled={pending} className={btn.primary}>
              {pending && <Loader2 aria-hidden className="size-4 animate-spin" />} Yes, offer the slot
            </button>
            <button type="button" disabled={pending} onClick={() => { touched.current = true; setConfirming(false); }} className={btn.secondary}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button ref={startRef} type="button" onClick={() => { touched.current = true; setConfirming(true); }} className={btn.secondary}>
          Offer an oral slot <ArrowUpRight aria-hidden className="size-4" />
        </button>
      )}
    </form>
  );
}
