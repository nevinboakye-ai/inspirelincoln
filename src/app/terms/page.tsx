import type { Metadata } from "next";
import { LegalPage } from "@/components/layout/legal-page";

export const metadata: Metadata = { title: "Terms of use", alternates: { canonical: "/terms" } };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of use" updated="10 November 2026">
      <h2>Using this website</h2>
      <p>This website provides information about INSPIRE and its conferences. Information may change; the programme and venue details are updated by the conference team.</p>
      <h2>Accounts</h2>
      <p>You are responsible for keeping your sign-in details secure. Please provide accurate information. We may suspend accounts that are misused.</p>
      <h2>Submissions</h2>
      <p>
        By submitting an abstract you confirm that the work is original, that all named authors agree to the submission and that it contains no
        identifiable patient information. Submissions are reviewed confidentially and are only published with your consent.
      </p>
      <h2>Content</h2>
      <p>Photographs and materials on this site belong to INSPIRE or their owners and may only be downloaded where permitted.</p>
      <h2>External links</h2>
      <p>We link to other websites for information and opportunities. We are not responsible for their content.</p>
      <h2>Governing law</h2>
      <p>These terms are governed by the law of England and Wales.</p>
    </LegalPage>
  );
}
