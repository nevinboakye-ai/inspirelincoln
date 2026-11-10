"use client";
import { useActionState, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { changeAccountType } from "@/app/admin/committee-actions";
import { ResultBanner } from "@/components/portal/profile-forms";
import { submitWithoutReset } from "@/lib/use-action-form";
import { ACCOUNT_TYPE_BLURB, ACCOUNT_TYPE_GROUPS, ACCOUNT_TYPE_LABEL, EXEC_TYPES } from "@/lib/accounts";
import type { AccountStatus, AccountType } from "@/lib/types";
import { cn } from "@/lib/cn";
import { btn } from "./ui";

/**
 * Pick someone's account type from grouped cards: attending, the supporting
 * committee teams, or the executive committee. Saving keeps their approval as
 * it is; the email is optional.
 */
export function AccountTypePicker({ id, type, status, canLead, name }: { id: string; type: AccountType; status: AccountStatus; canLead: boolean; name: string }) {
  const [state, action, pending] = useActionState(changeAccountType, null);
  const [chosen, setChosen] = useState<AccountType>(type);
  const [saved, setSaved] = useState<AccountType>(type);
  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    if (state?.ok) setSaved(chosen);
  }
  const changed = chosen !== saved;
  const locked = (t: AccountType) => !canLead && (EXEC_TYPES.includes(t) || EXEC_TYPES.includes(saved)) && t !== saved;

  return (
    <form onSubmit={submitWithoutReset(action)} className="space-y-5">
      <input type="hidden" name="id" value={id} />
      <ResultBanner state={state} />
      {ACCOUNT_TYPE_GROUPS.map((g) => (
        <fieldset key={g.title}>
          <legend className="mb-2 text-sm">
            <span className="font-semibold text-ink">{g.title}</span> <span className="text-slate">· {g.hint}</span>
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {g.types.map((t) => {
              const on = chosen === t;
              const off = locked(t);
              return (
                <label
                  key={t}
                  className={cn(
                    "relative flex min-h-14 cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-electric-600 has-[:focus-visible]:ring-offset-2",
                    on ? "border-navy bg-navy text-paper" : "border-navy/15 bg-white text-ink hover:border-navy/40",
                    off && "cursor-not-allowed opacity-50 hover:border-navy/15",
                  )}
                >
                  <input type="radio" name="type" value={t} checked={on} disabled={off || pending} onChange={() => setChosen(t)} className="sr-only" />
                  <span aria-hidden className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2", on ? "border-cyan bg-cyan text-navy" : "border-navy/25")}>
                    {on && <Check className="size-3.5" strokeWidth={3} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold">
                      {ACCOUNT_TYPE_LABEL[t]}
                      {t === saved && <span className={cn("ml-2 text-xs font-normal", on ? "text-paper/75" : "text-slate")}>(current)</span>}
                    </span>
                    <span className={cn("block text-xs", on ? "text-paper/75" : "text-slate-700")}>{ACCOUNT_TYPE_BLURB[t]}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
      {!canLead && <p className="text-xs text-slate">Only the president or vice president can move people into or out of the executive committee.</p>}
      <div className="flex flex-col gap-3 rounded-lg border border-navy/10 bg-paper p-3 sm:flex-row sm:items-center sm:justify-between">
        <label className={cn("flex min-h-11 items-center gap-3 text-sm text-ink", status !== "approved" && "opacity-60")}>
          <input type="checkbox" name="notify" disabled={status !== "approved"} className="size-5 accent-navy" />
          Email {name.split(" ")[0]} to let them know
        </label>
        <button type="submit" disabled={!changed || pending} className={btn.primary}>
          {pending && <Loader2 aria-hidden className="size-4 animate-spin" />}
          {changed ? `Change to ${ACCOUNT_TYPE_LABEL[chosen]}` : "No change to save"}
        </button>
      </div>
      {status !== "approved" && (
        <p className="text-xs text-slate">Their account isn&apos;t approved yet, so this only changes what they&apos;ll be once approved. Use the account decision below to approve them.</p>
      )}
    </form>
  );
}
