"use client";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Check, ChevronDown, Loader2, X } from "lucide-react";
import { setRoles } from "@/app/admin/roles-actions";
import { ACCOUNT_TYPE_BLURB, ACCOUNT_TYPE_GROUPS, ACCOUNT_TYPE_LABEL, EXEC_TYPES, ROLE_RANK, rolesLabel, rolesOf } from "@/lib/accounts";
import type { AccountType } from "@/lib/types";
import { cn } from "@/lib/cn";
import { btn } from "./ui";

/** Roles that come with another: everyone on the oral waiting list also presents a poster. */
const INCLUDES: Partial<Record<AccountType, AccountType[]>> = { oral_waitlist: ["poster_presenter"] };

/** Roles that can't be held together: ticking one unticks the others. */
const CONFLICTS: Partial<Record<AccountType, AccountType[]>> = {
  delegate: ["oral_presenter", "poster_presenter", "oral_waitlist"],
  oral_presenter: ["oral_waitlist", "delegate"],
  poster_presenter: ["delegate"],
  oral_waitlist: ["oral_presenter", "delegate"],
  president: ["vice_president"],
  vice_president: ["president"],
};

const sortRoles = (types: AccountType[]) => ROLE_RANK.filter((t) => types.includes(t));

/**
 * Tick every role someone holds, grouped as attending, supporting committee
 * and executive committee. Executive roles are locked for anyone who isn't the
 * president or vice president. Renders real checkboxes named `name`, so it
 * also works inside an ordinary form.
 */
