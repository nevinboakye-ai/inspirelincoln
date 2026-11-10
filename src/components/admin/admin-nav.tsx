"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarCog, ClipboardCheck, Eye, FileStack, Gauge, HelpCircle, Inbox, Mail, MapPin, Megaphone, Mic, QrCode, ScrollText, Settings2,
  Ticket, UserCheck, Users, Wrench, DoorOpen, ShieldCheck, UserRound,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { Access } from "@/lib/accounts";

type Level = "committee" | "exec" | "leadership";
type LinkDef = { href: string; label: string; icon: typeof Gauge; level?: Level };

const GROUPS: { title: string; links: LinkDef[] }[] = [
  {
    title: "Today",
    links: [
      { href: "/admin", label: "Overview", icon: Gauge },
      { href: "/admin/checkin", label: "Check-in", icon: QrCode, level: "exec" },
    ],
  },
  {
    title: "People",
    links: [
      { href: "/admin/accounts", label: "Accounts", icon: UserCheck, level: "exec" },
      { href: "/admin/submissions", label: "Slides and posters", icon: FileStack },
      { href: "/admin/email", label: "Group email", icon: Mail, level: "leadership" },
    ],
  },
  {
    title: "Website",
    links: [
      { href: "/admin/content/sessions", label: "Programme", icon: CalendarCog },
      { href: "/admin/content/announcements", label: "Announcements", icon: Megaphone },
      { href: "/admin/content/speakers", label: "Speakers", icon: Mic },
      { href: "/admin/content/workshops", label: "Workshops", icon: Wrench },
      { href: "/admin/content/map", label: "Campus map", icon: MapPin },
      { href: "/admin/content/rooms", label: "Rooms", icon: DoorOpen },
      { href: "/admin/content/faqs", label: "FAQs", icon: HelpCircle },
      { href: "/admin/content/committee", label: "Committee profiles", icon: Users },
      { href: "/admin/settings", label: "Conference settings", icon: Settings2, level: "exec" },
    ],
  },
  {
    title: "Records",
    links: [
      { href: "/admin/registrations", label: "Registrations", icon: Ticket, level: "exec" },
      { href: "/admin/enquiries", label: "Enquiries", icon: Inbox, level: "exec" },
      { href: "/admin/abstracts", label: "Abstracts", icon: ClipboardCheck, level: "exec" },
      { href: "/admin/users", label: "Site roles", icon: ShieldCheck, level: "leadership" },
      { href: "/admin/audit", label: "Audit log", icon: ScrollText, level: "exec" },
    ],
  },
];

export function AdminNav({ access, name, position }: { access: Access; name: string; position: string }) {
  const path = usePathname();
  const allowed = (l: LinkDef) => !l.level || (l.level === "committee" ? access.committee : l.level === "exec" ? access.exec : access.leadership);
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
                  const active = l.href === "/admin" ? path === "/admin" : path.startsWith(l.href);
                  return (
                    <li key={l.href} className="shrink-0">
                      <Link
                        href={l.href}
                        aria-current={active ? "page" : undefined}
                        className={cn("flex min-h-11 items-center gap-2.5 whitespace-nowrap rounded-[3px] px-3 text-sm font-medium", active ? "bg-navy text-paper" : "text-slate-700 hover:bg-paper-200")}
                      >
                        <l.icon aria-hidden className="size-4" /> {l.label}
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
