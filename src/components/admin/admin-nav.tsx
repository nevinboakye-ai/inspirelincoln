"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CalendarCog, ClipboardCheck, Eye, FileStack, Gauge, HelpCircle, Inbox, Mail, MapPin, Megaphone, Mic, QrCode, ScrollText, Settings2,
  Ticket, UserCheck, MessageCircle, BellRing, GraduationCap, ListOrdered, CalendarCheck2, Users, Wrench, DoorOpen, Trophy, ShieldCheck, UserRound, LayoutDashboard, Activity, BarChart3, HandHeart, Car, FileDown, LayoutGrid, X, History,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { Access, Capability } from "@/lib/accounts";
import { useMessages } from "@/components/messages/messages-provider";
import { lockScroll } from "@/lib/scroll-lock";

type Need = Capability | Capability[] | "owner";
type LinkDef = { href: string; label: string; icon: typeof Gauge; need?: Need };

const GROUPS: { title: string; links: LinkDef[] }[] = [
  {
    title: "Platform",
    links: [
      { href: "/admin/platform", label: "Platform dashboard", icon: LayoutDashboard, need: "owner" },
      { href: "/admin/platform/activity", label: "Sign-in activity", icon: Activity, need: "owner" },
      { href: "/admin/platform/metrics", label: "Website metrics", icon: BarChart3, need: "owner" },
    ],
  },
  {
    title: "Today",
    links: [
      { href: "/admin", label: "Overview", icon: Gauge },
      { href: "/admin/checkin", label: "Check-in", icon: QrCode, need: ["check_in", "manage_people"] },
      { href: "/admin/on-the-day", label: "On the day", icon: BellRing, need: ["live_alerts", "day_scanner", "allocate_workshops", "check_in"] },
    ],
  },
  {
    title: "People",
    links: [
      { href: "/admin/accounts", label: "Accounts", icon: UserCheck, need: "review_accounts" },
      { href: "/admin/attendance", label: "Presenter attendance", icon: CalendarCheck2, need: ["view_attendance", "review_accounts"] },
      { href: "/admin/travel", label: "Travel and parking", icon: Car, need: "view_travel" },
      { href: "/admin/workshops", label: "Workshop places", icon: ListOrdered, need: "allocate_workshops" },
      { href: "/admin/submissions", label: "Slides and posters", icon: FileStack, need: "review_submissions" },
      { href: "/admin/judging", label: "Judging", icon: Trophy, need: "manage_judging" },
      { href: "/admin/enquiries", label: "Enquiries", icon: Inbox, need: ["answer_enquiries", "manage_people"] },
      { href: "/admin/email", label: "Group email", icon: Mail, need: "send_email" },
      { href: "/portal/messages", label: "Messages", icon: MessageCircle, need: "message_people" },
    ],
  },
  {
    title: "Website",
    links: [
      { href: "/admin/content/committee", label: "Committee profiles", icon: Users, need: "edit_committee" },
      { href: "/admin/content/sessions", label: "Programme", icon: CalendarCog, need: "edit_programme" },
      { href: "/admin/content/announcements", label: "Announcements", icon: Megaphone, need: "edit_announcements" },
      { href: "/admin/content/speakers", label: "Speakers", icon: Mic, need: "edit_speakers" },
      { href: "/admin/content/workshops", label: "Workshops", icon: Wrench, need: "edit_workshops" },
      { href: "/admin/content/map", label: "Campus map", icon: MapPin, need: "edit_map" },
      { href: "/admin/content/rooms", label: "Rooms", icon: DoorOpen, need: "edit_programme" },
      { href: "/admin/content/universities", label: "University logos", icon: GraduationCap, need: "edit_sponsors" },
      { href: "/admin/content/sponsors", label: "Sponsors", icon: HandHeart, need: "edit_sponsors" },
      { href: "/admin/content/faqs", label: "FAQs", icon: HelpCircle, need: "edit_faqs" },
      { href: "/admin/content/timeline", label: "History timeline", icon: History, need: "edit_website" },
      { href: "/admin/settings", label: "Conference settings", icon: Settings2, need: "edit_settings" },
    ],
  },
  {
    title: "Records",
    links: [
      { href: "/admin/downloads", label: "Downloads", icon: FileDown },
      { href: "/admin/registrations", label: "Registrations", icon: Ticket, need: "manage_people" },
      { href: "/admin/abstracts", label: "Abstracts", icon: ClipboardCheck, need: "manage_people" },
      { href: "/admin/users", label: "Site roles", icon: ShieldCheck, need: "owner" },
      { href: "/admin/audit", label: "Audit log", icon: ScrollText, need: "view_audit_log" },
    ],
  },
];

