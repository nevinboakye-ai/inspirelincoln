"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, m } from "motion/react";
import { MessageCircle, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { UnreadSummary } from "@/lib/messages";

type Ctx = {
  /** Conversations with unread messages. */
  unread: number;
  /** Bumps whenever something changed, so the inbox can refetch straight away. */
  version: number;
  /** Ask for a fresh count now, for example after reading or sending. */
  refresh: () => void;
};

const MessagesContext = createContext<Ctx>({ unread: 0, version: 0, refresh: () => {} });
export const useMessages = () => useContext(MessagesContext);

const VISIBLE = 60_000;
const HIDDEN = 120_000;

/**
 * Keeps the unread count for the menu badge, and shows a small pop-up when a
 * new message arrives on any My Hub or committee page (but not while you're
 * already in that conversation). Polls gently: often while the page is in
 * front, rarely when it isn't, and backs off if the network fails.
 */
export function MessagesProvider({ children }: { children: ReactNode }) {
  const path = usePathname();
  const [summary, setSummary] = useState<UnreadSummary>({ conversations: 0, latest: null });
  const [version, setVersion] = useState(0);
  const [popup, setPopup] = useState<UnreadSummary["latest"]>(null);
  const seen = useRef<string | null | undefined>(undefined);
  const pathRef = useRef(path);
  useEffect(() => {
    pathRef.current = path;
  }, [path]);
  const kick = useRef<() => void>(() => {});

  useEffect(() => {
    let timer: number | undefined;
    let stopped = false;
    let failures = 0;
    const poll = async () => {
      try {
        const res = await fetch("/api/messages/unread", { cache: "no-store" });
        if (res.ok) {
          failures = 0;
          const data = (await res.json()) as UnreadSummary;
          setSummary((prev) => (prev.conversations === data.conversations && prev.latest?.id === data.latest?.id ? prev : data));
          const id = data.latest?.id ?? null;
          // The first answer only sets the baseline: no pop-up for messages that were already waiting.
          if (seen.current !== undefined && id && id !== seen.current) {
            setVersion((v) => v + 1);
            const here = pathRef.current === `/portal/messages/${data.latest!.conversation}`;
            if (!here) setPopup(data.latest);
          }
          seen.current = id;
        } else if (res.status === 401) {
          stopped = true;
          return;
        } else failures++;
      } catch {
        failures++;
      }
      if (stopped) return;
      const base = document.visibilityState === "visible" ? VISIBLE : HIDDEN;
      timer = window.setTimeout(poll, Math.min(base * 2 ** failures, 300_000));
    };
    const now = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(poll, 50);
    };
    kick.current = now;
    timer = window.setTimeout(poll, 400);
    const wake = () => document.visibilityState === "visible" && now();
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
    };
  }, []);


  useEffect(() => {
    if (!popup) return;
    const t = window.setTimeout(() => setPopup(null), 9000);
    return () => window.clearTimeout(t);
  }, [popup]);

  // Opening the conversation the pop-up is about hides it.
  const showing = popup && path !== `/portal/messages/${popup.conversation}` ? popup : null;
  const refresh = useCallback(() => kick.current(), []);
  const value = useMemo(() => ({ unread: summary.conversations, version, refresh }), [summary.conversations, version, refresh]);

  return (
    <MessagesContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-[60] flex justify-center px-3 lg:inset-x-auto lg:bottom-6 lg:right-6 lg:justify-end">
        <AnimatePresence>
          {showing && (
            <m.div
              key={showing.id}
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className="pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-2xl bg-midnight text-paper shadow-[0_24px_60px_-20px_rgba(12,24,44,0.8)] ring-1 ring-gold/30"
            >
              <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-gold" />
              <Link href={`/portal/messages/${showing.conversation}`} onClick={() => setPopup(null)} className="flex items-start gap-3 py-3.5 pl-5 pr-12">
                <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-gold/15 text-gold">
                  <MessageCircle aria-hidden className="size-[1.1rem]" />
                </span>
                <span className="min-w-0">
                  <span className="block font-ui text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-gold">New message</span>
                  <span className="block truncate font-semibold">{showing.name}</span>
                  <span className="line-clamp-2 text-sm text-paper/75">{showing.body}</span>
                </span>
              </Link>
              <button type="button" onClick={() => setPopup(null)} aria-label="Dismiss" className="absolute right-1.5 top-1.5 grid size-10 place-items-center rounded-full text-paper/60 hover:text-paper">
                <X aria-hidden className="size-4" />
              </button>
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </MessagesContext.Provider>
  );
}
