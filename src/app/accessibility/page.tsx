import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/layout/legal-page";

export const metadata: Metadata = { title: "Accessibility statement", alternates: { canonical: "/accessibility" } };

export default function AccessibilityPage() {
  return (
    <LegalPage title="Accessibility statement" updated="10 November 2026">
      <p>We want everyone to be able to use this website and take part in INSPIRE. The site is designed to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA.</p>
      <h2>What we have done</h2>
      <ul>
        <li>Semantic HTML, a logical heading structure and landmarks, with a skip link to the main content.</li>
        <li>Everything can be used with a keyboard, with clearly visible focus indicators.</li>
        <li>Text and interface colours are chosen to meet contrast requirements.</li>
        <li>Forms have visible labels, clear error messages and announcements for screen readers.</li>
        <li>Animations respect your device&apos;s &ldquo;reduce motion&rdquo; setting, with static alternatives.</li>
        <li>Dialogs, menus and the image viewer manage focus and can be closed with Escape.</li>
        <li>Pages work at 200% zoom and on small screens without horizontal scrolling.</li>
      </ul>
      <h2>Known limitations</h2>
      <p>Some content, such as uploaded posters supplied as PDFs, may not be fully accessible. Please contact us if you need any content in another format.</p>
      <h2>Feedback</h2>
      <p>
        If you find a problem or need help, please <Link href="/contact?category=accessibility">send an accessibility enquiry</Link>. We aim to reply
        within five working days.
      </p>
      <h2>At the conference</h2>
      <p>For access requirements at the venue, please contact us as early as possible so we can make arrangements.</p>
    </LegalPage>
  );
}
