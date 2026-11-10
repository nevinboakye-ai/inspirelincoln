"use client";
import { AnimatePresence, motion, useScroll, useSpring } from "motion/react";
import { ArrowRight, ArrowUpRight, ChevronDown, Menu, Search, UserRound, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Announcement } from "@/lib/types";
import { NAV } from "@/lib/site";
import { cn } from "@/lib/cn";
import { Logo } from "./logo";
import { openCommandPalette } from "./command-palette";

function isActive(pathname: string, href: string) {
  const path = href.split("#")[0];
  return path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`);
}

export function SiteHeader({
  edition,
  ribbon,
}: {
  edition: { year: number; date: string };
  ribbon: Announcement | null;
}) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [openGroup, setOpenGroup] = useState<number | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [ribbonHidden, setRibbonHidden] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 200, damping: 40, restDelta: 0.001 });

  const inAccountArea = /^\/(admin|portal|review)/.test(pathname);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpenGroup(null);
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    try {
      if (ribbon && sessionStorage.getItem(`ribbon-${ribbon.id}`)) setRibbonHidden(true);
    } catch {}
  }, [ribbon]);

  useEffect(() => {
    if (openGroup === null) return;
    const onDown = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenGroup(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenGroup(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [openGroup]);

  useEffect(() => {
    document.documentElement.style.overflow = mobileOpen ? "hidden" : "";
  }, [mobileOpen]);

  const enter = (i: number) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setOpenGroup(i), 80);
  };
  const leave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setOpenGroup(null), 180);
  };

  const showRibbon = ribbon && !ribbonHidden && !inAccountArea;
  const solid = scrolled || openGroup !== null || inAccountArea;

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50">
        {showRibbon && (
          <div className="relative bg-gradient-to-r from-electric-700 via-electric-600 to-violet text-white">
            <div className="container-page flex min-h-10 items-center justify-center gap-3 py-2 pr-10 text-center text-[0.8125rem]">
              <span className="hidden rounded-full bg-white/15 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.14em] sm:inline">
                {ribbon.level === "urgent" ? "Urgent" : "Notice"}
              </span>
              <span className="font-medium">{ribbon.title}</span>
            </div>
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-sm p-1.5 text-white/80 hover:text-white"
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
          ref={navRef}
          onMouseLeave={leave}
          className={cn(
            "relative border-b transition-[background-color,border-color,backdrop-filter] duration-500",
            solid ? "border-white/10 bg-midnight/85 backdrop-blur-xl" : "border-transparent bg-transparent",
          )}
        >
          <div className="container-page flex h-[var(--header-h)] items-center gap-6 text-paper">
            <Link href="/" className="rounded-sm" aria-label="INSPIRE home">
              <Logo />
            </Link>

            <nav aria-label="Main" className="ml-auto hidden lg:block">
              <ul className="flex items-center gap-1">
                {NAV.map((group, i) => {
                  const active = group.items.some((it) => isActive(pathname, it.href));
                  return (
                    <li key={group.label} onMouseEnter={() => enter(i)}>
                      <button
                        type="button"
                        aria-expanded={openGroup === i}
                        aria-controls={`mega-${i}`}
                        onClick={() => setOpenGroup(openGroup === i ? null : i)}
                        className={cn(
                          "relative flex min-h-11 items-center gap-1 whitespace-nowrap rounded-full px-4 text-[0.9rem] font-medium transition-colors",
                          openGroup === i || active ? "text-paper" : "text-paper/70 hover:text-paper",
                        )}
                      >
                        {group.label}
                        <ChevronDown
                          aria-hidden
                          className={cn("size-3.5 transition-transform duration-300", openGroup === i && "rotate-180")}
                        />
                        {(active || openGroup === i) && (
                          <motion.span
                            layoutId="nav-indicator"
                            className="absolute inset-x-4 -bottom-0.5 h-px bg-gradient-to-r from-cyan to-violet"
                            transition={{ type: "spring", stiffness: 500, damping: 40 }}
                          />
                        )}
                      </button>
                    </li>
                  );
                })}
                <li onMouseEnter={() => setOpenGroup(null)}>
                  <Link
                    href="/contact"
                    className={cn(
                      "relative flex min-h-11 items-center rounded-full px-4 text-[0.9rem] font-medium transition-colors",
                      isActive(pathname, "/contact") ? "text-paper" : "text-paper/70 hover:text-paper",
                    )}
                  >
                    Contact
                    {isActive(pathname, "/contact") && openGroup === null && (
                      <motion.span layoutId="nav-indicator" className="absolute inset-x-4 -bottom-0.5 h-px bg-gradient-to-r from-cyan to-violet" />
                    )}
                  </Link>
                </li>
              </ul>
            </nav>

            <div className="ml-auto flex items-center gap-2 lg:ml-2">
              <button
                type="button"
                onClick={openCommandPalette}
                className="flex min-h-11 items-center gap-2 rounded-full border border-white/12 px-3 text-sm text-paper/70 transition-colors hover:border-white/30 hover:text-paper"
                aria-label="Search the site"
              >
                <Search aria-hidden className="size-4" />
                <kbd className="hidden rounded-xs border border-white/15 px-1.5 text-[0.7rem] text-paper/70 xl:inline">⌘K</kbd>
              </button>
              <Link
                href="/portal"
                className="hidden min-h-11 items-center gap-2 whitespace-nowrap rounded-full px-3 text-sm font-medium text-paper/80 transition-colors hover:text-paper xl:flex"
              >
                <UserRound aria-hidden className="size-4" />
                My Conference
              </Link>
              <Link
                href="/conference#registration"
                className="hidden min-h-11 items-center gap-1.5 rounded-full bg-cyan px-5 font-display text-sm font-semibold text-midnight transition-[background-color,box-shadow] hover:bg-cyan-300 hover:shadow-[0_8px_32px_-8px_rgba(57,213,242,0.6)] sm:flex"
              >
                Register
                <ArrowUpRight aria-hidden className="size-4" />
              </Link>
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="flex size-11 items-center justify-center rounded-full border border-white/15 lg:hidden"
                aria-label="Open menu"
                aria-expanded={mobileOpen}
                aria-controls="mobile-nav"
              >
                <Menu className="size-5" />
              </button>
            </div>
          </div>

          <AnimatePresence>
            {openGroup !== null && (
              <motion.div
                key="mega"
                id={`mega-${openGroup}`}
                onMouseEnter={() => hoverTimer.current && clearTimeout(hoverTimer.current)}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-x-0 top-full hidden border-b border-white/10 bg-midnight/95 backdrop-blur-xl lg:block"
              >
                <div className="container-page grid grid-cols-12 gap-8 py-10 text-paper">
                  <p className="eyebrow col-span-2 pt-2 text-cyan">{NAV[openGroup].label}</p>
                  <ul className={cn("grid gap-2", NAV[openGroup].feature ? "col-span-6 grid-cols-2" : "col-span-10 grid-cols-3")}>
                    {NAV[openGroup].items.map((item, idx) => (
                      <motion.li
                        key={item.href}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.04 * idx, duration: 0.35 }}
                      >
                        <Link
                          href={item.href}
                          aria-current={isActive(pathname, item.href) ? "page" : undefined}
                          className="group block rounded-md p-4 transition-colors hover:bg-white/[0.05]"
                        >
                          <span className="flex items-center gap-2 font-display text-lg font-medium">
                            {item.label}
                            <ArrowRight aria-hidden className="size-4 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                          </span>
                          {item.description && <span className="mt-1 block text-sm text-paper/55">{item.description}</span>}
                        </Link>
                      </motion.li>
                    ))}
                  </ul>
                  {NAV[openGroup].feature && (
                    <Link
                      href={NAV[openGroup].feature!.href}
                      className="group relative col-span-4 overflow-hidden rounded-lg border border-white/10 bg-gradient-to-br from-navy-700 to-navy p-6"
                    >
                      <div aria-hidden className="grid-lines absolute inset-0 opacity-60" />
                      <div aria-hidden className="absolute -right-10 -top-10 size-40 rounded-full bg-cyan/20 blur-3xl" />
                      <p className="relative font-display text-xl font-medium leading-snug">{NAV[openGroup].feature!.title}</p>
                      <p className="relative mt-2 text-sm text-paper/60">{NAV[openGroup].feature!.body}</p>
                      <span className="relative mt-6 inline-flex items-center gap-2 text-sm font-semibold text-cyan">
                        {NAV[openGroup].feature!.cta}
                        <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-1" />
                      </span>
                    </Link>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            aria-hidden
            style={{ scaleX: progress }}
            className="absolute inset-x-0 bottom-0 h-px origin-left bg-gradient-to-r from-cyan via-electric to-violet"
          />
        </div>
      </header>

      <MobileNav open={mobileOpen} onClose={() => setMobileOpen(false)} pathname={pathname} year={edition.year} />
    </>
  );
}

function MobileNav({ open, onClose, pathname, year }: { open: boolean; onClose: () => void; pathname: string; year: number }) {
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

  const links = [
    { label: "Home", href: "/" },
    ...NAV.flatMap((g) => g.items.filter((i) => !i.href.includes("#"))),
    { label: "Contact", href: "/contact" },
  ];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          id="mobile-nav"
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Site menu"
          initial={{ clipPath: "circle(0% at calc(100% - 44px) 36px)" }}
          animate={{ clipPath: "circle(150% at calc(100% - 44px) 36px)" }}
          exit={{ clipPath: "circle(0% at calc(100% - 44px) 36px)" }}
          transition={{ duration: 0.6, ease: [0.76, 0, 0.24, 1] }}
          className="fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-midnight text-paper lg:hidden"
        >
          <div aria-hidden className="grid-lines pointer-events-none absolute inset-0 opacity-50" />
          <div aria-hidden className="pointer-events-none absolute -right-32 top-1/3 size-96 rounded-full bg-electric/25 blur-[120px]" />
          <div className="container-page relative flex h-[var(--header-h)] shrink-0 items-center justify-between">
            <Link href="/" onClick={onClose} aria-label="INSPIRE home">
              <Logo />
            </Link>
            <button ref={closeRef} type="button" onClick={onClose} className="flex size-11 items-center justify-center rounded-full border border-white/20" aria-label="Close menu">
              <X className="size-5" />
            </button>
          </div>
          <nav aria-label="Mobile" className="container-page relative flex-1 py-6">
            <ul className="space-y-1">
              {links.map((l, i) => (
                <motion.li
                  key={l.href}
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 + i * 0.035, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Link
                    href={l.href}
                    onClick={onClose}
                    aria-current={isActive(pathname, l.href) ? "page" : undefined}
                    className={cn(
                      "flex min-h-12 items-baseline gap-4 border-b border-white/[0.07] py-2 font-display text-[1.75rem] font-medium tracking-tight sm:text-4xl",
                      isActive(pathname, l.href) ? "text-cyan" : "text-paper",
                    )}
                  >
                    <span className="w-6 text-xs font-normal text-paper/65">{String(i + 1).padStart(2, "0")}</span>
                    {l.label}
                  </Link>
                </motion.li>
              ))}
            </ul>
          </nav>
          <div className="container-page relative grid shrink-0 gap-3 pb-8 pt-2 sm:grid-cols-3">
            <Link href="/conference#registration" onClick={onClose} className="flex min-h-12 items-center justify-center rounded-full bg-cyan font-display font-semibold text-midnight">
              Register for {year}
            </Link>
            <Link href="/portal" onClick={onClose} className="flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/20 font-display font-medium">
              <UserRound aria-hidden className="size-4" /> My Conference
            </Link>
            <button
              type="button"
              onClick={() => {
                onClose();
                setTimeout(openCommandPalette, 300);
              }}
              className="flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/20 font-display font-medium"
            >
              <Search aria-hidden className="size-4" /> Search
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
