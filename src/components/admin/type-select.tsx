"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { changeAccountType } from "@/app/admin/committee-actions";
import { setRosterType } from "@/app/admin/person-actions";
import { ACCOUNT_TYPE_GROUPS, ACCOUNT_TYPE_LABEL, EXEC_TYPES } from "@/lib/accounts";
import type { AccountType } from "@/lib/types";
import { cn } from "@/lib/cn";

/**
 * The account types as grouped options. Executive types are greyed out for
 * anyone who isn't the president or vice president, apart from the current one.
 */
export function TypeOptions({ canLead, current }: { canLead: boolean; current?: AccountType }) {
  const locked = (t: AccountType) => !canLead && t !== current && (EXEC_TYPES.includes(t) || (current !== undefined && EXEC_TYPES.includes(current)));
  return ACCOUNT_TYPE_GROUPS.map((g) => (
    <optgroup key={g.title} label={g.title}>
      {g.types.map((t) => (
        <option key={t} value={t} disabled={locked(t)}>
          {ACCOUNT_TYPE_LABEL[t]}
        </option>
      ))}
    </optgroup>
  ));
}

type Status = { kind: "idle" } | { kind: "saving" } | { kind: "saved"; message: string } | { kind: "error"; message: string };

/** How long to wait after the last change before saving, so arrowing through a closed select only saves where it stops. */
const SETTLE_MS = 600;

/**
 * Change someone's account type straight from a list, without opening their
 * profile. Saves as soon as a type is picked and says so next to the select;
 * if saving fails it goes back to the saved type and explains why.
 * `kind` says whether this is a signed-up account or someone on the selected
 * list who hasn't set up their account yet.
 */
export function InlineTypeSelect({ id, type, kind, canLead, name }: { id: string; type: AccountType; kind: "account" | "roster"; canLead: boolean; name: string }) {
  const [value, setValue] = useState<AccountType>(type);
  const [saved, setSaved] = useState<AccountType>(type);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [, startTransition] = useTransition();
  const savedRef = useRef<AccountType>(type);
  const latest = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const hide = useRef<ReturnType<typeof setTimeout>>(undefined);

  // A fresh type from the server (after a save elsewhere) replaces ours.
  const [prop, setProp] = useState(type);
  if (type !== prop) {
    setProp(type);
    setValue(type);
    setSaved(type);
  }
  useEffect(() => {
    savedRef.current = saved;
  }, [saved]);

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      clearTimeout(hide.current);
    },
    [],
  );

  const save = (next: AccountType) => {
    clearTimeout(timer.current);
    timer.current = undefined;
    if (next === savedRef.current) {
      setStatus({ kind: "idle" });
      return;
    }
    const ticket = ++latest.current;
    setStatus({ kind: "saving" });
    startTransition(async () => {
      let res;
      try {
        if (kind === "roster") res = await setRosterType(id, next);
        else {
          const form = new FormData();
          form.set("id", id);
          form.set("type", next);
          res = await changeAccountType(null, form);
        }
      } catch {
        res = { ok: false, error: "Could not save. Check your connection and try again." };
      }
      if (res?.ok) {
        savedRef.current = next;
        setSaved(next);
      }
      // Only the most recent save gets to update what the person sees.
      if (ticket !== latest.current) return;
      if (res?.ok) {
        setStatus({ kind: "saved", message: `${name} is now ${ACCOUNT_TYPE_LABEL[next]}.` });
        clearTimeout(hide.current);
        hide.current = setTimeout(() => setStatus({ kind: "idle" }), 4000);
      } else {
        setValue(savedRef.current);
        setStatus({ kind: "error", message: res?.error ?? "Could not change the account type." });
      }
    });
  };

  const onChange = (next: AccountType) => {
    setValue(next);
    setStatus({ kind: "idle" });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => save(next), SETTLE_MS);
  };

  const errId = `type-err-${id}`;
  return (
    <div className="min-w-[11rem]">
      <div className="flex items-center gap-2">
        <select
          aria-label={`Account type for ${name}`}
          aria-describedby={status.kind === "error" ? errId : undefined}
          aria-invalid={status.kind === "error" || undefined}
          aria-busy={status.kind === "saving" || undefined}
          value={value}
          onChange={(e) => onChange(e.target.value as AccountType)}
          onBlur={() => timer.current && save(value)}
          className={cn(
            "min-h-10 w-full max-w-[14rem] cursor-pointer rounded-[3px] border bg-white py-1.5 pl-3 pr-8 text-sm font-medium text-ink transition-colors hover:border-navy/40",
            status.kind === "error" ? "border-danger" : status.kind === "saved" ? "border-success" : "border-navy/15",
          )}
        >
          <TypeOptions canLead={canLead} current={saved} />
        </select>
        <span aria-hidden className="grid size-5 shrink-0 place-items-center">
          {status.kind === "saving" && <Loader2 className="size-4 animate-spin text-slate" />}
          {status.kind === "saved" && <Check className="size-4 text-success" strokeWidth={3} />}
        </span>
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {status.kind === "saved" ? status.message : ""}
      </p>
      {status.kind === "error" && (
        <p id={errId} role="alert" className="mt-1 max-w-[16rem] text-xs font-medium text-danger">
          {status.message}
        </p>
      )}
    </div>
  );
}
