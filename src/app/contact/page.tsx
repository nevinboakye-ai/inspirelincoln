import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Mail, MessagesSquare } from "lucide-react";
import { PageHero } from "@/components/layout/page-hero";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description: "Email the INSPIRE team about the conference, speaking, workshops, research, partnerships or accessibility.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <>
      <PageHero size="sm" eyebrow="Contact" title={<>Let&apos;s <span className="text-cyan">talk.</span></>} intro="Whether you have a question about the conference, want to get involved or need an adjustment, the INSPIRE team is here to help." />
      <section className="bg-paper py-14 sm:py-20">
        <div className="container-page grid max-w-4xl gap-5 md:grid-cols-[1.4fr_1fr]">
          <div className="relative overflow-hidden rounded-2xl bg-midnight p-7 text-paper sm:p-10">
            <img src="/brand/crest-white.png" alt="" aria-hidden className="pointer-events-none absolute -bottom-10 -right-8 h-48 w-auto opacity-[0.07]" />
            <div className="relative">
              <span aria-hidden className="grid size-12 place-items-center rounded-full bg-gold/15 text-gold">
                <Mail className="size-5" />
              </span>
              <h2 className="mt-5 font-display text-3xl">Contact our email</h2>
              {CONTACT_EMAIL ? (
                <>
                  <p className="mt-3 text-paper/75">For anything about INSPIRE, email us and the team will get back to you.</p>
                  <a
                    href={`mailto:${CONTACT_EMAIL}`}
                    className="mt-6 inline-flex min-h-12 max-w-full items-center gap-2 rounded-[3px] bg-gold px-5 font-ui font-semibold text-midnight [overflow-wrap:anywhere] hover:bg-gold-300"
                  >
                    {CONTACT_EMAIL}
                  </a>
                </>
              ) : (
                <p className="mt-3 text-paper/75">Our email address will appear here shortly.</p>
              )}
            </div>
          </div>
          <div className="flex flex-col rounded-2xl border border-navy/10 bg-white p-7 sm:p-8">
            <span aria-hidden className="grid size-12 place-items-center rounded-full bg-cyan/25 text-navy">
              <MessagesSquare className="size-5" />
            </span>
            <h2 className="mt-5 font-display text-2xl text-ink">Already have an account?</h2>
            <p className="mt-3 text-slate-700">Message the committee from My Hub and keep the whole conversation in one place. We reply within 48 hours.</p>
            <Link href="/portal/enquiries" className="mt-auto inline-flex min-h-11 items-center gap-2 pt-5 font-semibold text-electric-600 hover:underline">
              Go to Enquiries <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
