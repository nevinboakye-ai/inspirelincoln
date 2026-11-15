"use client";
import { useActionState, useEffect, useId, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { ArrowUpRight, Check, ChevronDown, Loader2, Mail, PencilLine, ShieldCheck, Trash2, UserX } from "lucide-react";
import { removeAccount, removeFromList, renamePerson, sendPersonRequest } from "@/app/admin/account-manage-actions";
import { REQUEST_ITEMS, type RequestItem } from "@/lib/accounts/requests";
import { submitWithoutReset } from "@/lib/use-action-form";
import { Field, inputClass } from "@/components/forms/field";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import type { ActionResult } from "@/app/portal/actions";

/** Who is being managed: an account, or someone on the selected list who hasn't set one up yet. */
export type ManagedPerson = {
  kind: "account" | "list";
  id: string;
  name: string;
  institution: string | null;
  yearOfStudy: string | null;
  /** Which presentation they upload, if any, so only relevant requests are offered. */
  presents?: "slides" | "poster" | "both" | null;
};

/** What the signed-in committee member may do to them. */
export type ManageRights = { rename: boolean; request: boolean; remove: boolean; accountPage: boolean; accessPage: boolean };

function Banner({ state }: { state: ActionResult }) {
  if (!state?.error) return null;
  return (
    <p role="alert" className="rounded-md border border-danger/25 bg-danger/[0.06] p-3 text-sm font-medium text-danger">
      {state.error}
    </p>
  );
}

/** Shows a toast and refreshes (or moves on) once an action succeeds. */
function useDone(state: ActionResult, then?: () => void) {
  const toast = useToast();
  useEffect(() => {
    if (state?.ok && state.message) {
      toast({ tone: "success", title: state.message });
      then?.();
    }
    // Only when a new result arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
}

function Submit({ pending, children, tone = "primary" }: { pending: boolean; children: ReactNode; tone?: "primary" | "danger" }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[3px] px-5 font-ui text-sm font-semibold transition-colors disabled:opacity-60 sm:w-auto",
        tone === "danger" ? "bg-danger text-white hover:bg-danger/90" : "bg-navy text-paper hover:bg-navy-700",
      )}
    >
      {pending && <Loader2 aria-hidden className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

/** Correct someone's name, university and year. */
export function RenamePersonForm({ person, onDone }: { person: ManagedPerson; onDone?: () => void }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(renamePerson, null);
  const uid = useId();
  useDone(state, () => {
    router.refresh();
    onDone?.();
  });
  const fe = (k: string) => state?.fieldErrors?.[k];
  return (
    <form onSubmit={submitWithoutReset(action)} noValidate className="space-y-4">
      <input type="hidden" name="kind" value={person.kind} />
      <input type="hidden" name="id" value={person.id} />
      <Banner state={state} />
      <Field id={`${uid}-name`} label="Full name" required error={fe("fullName")}>
        <input id={`${uid}-name`} name="fullName" defaultValue={person.name} autoComplete="off" className={inputClass} aria-invalid={Boolean(fe("fullName"))} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${uid}-uni`} label="University" error={fe("institution")}>
          <input id={`${uid}-uni`} name="institution" defaultValue={person.institution ?? ""} autoComplete="off" className={inputClass} />
        </Field>
        <Field id={`${uid}-year`} label="Year of study" error={fe("yearOfStudy")}>
          <input id={`${uid}-year`} name="yearOfStudy" defaultValue={person.yearOfStudy ?? ""} autoComplete="off" className={inputClass} />
        </Field>
      </div>
      <Submit pending={pending}>Save changes</Submit>
    </form>
  );
}

/** Which requests make sense for someone. */
function requestOptions(person: ManagedPerson): RequestItem[] {
  const base: RequestItem[] = person.kind === "list" ? ["sign_in"] : [];
  const presenting: RequestItem[] =
    person.presents === "both" ? ["attendance", "slides", "poster"] : person.presents === "slides" ? ["attendance", "slides"] : person.presents === "poster" ? ["attendance", "poster"] : [];
  return [...base, "details", "photo", "bio", "needs", ...presenting, "travel", "workshops"];
}

/** Ask someone to do a few things in My Hub, by a date if you like. They get a branded email with a link to each. */
export function PersonRequestForm({ person, onDone }: { person: ManagedPerson; onDone?: () => void }) {
  const [state, action, pending] = useActionState(sendPersonRequest, null);
  const uid = useId();
  const options = requestOptions(person);
  const [picked, setPicked] = useState<RequestItem[]>(person.kind === "list" ? ["sign_in"] : []);
  useDone(state, () => {
    setPicked(person.kind === "list" ? ["sign_in"] : []);
    onDone?.();
  });
  const toggle = (k: RequestItem) => setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  return (
    <form onSubmit={submitWithoutReset(action)} noValidate className="space-y-4">
      <input type="hidden" name="kind" value={person.kind} />
      <input type="hidden" name="id" value={person.id} />
      <Banner state={state} />
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink">What do you need from {person.name.split(/\s+/)[0]}?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {options.map((k) => {
            const on = picked.includes(k);
            return (
              <label
                key={k}
                className={cn(
                  "flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors",
                  on ? "border-navy bg-navy/[0.05] text-ink" : "border-navy/15 bg-white text-slate-700 hover:border-navy/35",
                )}
              >
                <input type="checkbox" name="items" value={k} checked={on} onChange={() => toggle(k)} className="sr-only" />
                <span aria-hidden className={cn("grid size-5 shrink-0 place-items-center rounded-[4px] border", on ? "border-navy bg-navy text-paper" : "border-navy/30")}>
                  {on && <Check className="size-3.5" />}
                </span>
                <span className="font-medium">{REQUEST_ITEMS[k].short}</span>
              </label>
            );
          })}
        </div>
        {state?.fieldErrors?.items && <p className="mt-2 text-sm font-medium text-danger">{state.fieldErrors.items}</p>}
      </fieldset>
      <Field id={`${uid}-deadline`} label="Deadline" hint="Shown in the email and subject line." error={state?.fieldErrors?.deadline}>
        <input id={`${uid}-deadline`} name="deadline" type="date" className={inputClass} />
      </Field>
      <Field id={`${uid}-note`} label="A note from you" error={state?.fieldErrors?.note}>
        <textarea id={`${uid}-note`} name="note" rows={3} maxLength={1500} className={inputClass} placeholder="For example: we need this for the conference booklet." />
      </Field>
      <Submit pending={pending}>
        <Mail aria-hidden className="size-4" /> Send request{picked.length ? ` (${picked.length})` : ""}
      </Submit>
      <p className="text-xs text-slate">They get a branded email from INSPIRE with a link to each step. Replies come to your email.</p>
    </form>
  );
}

/**
 * Permanently removes an account. Asks for REMOVE to be typed, and offers to
 * take them off the selected list and to let them know.
 */
export function RemoveAccountForm({ id, name, redirectTo, onDone }: { id: string; name: string; redirectTo?: string; onDone?: () => void }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(removeAccount, null);
  const [notify, setNotify] = useState(false);
  const uid = useId();
  useDone(state, () => {
    onDone?.();
    if (redirectTo) router.replace(redirectTo);
    else router.refresh();
  });
  return (
    <form onSubmit={submitWithoutReset(action)} noValidate className="space-y-4">
      <input type="hidden" name="id" value={id} />
      <Banner state={state} />
      <div className="rounded-lg border border-danger/20 bg-danger/[0.04] p-4 text-sm text-slate-700">
        <p className="font-semibold text-danger">This can&apos;t be undone.</p>
        <p className="mt-1">
          {name}&apos;s account, Delegate Card, agenda, uploaded slides, posters and photo, workshop choices, enquiries and answers are all deleted. The audit log keeps a note that you removed it.
        </p>
      </div>
      <label className="flex items-start gap-3 text-sm text-slate-700">
        <input type="checkbox" name="unlist" defaultChecked className="mt-0.5 size-5 shrink-0 accent-navy" />
        <span>
          <span className="font-semibold text-ink">Also take them off the selected delegate list</span>
          <span className="block">So their place can go to someone else. Untick if they should be able to set up a new account and be approved straight away.</span>
        </span>
      </label>
      <label className="flex items-start gap-3 text-sm text-slate-700">
        <input type="checkbox" name="notify" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-navy" />
        <span>
          <span className="font-semibold text-ink">Email them to say their account was removed</span>
        </span>
      </label>
      {notify && (
        <Field id={`${uid}-reason`} label="Note to include" error={state?.fieldErrors?.reason}>
          <textarea id={`${uid}-reason`} name="reason" rows={3} maxLength={1000} className={inputClass} placeholder="For example: as you let us know you can no longer attend." />
        </Field>
      )}
      <Field id={`${uid}-confirm`} label="Type REMOVE to confirm" required error={state?.fieldErrors?.confirm}>
        <input id={`${uid}-confirm`} name="confirm" autoComplete="off" autoCapitalize="characters" spellCheck={false} className={inputClass} aria-invalid={Boolean(state?.fieldErrors?.confirm)} />
      </Field>
      <Submit pending={pending} tone="danger">
        <Trash2 aria-hidden className="size-4" /> Remove {name.split(/\s+/)[0]}&apos;s account
      </Submit>
    </form>
  );
}

/** Takes someone who hasn't set up an account yet off the selected list. */
export function RemoveFromListForm({ id, name, onDone }: { id: string; name: string; onDone?: () => void }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(removeFromList, null);
  const uid = useId();
  useDone(state, () => {
    onDone?.();
    router.refresh();
  });
  return (
    <form onSubmit={submitWithoutReset(action)} noValidate className="space-y-4">
      <input type="hidden" name="id" value={id} />
      <Banner state={state} />
      <p className="text-sm text-slate-700">
        {name} hasn&apos;t set up an account yet. Taking them off the selected list means they won&apos;t be approved automatically if they sign up later, so their place can go to someone else.
      </p>
      <Field id={`${uid}-confirm`} label="Type REMOVE to confirm" required error={state?.fieldErrors?.confirm}>
        <input id={`${uid}-confirm`} name="confirm" autoComplete="off" autoCapitalize="characters" spellCheck={false} className={inputClass} />
      </Field>
      <Submit pending={pending} tone="danger">
        <UserX aria-hidden className="size-4" /> Take off the list
      </Submit>
    </form>
  );
}

/** A "Remove this account" panel for account pages. Collapsed until opened, so it's never pressed by accident. */
export function RemoveAccountPanel({ id, name, redirectTo }: { id: string; name: string; redirectTo: string }) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  return (
    <section aria-labelledby={`remove-${id}`} className="overflow-hidden rounded-xl border border-danger/25 bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-14 w-full items-center justify-between gap-3 px-5 text-left transition-colors hover:bg-danger/[0.03]"
      >
        <span className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-full bg-danger/10 text-danger"><Trash2 aria-hidden className="size-4" /></span>
          <span>
            <span id={`remove-${id}`} className="block font-semibold text-ink">Remove this account</span>
            <span className="block text-sm text-slate-700">Permanently delete {name}&apos;s account and everything linked to it.</span>
          </span>
        </span>
        <ChevronDown aria-hidden className={cn("size-5 shrink-0 text-slate transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <m.div
            initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="border-t border-danger/15 p-5">
              <RemoveAccountForm id={id} name={name} redirectTo={redirectTo} />
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </section>
  );
}

type Tab = "request" | "rename" | "remove";

/**
 * Committee tools for one person, shown on their delegate network profile:
 * ask them for things, correct their name, remove them. Only what the
 * signed-in person is allowed to do appears.
 */
export function ManagePerson({ person, rights, onRemoved }: { person: ManagedPerson; rights: ManageRights; onRemoved?: () => void }) {
  const tabs = (
    [
      rights.request && { key: "request" as const, label: "Request", icon: Mail },
      rights.rename && { key: "rename" as const, label: "Edit name", icon: PencilLine },
      rights.remove && { key: "remove" as const, label: "Remove", icon: Trash2 },
    ] as const
  ).filter(Boolean) as { key: Tab; label: string; icon: typeof Mail }[];
  const [tab, setTab] = useState<Tab | null>(null);
  const reduce = useReducedMotion();
  if (!tabs.length && !rights.accountPage && !rights.accessPage) return null;

  return (
    <section aria-label={`Manage ${person.name}`} className="border-t border-navy/10 bg-paper/60 px-6 py-5 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="eyebrow flex items-center gap-1.5 text-navy">
          <ShieldCheck aria-hidden className="size-4" /> Committee tools
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {rights.accountPage && (
            <Link href={person.kind === "account" ? `/admin/accounts/${person.id}` : `/admin/accounts/selected/${person.id}`} className="inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-navy underline-offset-4 hover:underline">
              Full account <ArrowUpRight aria-hidden className="size-3.5" />
            </Link>
          )}
          {rights.accessPage && person.kind === "account" && (
            <Link href={`/admin/platform/people/${person.id}`} className="inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-navy underline-offset-4 hover:underline">
              What they can access <ArrowUpRight aria-hidden className="size-3.5" />
            </Link>
          )}
        </div>
      </div>
      {tabs.length > 0 && (
        <div role="tablist" aria-label="Committee tools" className="mt-3 grid gap-1 rounded-[4px] bg-paper-200 p-1" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
          {tabs.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(active ? null : t.key)}
                className={cn(
                  "relative flex min-h-11 items-center justify-center gap-1.5 rounded-[3px] px-2 text-sm font-semibold transition-colors",
                  active ? (t.key === "remove" ? "bg-danger text-white" : "bg-navy text-paper") : "text-slate-700 hover:text-ink",
                )}
              >
                <t.icon aria-hidden className="size-4" /> {t.label}
              </button>
            );
          })}
        </div>
      )}
      <AnimatePresence mode="wait" initial={false}>
        {tab && (
          <m.div
            key={tab}
            role="tabpanel"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="mt-4"
          >
            {tab === "request" && <PersonRequestForm person={person} onDone={() => setTab(null)} />}
            {tab === "rename" && <RenamePersonForm person={person} onDone={() => setTab(null)} />}
            {tab === "remove" &&
              (person.kind === "account" ? (
                <RemoveAccountForm id={person.id} name={person.name} onDone={onRemoved} />
              ) : (
                <RemoveFromListForm id={person.id} name={person.name} onDone={onRemoved} />
              ))}
          </m.div>
        )}
      </AnimatePresence>
    </section>
  );
}
