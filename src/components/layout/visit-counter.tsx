"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Pages that aren't counted: committee tools, sign-in plumbing and "view as". */
const SKIP = /^\/(admin|review|view-as|auth|api)(\/|$)/;

/**
 * Counts a page view for the site owner's metrics page. No cookies and nothing
 * is stored on the device; the server keeps only a daily, anonymous count.
 * Browsers that send Do Not Track or Global Privacy Control aren't counted.
 */
export function VisitCounter() {
  const path = usePathname();
  useEffect(() => {
    if (!path || SKIP.test(path)) return;
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
    if (nav.globalPrivacyControl || nav.doNotTrack === "1") return;
    let referrer = "";
    try {
      const r = document.referrer ? new URL(document.referrer) : null;
      if (r && r.host !== location.host) referrer = r.host;
    } catch {}
    const body = JSON.stringify({ path, referrer });
    try {
      if (!navigator.sendBeacon?.("/api/hit", new Blob([body], { type: "application/json" })))
        fetch("/api/hit", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
    } catch {}
  }, [path]);
  return null;
}
