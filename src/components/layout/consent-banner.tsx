"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

const KEY = "inspire-consent-v1";
export type Consent = { analytics: boolean; decidedAt: string };

/** Returns the visitor's optional-cookie choice, or null if undecided. */
export function readConsent(): Consent | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Consent) : null;
  } catch {
    return null;
  }
}

/**
 * The site currently sets essential cookies only (sign-in sessions), so no
 * banner is shown. If optional analytics are ever enabled via
 * NEXT_PUBLIC_OPTIONAL_COOKIES=true, this banner asks for consent first and any
 * analytics code must check readConsent()?.analytics before loading.
 */
export function ConsentBanner() {
  const enabled = process.env.NEXT_PUBLIC_OPTIONAL_COOKIES === "true";
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (enabled && !readConsent()) setVisible(true);
  }, [enabled]);

  if (!visible) return null;
  const decide = (analytics: boolean) => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ analytics, decidedAt: new Date().toISOString() }));
    } catch {}
    setVisible(false);
  };
  return (
    <div role="region" aria-label="Cookie preferences" className="fixed inset-x-4 bottom-4 z-[70] mx-auto max-w-2xl rounded-lg border border-white/10 bg-navy p-5 text-paper shadow-2xl sm:p-6">
      <p className="font-display text-lg font-medium">Your cookie choices</p>
      <p className="mt-2 text-sm leading-relaxed text-paper/70">
        We use essential cookies to keep you signed in. With your permission we would also use optional analytics cookies to
        understand how the site is used. See our <Link href="/cookies" className="text-cyan underline underline-offset-4">cookie policy</Link>.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" onClick={() => decide(true)} className="min-h-11 rounded-[3px] bg-cyan px-5 text-sm font-semibold text-midnight">
          Accept optional cookies
        </button>
        <button type="button" onClick={() => decide(false)} className="min-h-11 rounded-[3px] border border-white/25 px-5 text-sm font-semibold">
          Essential only
        </button>
      </div>
    </div>
  );
}
