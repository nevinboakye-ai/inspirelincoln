"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarCog, ClipboardCheck, Eye, FileStack, Gauge, HelpCircle, Inbox, Mail, MapPin, Megaphone, Mic, QrCode, ScrollText, Settings2,
  Ticket, UserCheck, CalendarCheck2, Users, Wrench, DoorOpen, ShieldCheck, UserRound, LayoutDashboard, Activity, BarChart3,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { Access, Capability } from "@/lib/accounts";

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
    ],
  },
  {
    title: "People",
    links: [
      { href: "/admin/accounts", label: "Accounts", icon: UserCheck, need: "review_accounts" },
      { href: "/admin/attendance", label: "Presenter attendance", icon: CalendarCheck2, need: "review_accounts" },
      { href: "/admin/submissions", label: "Slides and posters", icon: FileStack, need: "review_submissions" },
      { href: "/admin/enquiries", label: "Enquiries", icon: Inbox, need: ["answer_enquiries", "manage_people"] },
      { href: "/admin/email", label: "Group email", icon: Mail, need: "send_email" },
    ],
  },
  {
    title: "Website",
    links: [
      { href: "/admin/content/committee", label: "Committee profiles", icon: Users, need: "edit_website" },
      { href: "/admin/content/sessions", label: "Programme", icon: CalendarCog, need: "edit_website" },
      { href: "/admin/content/announcements", label: "Announcements", icon: Megaphone, need: "edit_website" },
      { href: "/admin/content/speakers", label: "Speakers", icon: Mic, need: "edit_website" },
      { href: "/admin/content/workshops", label: "Workshops", icon: Wrench, need: "edit_website" },
      { href: "/admin/content/map", label: "Campus map", icon: MapPin, need: "edit_website" },
      { href: "/admin/content/rooms", label: "Rooms", icon: DoorOpen, need: "edit_website" },
      { href: "/admin/content/faqs", label: "FAQs", icon: HelpCircle, need: "edit_website" },
      { href: "/admin/settings", label: "Conference settings", icon: Settings2, need: "edit_website" },
    ],
  },
  {
    title: "Records",
    links: [
      { href: "/admin/registrations", label: "Registrations", icon: Ticket, need: "manage_people" },
      { href: "/admin/abstracts", label: "Abstracts", icon: ClipboardCheck, need: "manage_people" },
      { href: "/admin/users", label: "Site roles", icon: ShieldCheck, need: "owner" },
      { href: "/admin/audit", label: "Audit log", icon: ScrollText, need: "manage_people" },
    ],
  },
];

export function AdminNav({ access, name, position, waiting = 0 }: { access: Access; name: string; position: string; waiting?: number }) {
  const path = usePathname();
  const allowed = (l: LinkDef) =>
    !l.need || access.owner || (l.need !== "owner" && (Array.isArray(l.need) ? l.need : [l.need]).some((c) => access.can[c]));
  // The most specific link that matches the page is the current one.
  const current = GROUPS.flatMap((g) => g.links)
    .filter((l) => (l.href === "/admin" ? path === "/admin" : path === l.href || path.startsWith(`${l.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <nav aria-label="Committee dashboard" className="min-w-0 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-navy text-cyan">
          <UserRound aria-hidden className="size-5" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-ink">{name}</span>
          <span className="block truncate text-xs text-slate">{position}</span>
        </span>
      </div>
      <div className="-mx-4 flex gap-6 overflow-x-auto px-4 pb-2 lg:mx-0 lg:block lg:space-y-6 lg:overflow-visible lg:px-0">
        {GROUPS.map((g) => {
          const links = g.links.filter(allowed);
          if (!links.length) return null;
          return (
            <div key={g.title} className="shrink-0">
              <p className="mb-1 px-3 font-ui text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate">{g.title}</p>
              <ul className="flex gap-1 lg:flex-col">
                {links.map((l) => {
                  const active = l.href === current;
                  return (
                    <li key={l.href} className="shrink-0">
                      <Link
                        href={l.href}
                        aria-current={active ? "page" : undefined}
                        className={cn("flex min-h-11 items-center gap-2.5 whitespace-nowrap rounded-[3px] px-3 text-sm font-medium", active ? "bg-navy text-paper" : "text-slate-700 hover:bg-paper-200")}
                      >
                        <l.icon aria-hidden className="size-4" /> {l.label}
                        {l.href === "/admin/enquiries" && waiting > 0 && (
                          <span className={cn("ml-auto grid min-w-5 place-items-center rounded-full px-1.5 text-[0.7rem] font-bold leading-5", active ? "bg-gold text-midnight" : "bg-warning text-white")}>
                            {waiting}
                            <span className="sr-only"> waiting for a reply</span>
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
        <div className="shrink-0 border-navy/10 lg:border-t lg:pt-4">
          <Link href="/portal" className="flex min-h-11 items-center gap-2.5 whitespace-nowrap rounded-[3px] px-3 text-sm font-medium text-slate-700 hover:bg-paper-200">
            <UserRound aria-hidden className="size-4" /> My account
          </Link>
          <Link href="/" className="flex min-h-11 items-center gap-2.5 whitespace-nowrap rounded-[3px] px-3 text-sm font-medium text-slate-700 hover:bg-paper-200">
            <Eye aria-hidden className="size-4" /> View the website
          </Link>
        </div>
      </div>
    </nav>
  );
}
