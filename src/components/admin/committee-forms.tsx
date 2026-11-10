"use client";
import { useActionState, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { giveFeedback, reviewAccount, sendBroadcast, type BroadcastResult } from "@/app/admin/committee-actions";
import type { ActionResult } from "@/app/portal/actions";
import { ResultBanner } from "@/components/portal/profile-forms";
import { Field, inputClass } from "@/components/forms/field";
import { submitWithoutReset } from "@/lib/use-action-form";
import { ACCOUNT_STATUS_LABEL, ACCOUNT_TYPE_LABEL, ACCOUNT_TYPES, EXEC_TYPES } from "@/lib/accounts";
import type { AccountStatus, AccountType } from "@/lib/types";
import { cn } from "@/lib/cn";
import { btn } from "./ui";
import { useToast } from "@/components/ui/toast";

const small = "min-h-11 rounded-[3px] border border-navy/15 bg-white px-3 text-sm";

export function AccountReviewForm({ id, type, status, canLead, name }: { id: string; type: AccountType; status: AccountStatus; canLead: boolean; name: string }) {
  const toast = useToast();
  // The card leaves this list once a decision is saved, so confirm it with a toast.
  const [state, action, pending] = useActionState<ActionResult, FormData>(async (prev, fd) => {
    const r = await reviewAccount(prev, fd);
    if (r?.ok) toast({ tone: "success", title: `${name}: ${r.message}` });
    return r;
  }, null);
  const [chosenType, setChosenType] = useState<AccountType>(type);
  const needsLead = EXEC_TYPES.includes(chosenType) && !canLead;
  return (
    <form onSubmit={submitWithoutReset(action)} className="space-y-3">
      <ResultBanner state={state} />
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr]">
        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-ink">Account type</span>
          <select name="type" value={chosenType} onChange={(e) => setChosenType(e.target.value as AccountType)} className={cn(small, "w-full")}>
            {ACCOUNT_TYPES.map((t) => (
              <option key={t} value={t} disabled={EXEC_TYPES.includes(t) && !canLead && t !== type}>{ACCOUNT_TYPE_LABEL[t]}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-ink">Note to them <span className="font-normal text-slate">(optional, included in the email)</span></span>
          <input name="note" maxLength={1000} className={cn(small, "w-full")} placeholder="e.g. Welcome to the team" />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="notify" defaultChecked className="size-4 accent-navy" /> Email them about this decision
      </label>
      {needsLead && <p className="text-sm text-slate-700">Only the president or vice president can approve executive committee accounts. You can still waitlist or decline.</p>}
      <div className="flex flex-wrap gap-2">
        <button name="status" value="approved" disabled={pending || needsLead} className={btn.primary}>
          {pending && <Loader2 aria-hidden className="size-4 animate-spin" />} Approve
        </button>
        <button name="status" value="waitlisted" disabled={pending} className={btn.secondary}>Waitlist</button>
        <button name="status" value="declined" disabled={pending} className={btn.danger}>Decline</button>
        {status !== "pending" && (
          <button name="status" value="pending" disabled={pending} className="min-h-11 px-3 text-sm font-medium text-slate-700 underline underline-offset-4">
            Back to {ACCOUNT_STATUS_LABEL.pending.label.toLowerCase()}
          </button>
        )}
      </div>
    </form>
  );
}

export function FeedbackForm({ submissionId }: { submissionId: string }) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(giveFeedback, null);
  const [decision, setDecision] = useState("comment");
  return (
    <form onSubmit={submitWithoutReset(action)} className="space-y-4">
      <ResultBanner state={state} />
      <input type="hidden" name="submissionId" value={submissionId} />
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink">Decision</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {(
            [
              ["comment", "Comment only", "Leaves the status as it is."],
              ["changes_requested", "Request changes", "They'll be asked to upload a new version."],
              ["approved", "Approve", "Marks it ready for the day."],
            ] as const
          ).map(([v, label, hint]) => (
            <label key={v} className={cn("flex cursor-pointer gap-3 rounded-[3px] border p-3 text-sm", decision === v ? "border-navy ring-1 ring-navy" : "border-navy/15")}>
              <input type="radio" name="decision" value={v} checked={decision === v} onChange={() => setDecision(v)} className="mt-0.5 size-4 accent-navy" />
              <span><span className="block font-semibold text-ink">{label}</span><span className="text-slate-700">{hint}</span></span>
            </label>
          ))}
        </div>
      </fieldset>
      <Field id={`body-${submissionId}`} label="Feedback for the presenter" required={decision !== "approved"} error={state?.fieldErrors?.body} hint="Be specific and kind. The presenter sees this with your name.">
        <textarea id={`body-${submissionId}`} name="body" rows={6} maxLength={5000} className={inputClass} />
      </Field>
      <button type="submit" disabled={pending} className={btn.primary}>
        {pending && <Loader2 aria-hidden className="size-4 animate-spin" />} Save feedback
      </button>
    </form>
  );
}

