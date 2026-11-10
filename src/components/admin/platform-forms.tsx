"use client";
import { useEffect, useState, useTransition } from "react";
import { m as motion } from "motion/react";
import { Check, Crown, Loader2, Minus, RotateCcw, X } from "lucide-react";
import { resetRules, setOverride, setRule } from "@/app/admin/platform/actions";
import { ACCOUNT_TYPE_LABEL, CAPABILITIES, CAPABILITY_LABEL, type Capability } from "@/lib/accounts";
import type { OverrideMode } from "@/lib/accounts/effective";
import type { AccountType } from "@/lib/types";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { btn } from "./ui";

type Rules = Record<AccountType, Record<Capability, boolean>>;

/** Warns before leaving the page while a change is still saving. */
function useSaveGuard(saving: boolean) {
  useEffect(() => {
    if (!saving) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saving]);
}

/** An on/off switch that reads as a switch to screen readers. */
function Switch({ on, onChange, label, busy }: { on: boolean; onChange: (v: boolean) => void; label: string; busy?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      aria-busy={busy || undefined}
      onClick={() => onChange(!on)}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy",
        on ? "bg-navy" : "bg-navy/15",
      )}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 600, damping: 34 }}
        className={cn("flex size-6 items-center justify-center rounded-full bg-white shadow-sm", on ? "ml-auto" : "ml-0")}
      >
        {busy ? <Loader2 aria-hidden className="size-3.5 animate-spin text-slate" /> : on ? <Check aria-hidden className="size-3.5 text-navy" /> : null}
      </motion.span>
    </button>
  );
}

