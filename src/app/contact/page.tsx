import type { Metadata } from "next";
import { Accessibility, FlaskConical, Handshake, MessageSquare, Mic2 } from "lucide-react";
import { PageHero } from "@/components/layout/page-hero";
import { ContactForm } from "@/components/forms/contact-form";
import { Notice } from "@/components/ui/notice";
import { ENQUIRY_CATEGORIES, type EnquiryCategory } from "@/lib/validation/contact";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { emailConfigured } from "@/lib/email/resend";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact the INSPIRE team about the conference, speaking, workshops, research and abstracts, partnerships or accessibility.",
  alternates: { canonical: "/contact" },
};

const TOPICS: { key: EnquiryCategory; icon: typeof Mic2; body: string }[] = [
  { key: "general", icon: MessageSquare, body: "Questions about INSPIRE or the conference." },
  { key: "speakers_workshops", icon: Mic2, body: "Speaking, facilitating or workshop content." },
  { key: "research_abstracts", icon: FlaskConical, body: "Abstracts, posters and presenting." },
  { key: "partnerships", icon: Handshake, body: "Partnership and sponsorship conversations." },
  { key: "accessibility", icon: Accessibility, body: "Access requirements and adjustments." },
];

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const initial = category && category in ENQUIRY_CATEGORIES ? (category as EnquiryCategory) : undefined;
  const emailOn = emailConfigured() && Boolean(process.env.CONTACT_TO_EMAIL);
  const active = isSupabaseConfigured || emailOn;

  return (
    <>
      <PageHero eyebrow="Contact" title={<>Let&apos;s <span className="text-cyan">talk.</span></>} intro="Whether you have a question about the conference, want to get involved or need an adjustment, the INSPIRE team is here to help." />
      <section className="bg-paper py-16 sm:py-24">
        <div className="container-page grid gap-12 lg:grid-cols-12">
          <aside className="lg:col-span-4">
            <h2 className="eyebrow text-electric-600">How we can help</h2>
            <ul className="mt-6 space-y-3">
              {TOPICS.map((t) => (
                <li key={t.key} className="flex gap-4 rounded-lg border border-navy/10 bg-white p-5">
                  <t.icon aria-hidden className="mt-0.5 size-5 shrink-0 text-electric-600" />
                  <span>
                    <span className="block font-semibold text-ink">{ENQUIRY_CATEGORIES[t.key]}</span>
                    <span className="block text-sm text-slate-700">{t.body}</span>
                  </span>
                </li>
              ))}
            </ul>
            {CONTACT_EMAIL && (
              <p className="mt-6 text-slate-700">
                Or email{" "}
                <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-electric-600 underline underline-offset-4">
                  {CONTACT_EMAIL}
                </a>
              </p>
            )}
          </aside>
          <div className="rounded-xl border border-navy/10 bg-white p-6 sm:p-10 lg:col-span-8">
            {!active ? (
              <Notice tone="warning" title="The contact form is not active yet" className="mb-8">
                Message delivery has not been set up, so the form cannot be submitted yet.
              </Notice>
            ) : !emailOn ? (
              <Notice title="Email notifications are not active yet" className="mb-8">
                Messages are stored securely for the conference team to read in the admin dashboard. Email delivery has not been
                switched on, so replies may take a little longer.
              </Notice>
            ) : null}
            <ContactForm initialCategory={initial} active={active} />
          </div>
        </div>
      </section>
    </>
  );
}