export function AdminNav({ access, name, position, waiting = 0 }: { access: Access; name: string; position: string; waiting?: number }) {
  const path = usePathname();
  const { unread } = useMessages();
  const allowed = (l: LinkDef) =>
    !l.need || access.owner || (l.need !== "owner" && (Array.isArray(l.need) ? l.need : [l.need]).some((c) => access.can[c]));
  // The most specific link that matches the page is the current one.
  const current = GROUPS.flatMap((g) => g.links)
    .filter((l) => (l.href === "/admin" ? path === "/admin" : path === l.href || path.startsWith(`${l.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const release = lockScroll();
    return () => {
      document.removeEventListener("keydown", onKey);
      release();
    };
  }, [open]);
  const groups = GROUPS.map((g) => ({ ...g, links: g.links.filter(allowed) })).filter((g) => g.links.length);
  const currentLink = groups.flatMap((g) => g.links).find((l) => l.href === current);
  const CurrentIcon = currentLink?.icon ?? Gauge;
  const badge = (l: LinkDef, active: boolean) =>
    l.href === "/portal/messages" ? (
      unread > 0 && (
        <span className={cn("ml-auto grid min-w-5 place-items-center rounded-full px-1.5 text-[0.7rem] font-bold leading-5", active ? "bg-gold text-midnight" : "bg-electric-600 text-white")}>
          {unread}
          <span className="sr-only"> {unread === 1 ? "conversation" : "conversations"} with new messages</span>
        </span>
      )
    ) :
    l.href === "/admin/enquiries" &&
    waiting > 0 && (
      <span className={cn("ml-auto grid min-w-5 place-items-center rounded-full px-1.5 text-[0.7rem] font-bold leading-5", active ? "bg-gold text-midnight" : "bg-coral text-white")}>
        {waiting}
        <span className="sr-only"> waiting for a reply</span>
      </span>
    );
  return (
    <>
      {/* Phones and tablets: one slim bar saying where you are, with every area a tap away. */}
      <div className="sticky top-[var(--header-h)] z-30 -mx-4 border-b border-navy/[0.07] bg-paper/90 px-4 py-2.5 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls="admin-sheet"
          className="tap flex min-h-12 w-full items-center gap-3 rounded-2xl bg-white px-3 text-left shadow-[var(--shadow-soft)] ring-1 ring-navy/[0.08]"
        >
          <span className="icon-chip-sm bg-navy text-gold-300">
            <CurrentIcon aria-hidden className="size-4" />
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block font-ui text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-slate">Committee dashboard</span>
            <span className="block truncate font-semibold text-ink">{currentLink?.label ?? "Overview"}</span>
          </span>
          {waiting > 0 && (
            <span className="grid min-w-5 place-items-center rounded-full bg-coral px-1.5 text-[0.7rem] font-bold leading-5 text-white">
              {waiting}
              <span className="sr-only"> enquiries waiting</span>
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-paper-200 px-3 py-1.5 font-ui text-xs font-semibold text-ink">
            <LayoutGrid aria-hidden className="size-3.5" /> Menu
          </span>
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-[70] lg:hidden" role="dialog" aria-modal="true" aria-label="Committee dashboard menu" id="admin-sheet">
          <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="sheet-fade absolute inset-0 bg-midnight/55 backdrop-blur-[2px]" />
          <nav aria-label="Committee dashboard" className="sheet-up absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-[28px] bg-paper shadow-[var(--shadow-sheet)]">
            <div className="flex shrink-0 items-center gap-3 px-5 pb-3 pt-2">
              <span aria-hidden className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-navy/15" />
              <span className="mt-4 grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-gold-300 to-gold-600 font-ui text-sm font-bold text-midnight">{initials(name)}</span>
              <span className="mt-4 min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">{name}</span>
                <span className="block truncate text-xs text-slate">{position}</span>
              </span>
              <button type="button" onClick={() => setOpen(false)} className="tap mt-4 grid size-10 place-items-center rounded-full bg-white ring-1 ring-navy/10" aria-label="Close menu">
                <X aria-hidden className="size-5" />
              </button>
            </div>
            <div className="overflow-y-auto overscroll-contain px-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
              {groups.map((g, gi) => (
                <div key={g.title} className="mb-4">
                  <p className="mb-2 px-1 font-ui text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate">{g.title}</p>
                  <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {g.links.map((l, i) => {
                      const active = l.href === current;
                      return (
                        <li key={l.href} className="pop-in" style={{ animationDelay: `${gi * 40 + i * 25}ms` }}>
                          <Link
                            href={l.href}
                            aria-current={active ? "page" : undefined}
                            className={cn(
                              "tap flex min-h-14 items-center gap-2.5 rounded-2xl p-2.5 text-[0.8rem] font-semibold leading-tight",
                              active ? "bg-navy text-paper" : "bg-white text-ink ring-1 ring-navy/[0.07]",
                            )}
                          >
                            <span className={cn("icon-chip-sm", active ? "bg-white/10 text-gold-300" : TONES[(gi + i) % TONES.length])}>
                              <l.icon aria-hidden className="size-4" />
                            </span>
                            <span className="min-w-0 flex-1">{l.label}</span>
                            {badge(l, active)}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-2 border-t border-navy/10 pt-4">
                <Link href="/portal" className="tap flex min-h-12 items-center justify-center gap-2 rounded-full bg-white text-sm font-semibold text-ink ring-1 ring-navy/10">
                  <UserRound aria-hidden className="size-4" /> My Hub
                </Link>
                <Link href="/" className="tap flex min-h-12 items-center justify-center gap-2 rounded-full bg-white text-sm font-semibold text-ink ring-1 ring-navy/10">
                  <Eye aria-hidden className="size-4" /> Website
                </Link>
              </div>
            </div>
          </nav>
        </div>
      )}

      {/* Wide screens: the full menu in a sticky side column. */}
      <nav aria-label="Committee dashboard" className="hidden min-w-0 lg:sticky lg:top-24 lg:block lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto lg:pb-6">
        <div className="mb-5 flex items-center gap-3 rounded-2xl bg-midnight p-3 text-paper">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-gold-300 to-gold-600 font-ui text-sm font-bold text-midnight">{initials(name)}</span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{name}</span>
            <span className="block truncate text-xs text-paper/65">{position}</span>
          </span>
        </div>
        <div className="space-y-5">
          {groups.map((g) => (
            <div key={g.title}>
              <p className="mb-1 px-3 font-ui text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate">{g.title}</p>
              <ul className="flex flex-col gap-0.5">
                {g.links.map((l) => {
                  const active = l.href === current;
                  return (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "tap flex min-h-10 items-center gap-2.5 whitespace-nowrap rounded-xl px-3 text-sm font-medium",
                          active ? "bg-navy text-paper shadow-[0_6px_16px_-8px_rgba(12,24,44,0.7)]" : "text-slate-700 hover:bg-white hover:text-ink",
                        )}
                      >
                        <l.icon aria-hidden className={cn("size-4", active ? "text-gold-300" : "text-electric-600")} /> {l.label}
                        {badge(l, active)}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          <div className="border-t border-navy/10 pt-4">
            <Link href="/portal" className="tap flex min-h-10 items-center gap-2.5 whitespace-nowrap rounded-xl px-3 text-sm font-medium text-slate-700 hover:bg-white">
              <UserRound aria-hidden className="size-4" /> My Hub
            </Link>
            <Link href="/" className="tap flex min-h-10 items-center gap-2.5 whitespace-nowrap rounded-xl px-3 text-sm font-medium text-slate-700 hover:bg-white">
              <Eye aria-hidden className="size-4" /> View the website
            </Link>
          </div>
        </div>
      </nav>
    </>
  );
}

const TONES = ["tone-navy", "tone-teal", "tone-sky", "tone-plum", "tone-coral", "tone-gold", "tone-rose"];

function initials(name: string) {
  const parts = name.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}
