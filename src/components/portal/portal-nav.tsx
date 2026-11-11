"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gauge, LayoutDashboard, LogOut, ShieldCheck, Ticket, UploadCloud, UserRound, ClipboardCheck, NotebookPen, Users } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { cn } from "@/lib/cn";
import type { Access } from "@/lib/accounts";

export function PortalNav({ name, typeLabel, presenter, access, reviewer, showNetwork, showPeople }: { name: string; typeLabel: string; presenter: boolean; access: Access; reviewer: boolean; showNetwork: boolean; showPeople: boolean }) {
  const path = usePathname();
  const links = [
    { href: "/portal", label: "My conference", icon: Ticket },
    ...(presenter ? [{ href: "/portal/submission", label: "My submission", icon: UploadCloud }] : []),
    ...(showNetwork ? [{ href: "/portal/network", label: "Network", icon: Users }] : []),
    ...(showPeople ? [{ href: "/portal/people", label: "People I've met", icon: NotebookPen }] : []),
    { href: "/portal/profile", label: "Profile and privacy", icon: UserRound },
    ...(reviewer && !access.committee ? [{ href: "/review", label: "Abstract reviews", icon: ClipboardCheck }] : []),
    ...(access.owner ? [{ href: "/admin/platform", label: "Platform dashboard", icon: Gauge }] : []),
    ...(access.committee ? [{ href: "/admin", label: "Committee dashboard", icon: access.exec ? ShieldCheck : LayoutDashboard }] : []),
  ];
  return (
    <nav aria-label="My account" className="min-w-0 lg:sticky lg:top-28">
      <div className="mb-5 hidden items-center gap-3 lg:flex">
        <span className="flex size-11 items-center justify-center rounded-full bg-navy text-cyan">
          <UserRound aria-hidden className="size-5" />
        </span>
        <span className="min-w-0">
          <span className="block truncate font-semibold text-ink">{name}</span>
          <span className="block text-xs text-slate">{typeLabel}</span>
        </span>
      </div>
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
        {links.map((l) => {
          const active = l.href === "/portal" ? path === "/portal" : path.startsWith(l.href);
          return (
            <li key={l.href} className="shrink-0">
              <Link
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-2.5 whitespace-nowrap rounded-[3px] px-3 text-sm font-medium transition-colors",
                  active ? "bg-navy text-paper" : "border border-navy/10 bg-white text-slate-700 hover:bg-paper-200 lg:border-0 lg:bg-transparent",
                )}
              >
                <l.icon aria-hidden className="size-4" />
                {l.label}
              </Link>
            </li>
          );
        })}
        <li className="shrink-0 lg:mt-4 lg:border-t lg:border-navy/10 lg:pt-4">
          <form action={signOut}>
            <button type="submit" className="flex min-h-11 w-full items-center gap-2.5 whitespace-nowrap rounded-[3px] border border-navy/10 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-paper-200 lg:border-0 lg:bg-transparent">
              <LogOut aria-hidden className="size-4" /> Log out
            </button>
          </form>
        </li>
      </ul>
    </nav>
  );
}