export function RoleCheckboxes({
  initial,
  canLead,
  onChange,
  name = "types",
  compact = false,
  disabled = false,
}: {
  initial: AccountType[];
  canLead: boolean;
  onChange?: (types: AccountType[]) => void;
  name?: string;
  compact?: boolean;
  disabled?: boolean;
}) {
  const [picked, setPicked] = useState<AccountType[]>(initial);
  const hint = useId();
  // Someone with an executive role can only be changed by leadership at all.
  const lockedAll = !canLead && initial.some((t) => EXEC_TYPES.includes(t));
  const locked = (t: AccountType) => disabled || lockedAll || (!canLead && EXEC_TYPES.includes(t));

  const toggle = (t: AccountType, on: boolean) => {
    const next = on
      ? [...picked.filter((p) => !(CONFLICTS[t] ?? []).includes(p) || locked(p)), t, ...(INCLUDES[t] ?? []).filter((i) => !picked.includes(i))]
      : picked.filter((p) => p !== t);
    const sorted = sortRoles(next);
    setPicked(sorted);
    onChange?.(sorted);
  };

  return (
    <div className="space-y-4" aria-describedby={hint}>
      <p id={hint} className="text-sm text-slate-700">
        Tick every role they hold. Their most senior role shows first.
        {lockedAll
          ? " They hold an executive committee role, so only the president or vice president can change their roles."
          : !canLead
            ? " Only the president or vice president can add executive committee roles."
            : ""}
      </p>
      {ACCOUNT_TYPE_GROUPS.map((g) => (
        <fieldset key={g.title}>
          <legend className="mb-2 text-sm">
            <span className="font-semibold text-ink">{g.title}</span> <span className="text-slate">· {g.hint}</span>
          </legend>
          <div className={cn("grid gap-2", compact ? "grid-cols-2" : "sm:grid-cols-2")}>
            {g.types.map((t) => {
              const on = picked.includes(t);
              // A role that comes with another they hold stays ticked until that one is unticked.
              const with_ = picked.find((p) => (INCLUDES[p] ?? []).includes(t));
              const off = locked(t) || Boolean(with_);
              return (
                <label
                  key={t}
                  className={cn(
                    "relative flex cursor-pointer items-start gap-3 rounded-lg border text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-electric-600 has-[:focus-visible]:ring-offset-2",
                    compact ? "min-h-11 p-2.5" : "min-h-14 p-3",
                    on ? "border-navy bg-navy text-paper" : "border-navy/15 bg-white text-ink hover:border-navy/40",
                    off && !with_ && "cursor-not-allowed opacity-50 hover:border-navy/15",
                    with_ && "cursor-not-allowed",
                  )}
                >
                  <input type="checkbox" name={name} value={t} checked={on} disabled={off} onChange={(e) => toggle(t, e.target.checked)} className="sr-only" />
                  {/* Disabled boxes aren't submitted, so carry a locked role through a plain form. */}
                  {off && on && <input type="hidden" name={name} value={t} />}
                  <span aria-hidden className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-[4px] border-2", on ? "border-cyan bg-cyan text-navy" : "border-navy/25")}>
                    {on && <Check className="size-3.5" strokeWidth={3} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold">{ACCOUNT_TYPE_LABEL[t]}</span>
                    {with_ ? (
                      <span className={cn("block text-xs", on ? "text-paper/80" : "text-slate-700")}>Included with {ACCOUNT_TYPE_LABEL[with_].toLowerCase()}</span>
                    ) : (
                      !compact && <span className={cn("block text-xs", on ? "text-paper/75" : "text-slate-700")}>{ACCOUNT_TYPE_BLURB[t]}</span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

/**
 * Someone's roles as a button in a list. It opens a dialog to tick their
 * roles, saves them, and says so without leaving the list.
 */
export function RolesButton({
  id,
  kind,
  main,
  extra,
  canLead,
  name,
}: {
  id: string;
  kind: "account" | "roster";
  main: AccountType;
  extra?: AccountType[] | null;
  canLead: boolean;
  name: string;
}) {
  const fromServer = rolesOf(main, extra);
  const key = fromServer.join(",");
  const [saved, setSaved] = useState<AccountType[]>(fromServer);
  const [seenKey, setSeenKey] = useState(key);
  if (key !== seenKey) {
    setSeenKey(key);
    setSaved(fromServer);
  }
  const [draft, setDraft] = useState<AccountType[]>(saved);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const [flash, setFlash] = useState(false);
  const [pending, start] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(false), 3000);
    return () => clearTimeout(t);
  }, [flash]);

  const show = () => {
    setDraft(saved);
    setError(null);
    setAnnounce("");
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  const changed = draft.join(",") !== saved.join(",");

  const save = () =>
    start(async () => {
      setError(null);
      let res;
      try {
        res = await setRoles({ id, kind, types: draft });
      } catch {
        res = { ok: false, error: "Could not save. Check your connection and try again." };
      }
      if (!res?.ok) {
        setError(res?.error ?? "Could not save their roles.");
        return;
      }
      const next = sortRoles(draft);
      setSaved(next);
      setAnnounce(`${name} is now ${rolesLabel(next)}.`);
      setFlash(true);
      close();
    });

  const label = rolesLabel(saved);
  return (
    // relative: keeps the visually hidden status inside the table's scroll area,
    // so it can't widen the page on phones.
    <span className="relative inline-block">
      <span className="inline-flex items-center gap-2">
        <button
          ref={trigger}
          type="button"
          onClick={show}
          aria-haspopup="dialog"
          aria-label={`${label}. Change roles for ${name}`}
          className={cn(
            "inline-flex min-h-10 max-w-[16rem] items-center gap-2 rounded-[3px] border bg-white py-1.5 pl-3 pr-2 text-left text-sm font-medium text-ink transition-colors hover:border-navy/40",
            flash ? "border-success" : "border-navy/15",
          )}
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate">{ACCOUNT_TYPE_LABEL[saved[0]]}</span>
            {saved.length > 1 && <span className="block truncate text-xs font-normal text-slate-700">+ {saved.slice(1).map((t) => ACCOUNT_TYPE_LABEL[t]).join(", ")}</span>}
          </span>
          <ChevronDown aria-hidden className="size-4 shrink-0 text-slate" />
        </button>
        <span aria-hidden className="grid size-5 shrink-0 place-items-center">
          {flash && <Check className="size-4 text-success" strokeWidth={3} />}
        </span>
      </span>
      <span role="status" aria-live="polite" className="sr-only">
        {announce}
      </span>

      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        onCancel={(e) => {
          e.preventDefault();
          if (!pending) close();
        }}
        onClick={(e) => e.target === e.currentTarget && !pending && close()}
        className="m-auto w-[min(40rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] overflow-hidden rounded-xl border border-navy/10 bg-paper p-0 text-left text-ink shadow-[0_30px_80px_-30px_rgba(14,27,49,0.6)] backdrop:bg-navy/50 backdrop:backdrop-blur-[2px]"
      >
        {open && (
          <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
            <div className="flex items-start justify-between gap-4 border-b border-navy/10 bg-white px-5 py-4">
              <div className="min-w-0">
                <h2 id={titleId} className="font-display text-xl text-ink">
                  Roles for {name}
                </h2>
                <p className="mt-0.5 text-sm text-slate-700">{kind === "roster" ? "They'll have these roles from the moment they sign up." : "Saving keeps their approval as it is."}</p>
              </div>
              <button type="button" onClick={close} disabled={pending} className="-mr-2 grid size-11 shrink-0 place-items-center rounded-full text-slate hover:bg-paper hover:text-ink">
                <X aria-hidden className="size-5" />
                <span className="sr-only">Close</span>
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {error && (
                <p role="alert" className="mb-4 rounded-md border border-danger/25 bg-danger/[0.06] p-3 text-sm font-medium text-danger">
                  {error}
                </p>
              )}
              <RoleCheckboxes initial={saved} canLead={canLead} onChange={setDraft} compact disabled={pending} />
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-navy/10 bg-white px-5 py-3 sm:flex-row sm:items-center sm:justify-end">
              <button type="button" onClick={close} disabled={pending} className={btn.secondary}>
                Cancel
              </button>
              <button type="button" onClick={save} disabled={!changed || !draft.length || pending} className={btn.primary}>
                {pending && <Loader2 aria-hidden className="size-4 animate-spin" />}
                {!draft.length ? "Choose a role" : changed ? "Save roles" : "No change to save"}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </span>
  );
}
