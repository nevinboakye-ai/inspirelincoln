"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { hasSessionCookie } from "@/lib/supabase/session-hint";
import { useToast } from "@/components/ui/toast";
import { viewingAs } from "@/lib/view-as-client";

const STORAGE_KEY = "inspire-agenda-v1";

interface AgendaState {
  sessions: Set<string>;
  workshops: Set<string>;
  signedIn: boolean;
  ready: boolean;
  toggleSession: (id: string, title?: string) => void;
  toggleWorkshop: (id: string, title?: string) => void;
}

const AgendaContext = createContext<AgendaState | null>(null);

function readLocal(): { sessions: string[]; workshops: string[] } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { sessions: [], workshops: [] };
    const parsed = JSON.parse(raw);
    return {
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions.filter((x: unknown) => typeof x === "string") : [],
      workshops: Array.isArray(parsed.workshops) ? parsed.workshops.filter((x: unknown) => typeof x === "string") : [],
    };
  } catch {
    return { sessions: [], workshops: [] };
  }
}

function writeLocal(sessions: Set<string>, workshops: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessions: [...sessions], workshops: [...workshops] }));
  } catch {
    // Storage may be unavailable (private mode); the agenda still works for this visit.
  }
}

const isUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);

/** The sign-in library is only downloaded for people who are signed in. */
const loadClient = () => import("@/lib/supabase/client").then((m) => m.getBrowserClient());

/**
 * Personal agenda. Guests keep their agenda in this browser. Signed-in
 * delegates have it stored in Supabase (agenda_items / saved_workshops,
 * protected by RLS) and any guest selections are merged in on sign-in.
 */
export function AgendaProvider({ children }: { children: React.ReactNode }) {
  const [sessions, setSessions] = useState<Set<string>>(new Set());
  const [workshops, setWorkshops] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const toast = useToast();

  // Re-checked on each navigation, so signing in or out elsewhere is picked up.
  const path = usePathname();
  const [hasSession, setHasSession] = useState(false);
  useEffect(() => setHasSession(hasSessionCookie()), [path]);

  useEffect(() => {
    const local = readLocal();
    setSessions(new Set(local.sessions));
    setWorkshops(new Set(local.workshops));
    if (!hasSession) {
      setUserId(null);
      setReady(true);
      return;
    }
    let cancelled = false;
    if (viewingAs()) {
      // Show the agenda of the person being viewed, without touching this browser's own.
      fetch("/api/me/agenda", { credentials: "same-origin" })
        .then((r) => (r.ok ? r.json() : { sessions: [], workshops: [] }))
        .then((d: { sessions: string[]; workshops: string[] }) => {
          if (cancelled) return;
          setSessions(new Set(d.sessions));
          setWorkshops(new Set(d.workshops));
          setUserId("view-as");
          setReady(true);
        })
        .catch(() => setReady(true));
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      const db = await loadClient();
      if (!db || cancelled) {
        setReady(true);
        return;
      }
      const { data } = await db.auth.getUser();
      const uid = data.user?.id ?? null;
      if (!uid || cancelled) {
        setReady(true);
        return;
      }
      setUserId(uid);
      // Merge guest selections into the account.
      const localSessions = local.sessions.filter(isUuid);
      const localWorkshops = local.workshops.filter(isUuid);
      if (localSessions.length) {
        await db.from("agenda_items").upsert(localSessions.map((session_id) => ({ user_id: uid, session_id })), { ignoreDuplicates: true });
      }
      if (localWorkshops.length) {
        await db.from("saved_workshops").upsert(localWorkshops.map((workshop_id) => ({ user_id: uid, workshop_id })), { ignoreDuplicates: true });
      }
      const [{ data: a }, { data: w }] = await Promise.all([
        db.from("agenda_items").select("session_id"),
        db.from("saved_workshops").select("workshop_id"),
      ]);
      if (cancelled) return;
      const s = new Set<string>((a ?? []).map((r: { session_id: string }) => r.session_id));
      const ws = new Set<string>((w ?? []).map((r: { workshop_id: string }) => r.workshop_id));
      setSessions(s);
      setWorkshops(ws);
      writeLocal(s, ws);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [hasSession]);

  const persist = useCallback(
    async (table: "agenda_items" | "saved_workshops", column: "session_id" | "workshop_id", id: string, add: boolean) => {
      if (!userId || !isUuid(id)) return true;
      const db = await loadClient();
      if (!db) return true;
      const res = add
        ? await db.from(table).upsert({ user_id: userId, [column]: id }, { ignoreDuplicates: true })
        : await db.from(table).delete().eq("user_id", userId).eq(column, id);
      return !res.error;
    },
    [userId],
  );

  const toggleSession = useCallback(
    (id: string, title?: string) => {
      if (viewingAs()) {
        toast({ tone: "info", title: "Read only", body: "You're viewing as someone else, so their agenda can't be changed." });
        return;
      }
      const add = !sessions.has(id);
      const next = new Set(sessions);
      if (add) next.add(id);
      else next.delete(id);
      setSessions(next);
      writeLocal(next, workshops);
      void persist("agenda_items", "session_id", id, add).then((ok) => {
        if (!ok) toast({ tone: "error", title: "Couldn't sync your agenda", body: "Your change is saved in this browser." });
      });
      toast({
        tone: add ? "success" : "info",
        title: add ? "Added to your agenda" : "Removed from your agenda",
        body: title,
      });
    },
    [sessions, workshops, persist, toast],
  );

  const toggleWorkshop = useCallback(
    (id: string, title?: string) => {
      if (viewingAs()) {
        toast({ tone: "info", title: "Read only", body: "You're viewing as someone else, so their agenda can't be changed." });
        return;
      }
      const add = !workshops.has(id);
      const next = new Set(workshops);
      if (add) next.add(id);
      else next.delete(id);
      setWorkshops(next);
      writeLocal(sessions, next);
      void persist("saved_workshops", "workshop_id", id, add);
      toast({ tone: add ? "success" : "info", title: add ? "Workshop saved" : "Workshop removed", body: title });
    },
    [sessions, workshops, persist, toast],
  );

  const value = useMemo(
    () => ({ sessions, workshops, signedIn: Boolean(userId), ready, toggleSession, toggleWorkshop }),
    [sessions, workshops, userId, ready, toggleSession, toggleWorkshop],
  );
  return <AgendaContext.Provider value={value}>{children}</AgendaContext.Provider>;
}

export function useAgenda() {
  const ctx = useContext(AgendaContext);
  if (!ctx) throw new Error("useAgenda must be used inside AgendaProvider");
  return ctx;
}
