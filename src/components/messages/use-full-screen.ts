"use client";
import { useEffect } from "react";
import { lockScroll } from "@/lib/scroll-lock";

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
    // Only phones lock the page behind the conversation.
    let release: (() => void) | null = null;
    const lock = () => {
      if (phone.matches && !release) release = lockScroll();
      if (!phone.matches && release) {
        release();
        release = null;
      }
      fit();
    };
    lock();
    vv?.addEventListener("resize", fit);
    vv?.addEventListener("scroll", fit);
    phone.addEventListener("change", lock);
    return () => {
      release?.();
      vv?.removeEventListener("resize", fit);
      vv?.removeEventListener("scroll", fit);
      phone.removeEventListener("change", lock);
    };
  }, [ref]);
}
