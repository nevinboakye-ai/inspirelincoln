import type { Metadata } from "next";
import { LegalPage } from "@/components/layout/legal-page";
import Link from "next/link";

export const metadata: Metadata = { title: "Cookie policy", alternates: { canonical: "/cookies" } };

export default function CookiesPage() {
  return (
    <LegalPage title="Cookie policy" updated="11 November 2026">
      <p>This website uses only what it needs to work. We do not use advertising or analytics cookies. We count visits without cookies or any other storage on your device; the <Link href="/privacy#what">privacy notice</Link> explains how.</p>
      <h2>Essential cookies</h2>
      <p>
        When you sign in, our authentication provider (Supabase) sets cookies that keep you signed in securely. These are strictly necessary
        and do not require consent. Signing in also sets a small cookie, for up to 12 hours, that lets My Hub remind you once to finish your
        profile. It holds no personal details and is removed as soon as you see the reminder.
      </p>
      <h2>Local storage</h2>
      <p>
        If you save sessions to your agenda without signing in, the list is stored in your browser&apos;s local storage so it is there next time
        you visit. It never leaves your device unless you sign in. We also remember, for the rest of your visit only, that you have seen
        the welcome screen. You can clear both at any time from your browser settings.
      </p>
      <h2>Optional cookies</h2>
      <p>
        We do not currently use optional cookies. If that changes, we will ask for your consent first, and you will be able to change your
        choice at any time.
      </p>
    </LegalPage>
  );
}
