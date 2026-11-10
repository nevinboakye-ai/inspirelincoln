"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const CommandPalette = dynamic(() => import("./command-palette").then((m) => m.CommandPalette), { ssr: false });

export function openCommandPalette() {
  window.dispatchEvent(new CustomEvent("inspire:search"));
}

const isShortcut = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement;
  const typing = t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName);
  return (e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing);
};

/**
 * Loads the search box only when someone first asks for it, so its code
 * isn't downloaded on every page. Once loaded, the search box handles its own shortcuts.
 */
export function SearchLauncher() {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (loaded) return;
    const onKey = (e: KeyboardEvent) => {
      if (!isShortcut(e)) return;
      e.preventDefault();
      setLoaded(true);
    };
    const onOpen = () => setLoaded(true);
    // Warm it up when the browser is idle, so the first open is instant.
    const idle = "requestIdleCallback" in window ? window.requestIdleCallback(() => import("./command-palette"), { timeout: 6000 }) : 0;
    window.addEventListener("keydown", onKey);
    window.addEventListener("inspire:search", onOpen);
    return () => {
      if (idle && "cancelIdleCallback" in window) window.cancelIdleCallback(idle);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("inspire:search", onOpen);
    };
  }, [loaded]);
  return loaded ? <CommandPalette defaultOpen /> : null;
}
