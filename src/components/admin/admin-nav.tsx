1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
32
33
34
35
36
37
38
39
40
41
42
43
44
45
46
47
48
49
50
51
52
53
54
55
56
57
58
59
60
61
62
63
64
65
66
67
68
69
70
71
72
73
74
75
76
77
78
79
80
81
82
83
84
85
86
87
88
89
90
91
92
93
94
95
96
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BellRing, CalendarCog, ClipboardCheck, Eye, FileStack, Gauge, HelpCircle, Inbox, Mail, MapPin, Megaphone, Mic, QrCode, ScrollText, Settings2,
  Ticket, UserCheck, MessageCircle, GraduationCap, ListOrdered, CalendarCheck2, Users, Wrench, DoorOpen, ShieldCheck, UserRound, LayoutDashboard, Activity, BarChart3, HandHeart, Car, FileDown, LayoutGrid, X, History,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { Access, Capability } from "@/lib/accounts";
import { useMessages } from "@/components/messages/messages-provider";

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
      { href: "/admin/enquiries", label: "Enquiries", icon: Inbox, need: ["answer_enquiries", "manage_people"] },
      { href: "/portal/messages", label: "Messages", icon: MessageCircle, need: "message_people" },
      { href: "/admin/email", label: "Group email", icon: Mail, need: "send_email" },
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
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
    };
  }, [open]);
  const groups = GROUPS.map((g) => ({ ...g, links: g.links.filter(allowed) })).filter((g) => g.links.length);