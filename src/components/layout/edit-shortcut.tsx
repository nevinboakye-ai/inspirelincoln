"use client";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { Pencil, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { hasSessionCookie } from "@/lib/supabase/session-hint";

import type { Capability } from "@/lib/accounts";

type Target = { label: string; href: string; need: Capability };

/** Which dashboard editors change what's on each public page. */
const EDITORS: { match: (p: string) => boolean; targets: Target[] }[] = [
  { match: (p) => p === "/", targets: [{ label: "Announcements", href: "/admin/content/announcements", need: "edit_announcements" }, { label: "Programme", href: "/admin/content/sessions", need: "edit_programme" }, { label: "Speakers", href: "/admin/content/speakers", need: "edit_speakers" }, { label: "Conference settings", href: "/admin/settings", need: "edit_settings" }] },
  { match: (p) => p.startsWith("/about"), targets: [{ label: "Committee names, roles and biographies", href: "/admin/content/committee", need: "edit_committee" }, { label: "Partners", href: "/admin/content/partners", need: "edit_sponsors" }, { label: "History timeline", href: "/admin/content/timeline", need: "edit_website" }] },
  { match: (p) => p.startsWith("/programme") || p.startsWith("/today"), targets: [{ label: "Programme sessions", href: "/admin/content/sessions", need: "edit_programme" }, { label: "Rooms", href: "/admin/content/rooms", need: "edit_programme" }, { label: "Workshops", href: "/admin/content/workshops", need: "edit_workshops" }] },
  { match: (p) => p.startsWith("/workshops"), targets: [{ label: "Workshops", href: "/admin/content/workshops", need: "edit_workshops" }] },
  { match: (p) => p.startsWith("/speakers"), targets: [{ label: "Speakers", href: "/admin/content/speakers", need: "edit_speakers" }] },
  { match: (p) => p.startsWith("/map"), targets: [{ label: "Campus map places", href: "/admin/content/map", need: "edit_map" }] },
  { match: (p) => p.startsWith("/sponsors"), targets: [{ label: "Sponsors", href: "/admin/content/sponsors", need: "edit_sponsors" }] },
  { match: (p) => p.startsWith("/conference"), targets: [{ label: "FAQs", href: "/admin/content/faqs", need: "edit_faqs" }, { label: "Conference settings", href: "/admin/settings", need: "edit_settings" }] },
];

export type MyAccess = { edit: boolean; owner?: boolean; areas?: Capability[] };
let cached: Promise<MyAccess> | null = null;
/** What the signed-in person can edit, fetched once per page load. */
export const loadAccess = () =>
  (cached ??= fetch("/api/me/access", { credentials: "same-origin" })
    .then((r) => (r.ok ? r.json() : { edit: false }))
    .catch(() => ({ edit: false }))) as Promise<MyAccess>;

/**
 * A small "Edit this page" button for committee members who can edit the
 * website. Public pages stay fully cached; the check happens in the browser.
 */
export function EditShortcut() {
  const path = usePathname();
  const reduce = useReducedMotion();
  const [areas, setAreas] = useState<Capability[] | "all">([]);
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const entry = EDITORS.find((e) => e.match(path));

  useEffect(() => {
    // Only signed-in people can edit, so guests skip the check entirely.
    if (!entry || !hasSessionCookie()) return;
    let live = true;
    // Owners edit everything; a response without areas comes from an older deploy.
    loadAccess().then((a) => live && setAreas(a.owner ? "all" : (a.areas ?? (a.edit ? "all" : []))));
    return () => {
      live = false;
    };
  }, [entry]);
  // Only the parts of this page they're allowed to edit.
  const targets = entry?.targets.filter((t) => areas === "all" || areas.includes(t.need)) ?? [];
  const canEdit = targets.length > 0;

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => panel.current && !panel.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  if (!entry || !canEdit) return null;

  return (
    <div ref={panel} className="fixed bottom-[calc(env(safe-area-inset-bottom)+5rem)] left-4 z-40 lg:bottom-6 lg:left-6 [:root[data-view-as-launcher]_&]:left-[4.5rem] lg:[:root[data-view-as-launcher]_&]:left-[5rem]">
      <AnimatePresence>
        {open && (
          <m.div
            id="edit-shortcut-menu"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="mb-2 w-72 origin-bottom-left overflow-hidden rounded-xl border border-navy/10 bg-white shadow-[0_20px_50px_-20px_rgba(14,27,49,0.5)]"
          >
            <p className="border-b border-navy/10 px-4 py-3 font-ui text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate">Edit on this page</p>
            <ul>
              {targets.map((t) => (
                <li key={t.href}>
                  <Link href={t.href} className="flex min-h-12 items-center gap-2 px-4 text-sm font-medium text-ink transition-colors hover:bg-paper">
                    <Pencil aria-hidden className="size-3.5 text-slate" /> {t.label}
                  </Link>
                </li>
              ))}
            </ul>
          </m.div>
        )}
      </AnimatePresence>
      <m.button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="edit-shortcut-menu"
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={reduce ? undefined : { y: -2 }}
        whileTap={reduce ? undefined : { scale: 0.97 }}
        className="flex min-h-11 items-center gap-2 rounded-full bg-cyan px-4 font-ui text-sm font-semibold text-midnight shadow-[0_10px_30px_-12px_rgba(14,27,49,0.6)]"
      >
        {open ? <X aria-hidden className="size-4" /> : <Pencil aria-hidden className="size-4" />} {open ? "Close" : "Edit this page"}
      </m.button>
    </div>
  );
}
