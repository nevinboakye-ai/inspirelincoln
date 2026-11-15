"use client";
import { useEffect } from "react";

/**
 * On phones a conversation (or the new message picker) covers the screen
 * like a messaging app, and follows the on-screen keyboard so the box you type in is never hidden.
 */
export function useFullScreenOnPhones(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    const vv = window.visualViewport;
    const phone = window.matchMedia("(max-width: 1023px)");
    if (!el) return;
    const fit = () => {
      if (!phone.matches || !vv) {
        el.style.height = "";
        el.style.top = "";
        return;
      }
      el.style.height = `${vv.height}px`;
      el.style.top = `${vv.offsetTop}px`;
    };
    const lock = () => {
      document.documentElement.style.overflow = phone.matches ? "hidden" : "";
      fit();
    };
    lock();
    vv?.addEventListener("resize", fit);
    vv?.addEventListener("scroll", fit);
    phone.addEventListener("change", lock);
    return () => {
      document.documentElement.style.overflow = "";
      vv?.removeEventListener("resize", fit);
      vv?.removeEventListener("scroll", fit);
      phone.removeEventListener("change", lock);
    };
  }, [ref]);
}