/** Who can do what, by account type. Each switch saves straight away. */
export function AccessMatrix({ initial, types }: { initial: Rules; types: AccountType[] }) {
  const toast = useToast();
  const [rules, setRules] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();
  useSaveGuard(busy !== null);

  const toggle = (t: AccountType, c: Capability, allowed: boolean) => {
    const key = `${t}:${c}`;
    setRules((r) => ({ ...r, [t]: { ...r[t], [c]: allowed } }));
    setBusy(key);
    start(async () => {
      const res = await setRule({ accountType: t, capability: c, allowed });
      setBusy(null);
      if (!res.ok) {
        setRules((r) => ({ ...r, [t]: { ...r[t], [c]: !allowed } }));
        toast({ tone: "error", title: res.error ?? "Could not save that change." });
      } else {
        toast({ tone: "success", title: `${ACCOUNT_TYPE_LABEL[t]}: ${CAPABILITY_LABEL[c].label} ${allowed ? "on" : "off"}` });
      }
    });
  };

  const reset = () =>
    start(async () => {
      const res = await resetRules();
      toast({ tone: res.ok ? "success" : "error", title: res.ok ? res.message! : res.error! });
      if (res.ok) window.location.reload();
    });

  return (
    <div className="space-y-4">
      {/* Phones: one card per account type */}
      <div className="space-y-3 lg:hidden">
        {types.map((t) => (
          <details key={t} className="group rounded-xl border border-navy/10 bg-white open:shadow-sm">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 font-semibold text-ink">
              <span>{ACCOUNT_TYPE_LABEL[t]}</span>
              <span className="text-xs font-medium text-slate">
                {CAPABILITIES.filter((c) => rules[t][c]).length} of {CAPABILITIES.length}
              </span>
            </summary>
            <ul className="divide-y divide-navy/10 border-t border-navy/10">
              {CAPABILITIES.map((c) => (
                <li key={c} className="flex items-center justify-between gap-4 px-4 py-3">
                  <span className="min-w-0 text-sm">
                    <span className="block font-medium text-ink">{CAPABILITY_LABEL[c].label}</span>
                    <span className="block text-slate-700">{CAPABILITY_LABEL[c].description}</span>
                  </span>
                  <Switch on={rules[t][c]} busy={busy === `${t}:${c}`} onChange={(v) => toggle(t, c, v)} label={`${ACCOUNT_TYPE_LABEL[t]}: ${CAPABILITY_LABEL[c].label}`} />
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>

      {/* Larger screens: the full grid */}
      <div className="hidden overflow-x-auto rounded-xl border border-navy/10 bg-white lg:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Permissions by account type</caption>
          <thead className="border-b border-navy/10 bg-paper">
            <tr>
              <th scope="col" className="sticky left-0 bg-paper px-4 py-3 font-ui text-xs font-semibold uppercase tracking-wider text-slate">Permission</th>
              {types.map((t) => (
                <th key={t} scope="col" className="px-3 py-3 text-center font-ui text-xs font-semibold uppercase tracking-wider text-slate">
                  {ACCOUNT_TYPE_LABEL[t]}
                </th>
              ))}
              <th scope="col" className="px-3 py-3 text-center font-ui text-xs font-semibold uppercase tracking-wider text-navy">
                <span className="inline-flex items-center gap-1"><Crown aria-hidden className="size-3.5" /> Site owner</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy/10">
            {CAPABILITIES.map((c) => (
              <tr key={c} className="transition-colors hover:bg-paper/60">
                <th scope="row" className="sticky left-0 max-w-xs bg-white px-4 py-4 font-normal">
                  <span className="block font-semibold text-ink">{CAPABILITY_LABEL[c].label}</span>
                  <span className="block text-xs text-slate-700">{CAPABILITY_LABEL[c].description}</span>
                </th>
                {types.map((t) => (
                  <td key={t} className="px-3 py-4 text-center">
                    <Switch on={rules[t][c]} busy={busy === `${t}:${c}`} onChange={(v) => toggle(t, c, v)} label={`${ACCOUNT_TYPE_LABEL[t]}: ${CAPABILITY_LABEL[c].label}`} />
                  </td>
                ))}
                <td className="px-3 py-4 text-center">
                  <span className="inline-flex size-7 items-center justify-center rounded-full bg-navy/10 text-navy" title="Always">
                    <Check aria-hidden className="size-4" /><span className="sr-only">Always</span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-700">Permissions only apply once an account is approved. Changes take effect on the person&apos;s next page load.</p>
        <button type="button" onClick={reset} className={btn.secondary}>
          <RotateCcw aria-hidden className="size-4" /> Reset to defaults
        </button>
      </div>
    </div>
  );
}

const MODES: { value: OverrideMode; label: string; icon: typeof Check }[] = [
  { value: "inherit", label: "Default", icon: Minus },
  { value: "allow", label: "Allow", icon: Check },
  { value: "block", label: "Block", icon: X },
];

/** One person's permissions: follow their account type, or allow or block each one. */
export function PersonAccess({
  userId,
  name,
  initial,
  defaults,
}: {
  userId: string;
  name: string;
  initial: Record<Capability, OverrideMode>;
  defaults: Record<Capability, boolean>;
}) {
  const toast = useToast();
  const [modes, setModes] = useState(initial);
  const [busy, setBusy] = useState<Capability | null>(null);
  const [, start] = useTransition();
  useSaveGuard(busy !== null);

  const choose = (c: Capability, mode: OverrideMode) => {
    const prev = modes[c];
    if (prev === mode) return;
    setModes((m) => ({ ...m, [c]: mode }));
    setBusy(c);
    start(async () => {
      const res = await setOverride({ userId, capability: c, mode });
      setBusy(null);
      if (!res.ok) {
        setModes((m) => ({ ...m, [c]: prev }));
        toast({ tone: "error", title: res.error ?? "Could not save that change." });
      } else toast({ tone: "success", title: `${name}: ${CAPABILITY_LABEL[c].label} ${mode === "inherit" ? "follows their account type" : mode === "allow" ? "allowed" : "blocked"}` });
    });
  };

  return (
    <ul className="divide-y divide-navy/10 overflow-hidden rounded-xl border border-navy/10 bg-white">
      {CAPABILITIES.map((c) => {
        const mode = modes[c];
        const result = mode === "inherit" ? defaults[c] : mode === "allow";
        return (
          <li key={c} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-6 sm:p-5">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                {CAPABILITY_LABEL[c].label}
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", result ? "bg-success/10 text-success" : "bg-navy/[0.06] text-slate-700")}>
                  {result ? "Can" : "Can't"}
                </span>
                {busy === c && <Loader2 aria-hidden className="size-4 animate-spin text-slate" />}
              </p>
              <p className="text-sm text-slate-700">{CAPABILITY_LABEL[c].description}</p>
              <p className="mt-1 text-xs text-slate">Their account type default: {defaults[c] ? "allowed" : "not allowed"}</p>
            </div>
            <div role="radiogroup" aria-label={`${CAPABILITY_LABEL[c].label} for ${name}`} className="relative grid grid-cols-3 rounded-[4px] bg-paper-200 p-1">
              {MODES.map((m) => {
                const active = mode === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => choose(c, m.value)}
                    className={cn("relative flex min-h-10 items-center justify-center gap-1.5 px-3 text-sm font-semibold transition-colors", active ? "text-paper" : "text-slate-700 hover:text-ink")}
                  >
                    {active && (
                      <motion.span
                        layoutId={`mode-${c}`}
                        transition={{ type: "spring", stiffness: 500, damping: 38 }}
                        className={cn("absolute inset-0 rounded-[3px]", m.value === "block" ? "bg-danger" : "bg-navy")}
                      />
                    )}
                    <m.icon aria-hidden className="relative size-4" />
                    <span className="relative">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
