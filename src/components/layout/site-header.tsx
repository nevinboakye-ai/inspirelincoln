"use client";
import { AnimatePresence, m } from "motion/react";
import { ArrowUpRight, CalendarDays, Home, Map as MapIcon, Menu, Search, LayoutDashboard, UserRound, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Announcement } from "@/lib/types";
import { FOOTER_LINKS, NAV } from "@/lib/site";
import { cn } from "@/lib/cn";
import { Logo } from "./logo";
import { openCommandPalette } from "./search-launcher";

function isActive(pathname: string, href: string) {
  const path = href.split("#")[0];
  return path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`);
}

export function SiteHeader({ edition, ribbon }: { edition: { year: number; date: string }; ribbon: Announcement | null }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [ribbonHidden, setRibbonHidden] = useState(false);

  const inAccountArea = /^\/(admin|portal|review)/.test(pathname);
  const inAuth = /^\/(login|signup|auth)/.test(pathname);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => {
    try {
      if (ribbon && sessionStorage.getItem(`ribbon-${ribbon.id}`)) setRibbonHidden(true);
    } catch {}
  }, [ribbon]);

  useEffect(() => {
    document.documentElement.style.overflow = menuOpen ? "hidden" : "";
  }, [menuOpen]);

  // The map fills the screen under a fixed-height header, so the ribbon stays off it.
  const onMap = pathname.startsWith("/map");
  const showRibbon = ribbon && !ribbonHidden && !inAccountArea && !onMap;
  const solid = scrolled || inAccountArea || inAuth || onMap;

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50">
        {showRibbon && (
          <div className="relative bg-electric-600 text-white">
            <div className="container-page flex min-h-10 items-center justify-center gap-3 py-2 pr-10 text-center text-[0.8125rem]">
              <span className="hidden rounded-[3px] bg-white/15 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.14em] sm:inline">
                {ribbon.level === "urgent" ? "Urgent" : "Notice"}
              </span>
              <span className="font-medium">{ribbon.title}</span>
            </div>
            <button
              type="button"
              className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center text-white/85 hover:text-white"
              aria-label="Dismiss notice"
              onClick={() => {
                setRibbonHidden(true);
                try {
                  sessionStorage.setItem(`ribbon-${ribbon.id}`, "1");
                } catch {}
              }}
            >
              <X className="size-4" />
            </button>
          </div>
        )}
        <div
          className={cn(
            "border-b transition-[background-color,border-color,backdrop-filter] duration-500",
            solid ? "border-white/10 bg-midnight/90 backdrop-blur-xl" : "border-transparent bg-transparent",
          )}
        >
          <div className="container-page flex h-[var(--header-h)] items-center gap-6 text-paper">
            <Link href="/" className="rounded-sm" aria-label="INSPIRE home">
              <Logo />
            </Link>

            <nav aria-label="Main" className="ml-auto hidden lg:block">
              <ul className="flex items-center gap-1">
                {NAV.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "relative flex min-h-11 items-center whitespace-nowrap px-3.5 text-[0.9rem] font-medium transition-colors",
                          active ? "text-paper" : "text-paper/70 hover:text-paper",
                        )}
                      >
                        {item.label}
                        {active && <m.span layoutId="nav-indicator" className="absolute inset-x-3.5 -bottom-0.5 h-px bg-cyan" />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div className="ml-auto flex items-center gap-2 lg:ml-2">
              <button
                type="button"
                onClick={openCommandPalette}
                className="flex size-11 items-center justify-center rounded-[3px] border border-white/12 text-paper/75 transition-colors hover:border-white/30 hover:text-paper"
                aria-label="Search the site"
              >
                <Search aria-hidden className="size-4" />
              </button>
              <Link
                href="/portal"
                className="hidden min-h-11 items-center gap-2 whitespace-nowrap px-3 text-sm font-medium text-paper/80 transition-colors hover:text-paper lg:flex"
              >
                <UserRound aria-hidden className="size-4" /> My account
              </Link>
              <Link
                href="/signup"
                className="hidden min-h-11 items-center gap-1.5 rounded-[3px] bg-cyan px-5 font-ui text-sm font-semibold text-midnight transition-colors hover:bg-cyan-300 sm:flex"
              >
                Register <ArrowUpRight aria-hidden className="size-4" />
              </Link>
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                className="flex size-11 items-center justify-center rounded-[3px] border border-white/15 lg:hidden"
                aria-label="Open menu"
                aria-expanded={menuOpen}
                aria-controls="mobile-nav"
              >
                <Menu className="size-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} pathname={pathname} year={edition.year} />
      {!pathname.startsWith("/admin") && !inAuth && <BottomBar pathname={pathname} />}
    </>
  );
}

/** Thumb-reach navigation for phones: the four things people need on the day. */
function BottomBar({ pathname }: { pathname: string }) {
  const tabs = [
    { href: "/", label: "Home", icon: Home },
    { href: "/programme", label: "Programme", icon: CalendarDays },
    { href: "/map", label: "Map", icon: MapIcon },
    { href: "/portal", label: "My Hub", icon: LayoutDashboard },
  ];
  return (
    <nav
      aria-label="Quick links"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-midnight/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-4">
        {tabs.map((t) => {
          const active = isActive(pathname, t.href);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cn("flex min-h-16 flex-col items-center justify-center gap-1 font-ui text-[0.7rem] font-semibold", active ? "text-cyan" : "text-paper/75")}
              >
                <t.icon aria-hidden className="size-5" strokeWidth={active ? 2.25 : 1.75} />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function MobileMenu({ open, onClose, pathname, year }: { open: boolean; onClose: () => void; pathname: string; year: number }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>("a, button");
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const links = [{ label: "Home", href: "/" }, ...NAV, { label: "Contact", href: "/contact" }];

  return (
    <AnimatePresence>
      {open && (
        <m.div
          id="mobile-nav"
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Site menu"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-midnight text-paper lg:hidden"
        >
          <div className="container-page flex h-[var(--header-h)] shrink-0 items-center justify-between">
            <Link href="/" onClick={onClose} aria-label="INSPIRE home">
              <Logo />
            </Link>
            <button ref={closeRef} type="button" onClick={onClose} className="flex size-11 items-center justify-center rounded-[3px] border border-white/20" aria-label="Close menu">
              <X className="size-5" />
            </button>
          </div>
          <nav aria-label="Mobile" className="container-page flex-1 py-4">
            <ul>
              {links.map((l, i) => (
                <m.li key={l.href} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 * i, duration: 0.3 }}>
                  <Link
                    href={l.href}
                    onClick={onClose}
                    aria-current={isActive(pathname, l.href) ? "page" : undefined}
                    className={cn(
                      "flex min-h-14 items-center border-b border-white/[0.08] font-display text-[1.75rem] leading-none",
                      isActive(pathname, l.href) ? "text-cyan" : "text-paper",
                    )}
                  >
                    {l.label}
                  </Link>
                </m.li>
              ))}
            </ul>
            <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm text-paper/70">
              {FOOTER_LINKS.legal.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} onClick={onClose} className="inline-flex min-h-10 items-center underline-offset-4 hover:underline">{l.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="container-page grid shrink-0 grid-cols-2 gap-3 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-2">
            <Link href="/signup" onClick={onClose} className="flex min-h-12 items-center justify-center rounded-[3px] bg-cyan font-ui font-semibold text-midnight">
              Register for {year}
            </Link>
            <Link href="/portal" onClick={onClose} className="flex min-h-12 items-center justify-center gap-2 rounded-[3px] border border-white/20 font-ui font-medium">
              <UserRound aria-hidden className="size-4" /> My account
            </Link>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
