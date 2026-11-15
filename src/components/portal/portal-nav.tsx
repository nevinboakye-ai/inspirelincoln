
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  CalendarClock,
  Gauge,
  MessagesSquare,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Ticket,
  UploadCloud,
  UserRound,
  ClipboardCheck,
  NotebookPen,
  Users,
} from "lucide-react";

import { signOut } from "@/app/auth/actions";
import { cn } from "@/lib/cn";
import type { Access } from "@/lib/accounts";

export function PortalNav({
  name,
  typeLabel,
  presenter,
  access,
  reviewer,
  showNetwork,
  showPeople,
  showMyDay = false,
  unreadEnquiries = 0,
}: {
  name: string;
  typeLabel: string;
  presenter: boolean;
  access: Access;
  reviewer: boolean;
  showNetwork: boolean;
  showPeople: boolean;
  showMyDay?: boolean;
  unreadEnquiries?: number;
}) {
  const path = usePathname();

  const links = [
    { href: "/portal", label: "My conference", icon: Ticket },
    ...(showMyDay
      ? [{ href: "/portal/my-day", label: "My day", icon: CalendarClock }]
      : []),
    ...(presenter
      ? [{ href: "/portal/submission", label: "My submission", icon: UploadCloud }]
      : []),
    ...(showNetwork
      ? [{ href: "/portal/network", label: "Network", icon: Users }]
      : []),
    ...(showPeople
      ? [{ href: "/portal/people", label: "People I've met", icon: NotebookPen }]
      : []),
    {
      href: "/portal/enquiries",
      label: "Enquiries",
      icon: MessagesSquare,
      badge: unreadEnquiries,
    },
    { href: "/portal/profile", label: "Profile and privacy", icon: UserRound },
    ...(reviewer && !access.committee
      ? [{ href: "/review", label: "Abstract reviews", icon: ClipboardCheck }]
      : []),
    ...(access.owner
      ? [{ href: "/admin/platform", label: "Platform dashboard", icon: Gauge }]
      : []),
    ...(access.committee
      ? [{
          href: "/admin",
          label: "Committee dashboard",
          icon: access.exec ? ShieldCheck : LayoutDashboard,
        }]
      : []),
  ];

  const strip = useRef<HTMLUListElement>(null);

  // On phones, keep the active tab visible when navigating.
  useEffect(() => {
    const el = strip.current?.querySelector<HTMLElement>(
      '[aria-current="page"]'
    );

    if (
      el &&
      strip.current &&
      strip.current.scrollWidth > strip.current.clientWidth
    ) {
      strip.current.scrollTo({
        left: el.offsetLeft - 16,
        behavior: "smooth",
      });
    }
  }, [path]);

  return (
    <nav
      aria-label="My account"
      className="sticky top-[var(--header-h)] z-30 -mx-5 min-w-0 border-b border-navy/[0.07] bg-paper/90 backdrop-blur-xl sm:-mx-8 lg:top-28 lg:mx-0 lg:self-start lg:border-0 lg:bg-transparent lg:backdrop-blur-none"
    >
      <div className="mb-4 hidden items-center gap-3 rounded-2xl bg-midnight p-3 text-paper lg:flex">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-gold-300 to-gold-600 font-ui text-sm font-bold text-midnight">
          {initials(name)}
        </span>

        <span className="min-w-0">
          <span className="block truncate font-semibold">{name}</span>
          <span className="block truncate text-xs text-paper/65">
            {typeLabel}
          </span>
        </span>
      </div>

      <ul
        ref={strip}
        className="no-scrollbar scroll-fade-x flex gap-1.5 overflow-x-auto scroll-smooth px-5 py-2.5 sm:px-8 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:p-0 lg:[mask-image:none]"
      >
        {links.map((l) => {
          const active =
            l.href === "/portal"
              ? path === "/portal"
              : path.startsWith(l.href);

          return (
            <li key={l.href} className="shrink-0">
              <Link
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "tap flex min-h-10 items-center gap-2 whitespace-nowrap rounded-full px-3.5 text-[0.8125rem] font-semibold lg:min-h-11 lg:rounded-xl lg:px-3 lg:text-sm lg:font-medium",
                  active
                    ? "bg-navy text-paper shadow-[0_6px_16px_-8px_rgba(12,24,44,0.7)]"
                    : "bg-white text-slate-700 ring-1 ring-navy/[0.08] hover:bg-paper-200 lg:bg-transparent lg:ring-0"
                )}
              >
                <l.icon
                  aria-hidden
                  className={cn(
                    "size-4",
                    active ? "text-gold-300" : "text-electric-600"
                  )}
                />

                {l.label}

                {"badge" in l && Number(l.badge) > 0 && (
                  <span
                    className={cn(
                      "ml-auto grid min-w-5 place-items-center rounded-full px-1.5 text-[0.7rem] font-bold leading-5",
                      active
                        ? "bg-gold text-midnight"
                        : "bg-coral text-white"
                    )}
                  >
                    {l.badge}
                    <span className="sr-only">
                      {" "}
                      new {Number(l.badge) === 1 ? "reply" : "replies"}
                    </span>
                  </span>
                )}
              </Link>
            </li>
          );
        })}

        <li className="shrink-0 lg:mt-3 lg:border-t lg:border-navy/10 lg:pt-3">
          <form action={signOut}>
            <button
              type="submit"
              className="tap flex min-h-10 w-full items-center gap-2 whitespace-nowrap rounded-full bg-white px-3.5 text-[0.8125rem] font-semibold text-slate-700 ring-1 ring-navy/[0.08] hover:bg-paper-200 lg:min-h-11 lg:rounded-xl lg:bg-transparent lg:px-3 lg:text-sm lg:font-medium lg:ring-0"
            >
              <LogOut aria-hidden className="size-4" />
              Log out
            </button>
          </form>
        </li>
      </ul>
    </nav>
  );
}

function initials(name: string) {
  const parts = name
    .replace(/@.*/, "")
    .split(/[\s._-]+/)
    .filter(Boolean);

  return (
    (
      (parts[0]?.[0] ?? "") +
      (parts.length > 1 ? parts[parts.length - 1][0] : "")
    ).toUpperCase() || "?"
  );
}
