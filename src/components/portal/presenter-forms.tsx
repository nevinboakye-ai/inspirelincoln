"use client";
import { useActionState, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { uploadPoster, withdrawAbstract } from "@/app/portal/actions";
import { Field } from "@/components/forms/field";
import { ResultBanner } from "./profile-forms";

export function WithdrawForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(withdrawAbstract, null);
  const [confirm, setConfirm] = useState(false);
  if (state?.ok) return <ResultBanner state={state} />;
  return (
    <form action={action}>
      <ResultBanner state={state} />
      <input type="hidden" name="id" value={id} />
      {confirm ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-slate-700">Withdraw this abstract? This can&apos;t be undone.</p>
          <button type="submit" disabled={pending} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-danger px-5 text-sm font-semibold text-white disabled:opacity-60">
            {pending && <Loader2 aria-hidden className="size-4 animate-spin" />} Yes, withdraw
          </button>
          <button type="button" onClick={() => setConfirm(false)} className="min-h-11 rounded-full px-4 text-sm font-medium text-slate-700 hover:bg-paper-200">Cancel</button>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirm(true)} className="min-h-11 rounded-full border border-danger/30 px-5 text-sm font-semibold text-danger hover:bg-danger/[0.05]">
          Withdraw abstract
        </button>
      )}
    </form>
  );
}

export function PosterUploadForm({ abstractId, maxMb }: { abstractId: string; maxMb: number }) {
  const [state, action, pending] = useActionState(uploadPoster, null);
  const fe = (k: string) => state?.fieldErrors?.[k];
  return (
    <form action={action} className="space-y-4">
      <ResultBanner state={state} />
      <input type="hidden" name="abstractId" value={abstractId} />
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink">Orientation <span className="text-danger">*</span></legend>
        <div className="flex gap-4">
          {(["landscape", "portrait"] as const).map((o) => (
            <label key={o} className="flex min-h-11 items-center gap-2 text-sm capitalize text-slate-700">
              <input type="radio" name="orientation" value={o} className="size-4 accent-electric-600" /> {o}
            </label>
          ))}
        </div>
        {fe("orientation") && <p className="mt-1 text-sm font-medium text-danger">{fe("orientation")}</p>}
      </fieldset>
      <Field id={`poster-${abstractId}`} label="Poster file" required hint={`PDF, PNG or JPEG, up to ${maxMb} MB.`} error={fe("poster")}>
        <input id={`poster-${abstractId}`} name="poster" type="file" accept="application/pdf,image/png,image/jpeg" className="block w-full text-sm text-slate-700 file:mr-4 file:min-h-11 file:rounded-full file:border-0 file:bg-navy file:px-5 file:font-semibold file:text-paper" />
      </Field>
      <button type="submit" disabled={pending} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-navy px-6 font-display font-semibold text-paper hover:bg-navy-700 disabled:opacity-60">
        {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Upload aria-hidden className="size-4" />} Upload poster
      </button>
    </form>
  );
}