export function BroadcastForm({ counts }: { counts: Partial<Record<AccountType, number>> }) {
  const [state, action, pending] = useActionState<BroadcastResult, FormData>(sendBroadcast, null);
  const [confirming, setConfirming] = useState(false);
  const fe = (k: string) => state?.fieldErrors?.[k];
  return (
    <form onSubmit={submitWithoutReset(action)} className="space-y-6" onChange={() => setConfirming(false)}>
      <ResultBanner state={state} />
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink">Send to <span className="text-danger">*</span></legend>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {ACCOUNT_TYPES.map((t) => (
            <label key={t} className="flex min-h-11 items-center gap-3 rounded-[3px] border border-navy/15 bg-white px-3 text-sm">
              <input type="checkbox" name="types" value={t} className="size-4 accent-navy" defaultChecked={t === "delegate"} />
              <span className="flex-1 text-ink">{ACCOUNT_TYPE_LABEL[t]}</span>
              <span className="text-xs text-slate">{counts[t] ?? 0}</span>
            </label>
          ))}
        </div>
        {fe("types") && <p className="mt-2 text-sm font-medium text-danger">{fe("types")}</p>}
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink">Whose account is</legend>
        <div className="flex flex-wrap gap-2">
          {(["approved", "waitlisted", "pending", "declined"] as const).map((s) => (
            <label key={s} className="flex min-h-11 items-center gap-2 rounded-[3px] border border-navy/15 bg-white px-3 text-sm">
              <input type="checkbox" name="statuses" value={s} defaultChecked={s === "approved"} className="size-4 accent-navy" /> {ACCOUNT_STATUS_LABEL[s].label}
            </label>
          ))}
        </div>
        {fe("statuses") && <p className="mt-2 text-sm font-medium text-danger">{fe("statuses")}</p>}
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink">What kind of email is this?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex gap-3 rounded-[3px] border border-navy/15 bg-white p-3 text-sm">
            <input type="radio" name="purpose" value="service" defaultChecked className="mt-0.5 size-4 accent-navy" />
            <span><span className="block font-semibold text-ink">Conference update</span><span className="text-slate-700">Practical information about INSPIRE 2026, such as times, rooms or changes. Goes to everyone selected.</span></span>
          </label>
          <label className="flex gap-3 rounded-[3px] border border-navy/15 bg-white p-3 text-sm">
            <input type="radio" name="purpose" value="marketing" className="mt-0.5 size-4 accent-navy" />
            <span><span className="block font-semibold text-ink">News or promotion</span><span className="text-slate-700">Future events, sponsors or anything promotional. By law this only goes to people who opted in.</span></span>
          </label>
        </div>
      </fieldset>
      <Field id="subject" label="Subject" required error={fe("subject")}>
        <input id="subject" name="subject" maxLength={160} className={inputClass} />
      </Field>
      <Field id="body" label="Message" required error={fe("body")} hint="Plain text. Leave a blank line between paragraphs. We add a greeting with their first name and your sign-off.">
        <textarea id="body" name="body" rows={10} maxLength={10000} className={inputClass} />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <button name="intent" value="preview" disabled={pending} className={btn.secondary}>Count recipients</button>
        <button name="intent" value="test" disabled={pending} className={btn.secondary}>Send me a test</button>
        {confirming ? (
          <>
            <button name="intent" value="send" disabled={pending} className={btn.primary}>
              {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Send aria-hidden className="size-4" />} Yes, send it now
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="min-h-11 px-3 text-sm font-medium text-slate-700">Cancel</button>
          </>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} disabled={pending} className={btn.primary}>
            <Send aria-hidden className="size-4" /> Send
          </button>
        )}
      </div>
      {confirming && <p className="text-sm text-slate-700">Emails can&apos;t be recalled once sent. Check the recipient count first.</p>}
    </form>
  );
}
