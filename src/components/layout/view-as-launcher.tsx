"use client";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { ArrowRight, Eye, Loader2, Search, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { startViewAs } from "@/app/admin/view-as/actions";
import { ACCOUNT_STATUS_LABEL, ACCOUNT_TYPE_LABEL, ROLE_RANK } from "@/lib/accounts";
import { hasSessionCookie } from "@/lib/supabase/session-hint";
import { cn } from "@/lib/cn";
import type { AccountStatus, AccountType } from "@/lib/types";

type Person = { id: string; name: string; email: string; types: AccountType[]; status: AccountStatus; institution: string | null };
type Load = { state: "idle" | "loading" | "ready" | "error" | "off"; people: Person[] };

/** Fired by the "Viewing as" bar to switch to someone else. */
export const OPEN_VIEW_AS = "inspire:view-as-open";

let ownerCheck: Promise<{ owner: boolean; available?: boolean }> | null = null;
const checkOwner = () =>
  (ownerCheck ??= fetch("/api/view-as", { credentials: "same-origin" })
    .then((r) => (r.ok ? r.json() : { owner: false }))
    .catch(() => ({ owner: false })));

const viewing = () => /(?:^|;\s*)inspire_view_as_who=/.test(document.cookie);
const initials = (n: string) =>
  n
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
const LIMIT = 80;

/**
 * Site owner only: a floating eye in the bottom left of every page. It opens a
 * search over every account, and picking one starts "View as" for them. The
 * button hides while already viewing as someone; the "Viewing as" bar has a
 * Switch button that opens the same overlay. The server checks again.
 */
export function ViewAsLauncher() {
  const path = usePathname();
  const reduce = useReducedMotion();
  const [owner, setOwner] = useState(false);
  const [isViewing, setIsViewing] = useState(false);
  const [open, setOpen] = useState(false);
  const [load, setLoad] = useState<Load>({ state: "idle", people: [] });
  const [q, setQ] = useState("");
  const [type, setType] = useState<AccountType | "all">("all");
  const dialog = useRef<HTMLDialogElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!hasSessionCookie()) return;
    let live = true;
    checkOwner().then((r) => {
      if (!live) return;
      setOwner(Boolean(r.owner));
    });
    return () => {
      live = false;
    };
  }, []);

  // Other bottom-left shortcuts move over to make room for the eye.
  useEffect(() => {
    setIsViewing(viewing());
    const show = owner && !viewing();
    document.documentElement.toggleAttribute("data-view-as-launcher", show);
    return () => document.documentElement.removeAttribute("data-view-as-launcher");
  }, [owner, path]);

  const loading = useRef(false);
  const fetchPeople = () => {
    if (loading.current) return;
    loading.current = true;
    setLoad((l) => ({ ...l, state: "loading" }));
    fetch("/api/view-as?people=1", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((r: { owner: boolean; available?: boolean; people?: Person[]; error?: boolean }) => {
        if (r.available === false) return setLoad({ state: "off", people: [] });
        if (!r.owner || r.error || !r.people) return setLoad({ state: "error", people: [] });
        setLoad({ state: "ready", people: r.people });
      })
      .catch(() => setLoad({ state: "error", people: [] }))
      .finally(() => {
        loading.current = false;
      });
  };
  const show = () => {
    setOpen(true);
    if (load.state === "idle" || load.state === "error") fetchPeople();
  };
  const showRef = useRef(show);
  useEffect(() => {
    showRef.current = show;
  });

  useEffect(() => {
    const onOpen = () => showRef.current();
    window.addEventListener(OPEN_VIEW_AS, onOpen);
    return () => window.removeEventListener(OPEN_VIEW_AS, onOpen);
  }, []);

  // Leaving the page closes the overlay.
  const [shownOn, setShownOn] = useState(path);
  if (shownOn !== path) {
    setShownOn(path);
    setOpen(false);
  }

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      requestAnimationFrame(() => search.current?.focus());
    } else if (!open && d.open) {
      d.close();
    }
  }, [open]);

  const typesPresent = useMemo(() => ROLE_RANK.filter((t) => load.people.some((p) => p.types.includes(t))), [load.people]);
  const matches = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return load.people.filter(
      (p) => (type === "all" || p.types.includes(type)) && words.every((w) => `${p.name} ${p.email} ${p.institution ?? ""}`.toLowerCase().includes(w)),
    );
  }, [load.people, q, type]);

  if (!owner) return null;

  const close = () => {
    setOpen(false);
    button.current?.focus();
  };

  return (
    <>
      {!isViewing && (
        <m.button
          ref={button}
          type="button"
          onClick={show}
          aria-haspopup="dialog"
          aria-label="View as someone"
          title="View as someone"
          initial={reduce ? false : { opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={reduce ? undefined : { y: -2 }}
          whileTap={reduce ? undefined : { scale: 0.94 }}
          className="group fixed bottom-[calc(env(safe-area-inset-bottom)+5rem)] left-4 z-40 grid size-12 place-items-center rounded-full bg-midnight text-cyan shadow-[0_12px_30px_-10px_rgba(12,24,44,0.75)] ring-1 ring-cyan/40 transition-colors hover:text-paper hover:ring-cyan focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric-600 lg:bottom-6 lg:left-6"
        >
          <Eye aria-hidden className="size-5" />
        </m.button>
      )}

      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        aria-describedby={descId}
        onClose={() => setOpen(false)}
        onClick={(e) => e.target === e.currentTarget && close()}
        className="m-0 h-[100dvh] max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-midnight/60 backdrop:backdrop-blur-sm sm:m-auto sm:h-auto sm:max-h-[min(44rem,88dvh)] sm:max-w-2xl sm:rounded-2xl"
      >
        <AnimatePresence>
          {open && (
            <m.div
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex h-full max-h-[inherit] flex-col overflow-hidden bg-white sm:rounded-2xl sm:shadow-[0_30px_80px_-30px_rgba(12,24,44,0.7)]"
            >
              <header className="relative overflow-hidden bg-midnight px-5 pb-5 pt-[max(1.25rem,env(safe-area-inset-top))] text-paper sm:px-6">
                <div aria-hidden className="lanyard-grid pointer-events-none absolute inset-0 opacity-20" />
                <div className="relative flex items-start gap-3">
                  <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-cyan/15 text-cyan">
                    <Eye className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 id={titleId} className="font-display text-2xl leading-tight">View as someone</h2>
                    <p id={descId} className="mt-1 text-sm text-paper/75">
                      See the site exactly as they do. It&apos;s read only, ends after an hour, and is recorded in the audit log.
                    </p>
                  </div>
                  <button type="button" onClick={close} className="-mr-2 -mt-1 grid size-11 shrink-0 place-items-center rounded-full text-paper/80 hover:bg-white/10 hover:text-paper" aria-label="Close">
                    <X aria-hidden className="size-5" />
                  </button>
                </div>
                {load.state !== "off" && (
                  <div className="relative mt-4">
                    <label htmlFor={`${titleId}-q`} className="sr-only">Search by name, email or university</label>
                    <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate" />
                    <input
                      ref={search}
                      id={`${titleId}-q`}
                      type="search"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Search by name, email or university"
                      autoComplete="off"
                      className="min-h-12 w-full rounded-lg border-0 bg-white pl-10 pr-3 text-base text-ink placeholder:text-slate focus:outline-2 focus:outline-offset-2 focus:outline-cyan"
                    />
                  </div>
                )}
              </header>

              {load.state === "ready" && typesPresent.length > 1 && (
                <div role="group" aria-label="Show only" className="flex gap-2 overflow-x-auto border-b border-navy/10 px-5 py-3 [scrollbar-width:none] sm:px-6">
                  {(["all", ...typesPresent] as const).map((t) => {
                    const n = t === "all" ? load.people.length : load.people.filter((p) => p.types.includes(t)).length;
                    return (
                      <button
                        key={t}
                        type="button"
                        aria-pressed={type === t}
                        onClick={() => setType(t)}
                        className={cn(
                          "inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors",
                          type === t ? "border-navy bg-navy text-paper" : "border-navy/15 bg-white text-ink hover:border-navy/40",
                        )}
                      >
                        {t === "all" ? "Everyone" : ACCOUNT_TYPE_LABEL[t]}
                        <span className={cn("text-xs", type === t ? "text-paper/75" : "text-slate")}>{n}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                {load.state === "loading" || load.state === "idle" ? (
                  <p role="status" className="flex items-center gap-2 px-6 py-10 text-sm text-slate-700">
                    <Loader2 aria-hidden className="size-4 animate-spin" /> Loading accounts…
                  </p>
                ) : load.state === "off" ? (
                  <p className="m-5 rounded-xl border border-warning/30 bg-warning/[0.06] p-4 text-sm text-ink sm:m-6">
                    To switch this on, add <code>SUPABASE_SERVICE_ROLE_KEY</code> in Vercel (Settings, Environment Variables), then redeploy. You&apos;ll find the key in Supabase under Project Settings, API keys. Never paste it anywhere else.
                  </p>
                ) : load.state === "error" ? (
                  <div role="alert" className="m-5 rounded-xl border border-danger/30 bg-danger/[0.05] p-4 text-sm text-ink sm:m-6">
                    Couldn&apos;t load accounts.{" "}
                    <button type="button" onClick={fetchPeople} className="font-semibold text-electric-600 underline underline-offset-2">
                      Try again
                    </button>
                  </div>
                ) : (
                  <form action={startViewAs}>
                    <input type="hidden" name="back" value={path} />
                    <p aria-live="polite" className="px-5 pt-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate sm:px-6">
                      {matches.length ? `${matches.length} ${matches.length === 1 ? "account" : "accounts"}` : "No accounts match"}
                      {matches.length > LIMIT && `, showing the first ${LIMIT}. Type to narrow it down.`}
                    </p>
                    <ul className="px-2 pb-3 pt-2 sm:px-3">
                      {matches.slice(0, LIMIT).map((p) => (
                        <li key={p.id}>
                          <PersonRow person={p} />
                        </li>
                      ))}
                    </ul>
                  </form>
                )}
              </div>
            </m.div>
          )}
        </AnimatePresence>
      </dialog>
    </>
  );
}

function PersonRow({ person: p }: { person: Person }) {
  const { pending, data } = useFormStatus();
  const mine = pending && data?.get("id") === p.id;
  const roles = ROLE_RANK.filter((t) => p.types.includes(t)).map((t) => ACCOUNT_TYPE_LABEL[t]);
  return (
    <button
      type="submit"
      name="id"
      value={p.id}
      disabled={pending}
      className="group flex min-h-16 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-paper focus-visible:bg-paper focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-electric-600 disabled:cursor-wait"
    >
      <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-navy/[0.07] font-ui text-sm font-semibold text-navy">
        {initials(p.name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-ink">{p.name}</span>
        <span className="block truncate text-sm text-slate-700">
          {roles.join(" · ")}
          {p.status !== "approved" && ` · ${ACCOUNT_STATUS_LABEL[p.status]?.label ?? p.status}`}
          {p.institution && ` · ${p.institution}`}
        </span>
      </span>
      {mine ? (
        <Loader2 aria-label="Opening their view" className="size-5 shrink-0 animate-spin text-navy" />
      ) : (
        <ArrowRight aria-hidden className="size-5 shrink-0 text-slate transition-transform group-hover:translate-x-0.5 group-hover:text-navy" />
      )}
    </button>
  );
}
