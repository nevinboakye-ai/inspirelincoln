"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardCheck, FileText, LayoutDashboard, LogOut, Presentation, Settings, ShieldCheck, UserRound } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { cn } from "@/lib/cn";
import type { UserRole } from "@/lib/types";

export function PortalNav({ role, name }: { role: UserRole; name: string }) {
  const path = usePathname();
  const links = [
    { href: "/portal", label: "Dashboard", icon: LayoutDashboard },
    { href: "/portal/presenter", label: "Presenter", icon: Presentation },
    { href: "/portal/abstracts/new", label: "Submit abstract", icon: FileText },
    { href: "/portal/profile", label: "Profile & settings", icon: Settings },
    ...(role === "reviewer" || role === "admin" ? [{ href: "/review", label: "Review abstracts", icon: ClipboardCheck }] : []),
    ...(role === "editor" || role === "admin" ? [{ href: "/admin", label: "Admin dashboard", icon: ShieldCheck }] : []),
  ];
  return (
    <nav aria-label="My Conference" className="min-w-0 lg:sticky lg:top-28">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-full bg-navy text-cyan">
          <UserRound aria-hidden className="size-5" />
        </span>
        <span className="min-w-0">
          <span className="block truncate font-semibold text-ink">{name}</span>
          <span className="block text-xs capitalize text-slate">{role}</span>
        </span>
      </div>
      <ul className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
        {links.map((l) => {
          const active = l.href === "/portal" ? path === "/portal" : path.startsWith(l.href);
          return (
            <li key={l.href} className="shrink-0">
              <Link href={l.href} aria-current={active ? "page" : undefined} className={cn("flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors", active ? "bg-navy text-paper" : "text-slate-700 hover:bg-paper-200")}>
                <l.icon aria-hidden className="size-4" />
                {l.label}
              </Link>
            </li>
          );
        })}
        <li className="shrink-0 lg:mt-4 lg:border-t lg:border-navy/10 lg:pt-4">
          <form action={signOut}>
            <button type="submit" className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-slate-700 hover:bg-paper-200">
              <LogOut aria-hidden className="size-4" /> Sign out
            </button>
          </form>
        </li>
      </ul>
    </nav>
  );
}
