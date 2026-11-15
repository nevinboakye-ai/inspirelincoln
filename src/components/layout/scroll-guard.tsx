"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { freeStrayScrollLock } from "@/lib/scroll-lock";

/**
 * Moving between pages keeps the page's own styles, so anything that locked
 * scrolling and was taken away without closing would leave the next page stuck.
 * After every page change (and when the browser restores a page from its
 * back/forward cache) this makes sure the page scrolls unless something open
 * still needs it locked.
 */
export function ScrollGuard() {
  const pathname = usePathname();
  useEffect(() => {
    const id = requestAnimationFrame(freeStrayScrollLock);
    return () => cancelAnimationFrame(id);
  }, [pathname]);
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => e.persisted && freeStrayScrollLock();
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);
  return null;
}
