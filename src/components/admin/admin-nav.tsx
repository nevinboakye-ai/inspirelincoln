"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen, CalendarCog, ClipboardList, FileSearch, Gauge, Image as ImageIcon, Inbox, LayoutList, Megaphone, MessageSquareQuote,
  Mic, Presentation, QrCode, ScrollText, Settings2, Ticket, Users, Wrench, Building2, History, HelpCircle, Library, DoorOpen, Archive, Scale, MapPin,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { UserRole } from "@/lib/types";

const GROUPS: { title: string; admin?: boolean; links: { href: string; label: string; icon: typeof Gauge; admin?: boolean }[] }[] = [
  { title: "Overview", links: [{ href: "/admin", label: "Dashboard", icon: Gauge }, { href: "/admin/settings", label: "Conference settings", icon: Settings2 }] },
  {
    title: "Programme",
    links: [
      { href: "/admin/content/sessions", label: "Sessions", icon: CalendarCog },
      { href: "/admin/content/speakers", label: "Speakers", icon: Mic },
      { href: "/admin/content/workshops", label: "Workshops", icon: Wrench },
      { href: "/admin/content/rooms", label: "Rooms", icon: DoorOpen },
      { href: "/admin/content/map", label: "Map places", icon: MapPin },
    ],
  },
  {
    title: "Content",
    links: [
      { href: "/admin/content/announcements", label: "Announcements", icon: Megaphone },
      { href: "/admin/content/faqs", label: "FAQs", icon: HelpCircle },
      { href: "/admin/content/opportunities", label: "Opportunities", icon: BookOpen },
      { href: "/admin/content/gallery", label: "Gallery", icon: ImageIcon },
      { href: "/admin/content/resources", label: "Resources", icon: Library },
      { href: "/admin/content/partners", label: "Institutions", icon: Building2 },
      { href: "/admin/content/committee", label: "Committee", icon: Users },
      { href: "/admin/content/timeline", label: "History timeline", icon: History },
      { href: "/admin/content/editions", label: "Editions & archive", icon: Archive, admin: true },
    ],
  },
  {
    title: "Research",
    admin: true,
    links: [
      { href: "/admin/abstracts", label: "Abstracts", icon: FileSearch },
      { href: "/admin/content/criteria", label: "Review criteria", icon: Scale },
      { href: "/admin/posters", label: "Posters", icon: Presentation },
    ],
  },
  {
    title: "People",
    admin: true,
    links: [
      { href: "/admin/registrations", label: "Registrations", icon: Ticket },
      { href: "/admin/checkin", label: "Check-in", icon: QrCode },
      { href: "/admin/users", label: "Users & roles", icon: Users },
      { href: "/admin/enquiries", label: "Enquiries", icon: Inbox },
      { href: "/admin/audit", label: "Audit log", icon: ScrollText },
    ],
  },
];

export function AdminNav({ role }: { role: UserRole }) {
  const path = usePathname();
  const isAdmin = role === "admin";
  return (
    <nav aria-label="Admin" className="min-w-0 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
      <p className="mb-4 flex items-center gap-2 font-ui text-sm font-semibold uppercase tracking-wider text-slate"><LayoutList aria-hidden className="size-4" /> Admin · <span className="capitalize">{role}</span></p>
      <div className="flex gap-6 overflow-x-auto pb-2 lg:block lg:space-y-6 lg:overflow-visible">
        {GROUPS.filter((g) => !g.admin || isAdmin).map((g) => (
          <div key={g.title} className="shrink-0">
            <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-slate">{g.title}</p>
            <ul className="flex gap-1 lg:flex-col">
              {g.links.filter((l) => !l.admin || isAdmin).map((l) => {
                const active = l.href === "/admin" ? path === "/admin" : path.startsWith(l.href);
                return (
                  <li key={l.href} className="shrink-0">
                    <Link href={l.href} aria-current={active ? "page" : undefined} className={cn("flex min-h-10 items-center gap-2.5 rounded-md px-3 text-sm font-medium", active ? "bg-navy text-paper" : "text-slate-700 hover:bg-paper-200")}>
                      <l.icon aria-hidden className="size-4" /> {l.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        <div className="shrink-0 border-navy/10 lg:border-t lg:pt-4">
          <Link href="/portal" className="flex min-h-10 items-center gap-2.5 rounded-md px-3 text-sm font-medium text-slate-700 hover:bg-paper-200"><MessageSquareQuote aria-hidden className="size-4" /> My Conference</Link>
          <Link href="/" className="flex min-h-10 items-center gap-2.5 rounded-md px-3 text-sm font-medium text-slate-700 hover:bg-paper-200"><ClipboardList aria-hidden className="size-4" /> View site</Link>
        </div>
      </div>
    </nav>
  );
}
