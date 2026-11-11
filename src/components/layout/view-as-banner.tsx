"use client";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { Eye, Info, X } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { OPEN_VIEW_AS } from "./view-as-launcher";

const WHO = "inspire_view_as_who";

type Who = { label: string; until: number; id: string };

function readWho(): Who | null {
  const raw = document.cookie.split("; ").find((c) => c.startsWith(`${WHO}=`));
  if (!raw) return null;
  try {
    const w = JSON.parse(decodeURIComponent(decodeURIComponent(raw.slice(WHO.length + 1)))) as Who;
    return w.until * 1000 > Date.now() ? w : null;
  } catch {
    return null;
  }
}

const NOTES: Record<string, { title: string; body: string }> = {
  readonly: { title: "Nothing was saved", body: "View as is read only, so changes and uploads are switched off." },
  nokey: { title: "View as isn't set up yet", body: "Add SUPABASE_SERVICE_ROLE_KEY in Vercel, then redeploy." },
  failed: { title: "Couldn't open their view", body: "Please try again. If it keeps happening, check their account has a confirmed email." },
  owner: { title: "That's a site owner account", body: "View as works for every account except site owners." },
  missing: { title: "That account no longer exists", body: "It may have been deleted." },
};

/**
 * Shown on every page while the site owner is viewing as someone: who, for
 * how long, and a button to stop. Also explains why a save didn't happen.
 */
export function ViewAsBanner() {
  const path = usePathname();
  const params = useSearchParams();
  const flagParam = params.get("viewas");
  const reduce = useReducedMotion();
  const [who, setWho] = useState<Who | null>(null);
  const [note, setNote] = useState<keyof typeof NOTES | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setWho(readWho());
    const flag = new URLSearchParams(window.location.search).get("viewas");
    if (flag && flag in NOTES) {
      setNote(flag);
      const url = new URL(window.location.href);
      url.searchParams.delete("viewas");
      window.history.replaceState(window.history.state, "", url);
    }
  }, [path, flagParam]);

  useEffect(() => {
    if (!who) return;
    const t = window.setInterval(() => {
      setNow(Date.now());
      if (who.until * 1000 <= Date.now()) window.location.reload();
    }, 30_000);
    return () => window.clearInterval(t);
  }, [who]);

  // Keep the bar from covering the end of the page.
  useEffect(() => {
    document.body.style.paddingBottom = who ? "6.5rem" : "";
    return () => {
      document.body.style.paddingBottom = "";
    };
  }, [who]);

  const mins = who ? Math.max(1, Math.round((who.until * 1000 - now) / 60_000)) : 0;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[90] flex flex-col items-center gap-2 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <AnimatePresence>
        {note && (
          <m.div
            key="note"
            role="status"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
            className="pointer-events-auto flex w-full max-w-xl items-start gap-3 rounded-xl border border-navy/15 bg-white p-4 text-sm text-ink shadow-[0_18px_40px_-20px_rgba(12,24,44,0.55)]"
          >
            <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-electric-600" />
            <p className="min-w-0 flex-1">
              <strong className="block">{NOTES[note].title}</strong>
              <span className="text-slate-700">{NOTES[note].body}</span>
            </p>
            <button type="button" onClick={() => setNote(null)} className="-m-2 grid size-10 shrink-0 place-items-center rounded-full text-slate hover:text-ink" aria-label="Dismiss">
              <X aria-hidden className="size-4" />
            </button>
          </m.div>
        )}
        {who && (
          <m.section
            key="who"
            aria-label="Viewing as someone else"
            initial={reduce ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
            className="pointer-events-auto flex w-full max-w-xl flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-midnight px-4 py-3 text-paper shadow-[0_18px_40px_-16px_rgba(12,24,44,0.8)] ring-1 ring-cyan/40"
          >
            <span className="relative grid size-9 shrink-0 place-items-center rounded-full bg-cyan/15 text-cyan">
              <Eye aria-hidden className="size-4" />
              {!reduce && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-cyan/20 [animation-duration:2.4s]" />}
            </span>
            <p className="min-w-0 flex-1 text-sm leading-snug">
              <span className="block truncate font-semibold">Viewing as {who.label}</span>
              <span className="text-paper/70">Read only · ends in about {mins} min</span>
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.dispatchEvent(new Event(OPEN_VIEW_AS))}
                aria-haspopup="dialog"
                className="min-h-11 rounded-[3px] border border-cyan/50 px-4 font-ui text-sm font-semibold text-paper hover:border-cyan"
              >
                Switch
              </button>
              <form action="/view-as/stop" method="post">
                <button className="min-h-11 rounded-[3px] bg-cyan px-4 font-ui text-sm font-semibold text-midnight hover:bg-cyan/90">Stop viewing</button>
              </form>
            </div>
          </m.section>
        )}
      </AnimatePresence>
    </div>
  );
}
