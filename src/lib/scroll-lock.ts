"use client";
import { useEffect } from "react";

/*
 * One place that stops the page scrolling behind a menu, drawer or pop-up.
 *
 * Each open thing takes a lock and gives it back when it closes or disappears.
 * The page only scrolls again when every lock is back, so closing one pop-up
 * never frees the page under another, and a lock can't be given back twice.
 */
let held = 0;

function apply() {
  if (typeof document === "undefined") return;
  document.documentElement.style.overflow = held > 0 ? "hidden" : "";
}

/** Stops the page scrolling. Call the returned function to let it scroll again. */
export function lockScroll(): () => void {
  held += 1;
  apply();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    held = Math.max(0, held - 1);
    apply();
  };
}

/** Holds a scroll lock while `active` is true, and always lets go when the component goes away. */
export function useScrollLock(active: boolean) {
  useEffect(() => (active ? lockScroll() : undefined), [active]);
}

/**
 * A safety net for page changes: if nothing still holds a lock, make sure the
 * page can scroll, even if something left it locked (for example the welcome
 * screen, which is taken away by the page change rather than closed).
 */
export function freeStrayScrollLock() {
  if (held > 0 || typeof document === "undefined") return;
  const root = document.documentElement;
  if (document.querySelector("dialog.gate[open]")) return;
  root.classList.remove("gate-open");
  if (root.style.overflow) root.style.overflow = "";
  if (document.body.style.overflow) document.body.style.overflow = "";
}

/** For tests. */
export function heldScrollLocks() {
  return held;
}
