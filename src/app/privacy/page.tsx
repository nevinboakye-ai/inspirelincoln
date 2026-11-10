import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/layout/legal-page";

export const metadata: Metadata = { title: "Privacy policy", alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="10 November 2026">
      <p>
        This notice explains how the INSPIRE National Medical Research Conference (&ldquo;INSPIRE&rdquo;, &ldquo;we&rdquo;) collects and uses
        personal data through this website, in line with the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018.
      </p>
      <h2>Who is responsible for your data</h2>
      <p>INSPIRE is the controller for personal data collected through this website. [Organisation to confirm the legal entity and contact details.]</p>
      <h2>What we collect and why</h2>
      <ul>
        <li><strong>Account details</strong> (name, email, institution, programme and year of study) to provide your delegate account. Lawful basis: performance of a contract / legitimate interests in running the conference.</li>
        <li><strong>Registration records</strong> and check-in status to manage attendance. Lawful basis: legitimate interests.</li>
        <li><strong>Abstract submissions</strong>, including author details and any uploaded files, to run peer review and the programme. Lawful basis: legitimate interests; publication in the public showcase only with your explicit consent.</li>
        <li><strong>Reviews</strong> written by reviewers, which are confidential to reviewers and administrators.</li>
        <li><strong>Contact enquiries</strong> to respond to you. Lawful basis: consent, which you give on the form.</li>
        <li><strong>Saved agenda items</strong> and saved opportunities, to personalise your experience.</li>
      </ul>
      <p>We do not sell personal data or use it for advertising.</p>
      <h2>Who can see it</h2>
      <p>
        Access is restricted by role and enforced in the database. Delegates see only their own data. Reviewers see only abstracts assigned
        to them. Administrators can see what they need to run the conference. Every sensitive change is recorded in an audit log.
      </p>
      <h2>Processors</h2>
      <p>
        We use Supabase (database, authentication and file storage), Vercel (website hosting) and, once enabled, Resend (email delivery).
        These providers process data on our behalf under data processing terms. [Organisation to confirm hosting regions and transfer
        safeguards.]
      </p>
      <h2>How long we keep it</h2>
      <ul>
        <li>Contact enquiries: up to 12 months after the enquiry is closed.</li>
        <li>Abstracts and reviews: up to 2 years after the conference, unless published with consent.</li>
        <li>Delegate accounts: until you delete your account or after 2 years of inactivity.</li>
      </ul>
      <p>[Organisation to confirm retention periods.]</p>
      <h2>Your rights</h2>
      <p>
        You can ask to access, correct or delete your data, object to processing, or withdraw consent at any time. You can delete your account
        from your profile settings. To exercise any right, <Link href="/contact">contact us</Link>. You can also complain to the Information
        Commissioner&apos;s Office (ico.org.uk).
      </p>
      <h2>Cookies</h2>
      <p>See our <Link href="/cookies">cookie policy</Link>.</p>
    </LegalPage>
  );
}
