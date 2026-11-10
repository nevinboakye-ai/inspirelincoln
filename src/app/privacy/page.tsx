import type { Metadata } from "next";
import Link from "next/link";
import { Download, Eye, FileX2, Lock, Mail, PencilLine, ShieldCheck, Trash2 } from "lucide-react";
import { PageHero } from "@/components/layout/page-hero";
import { CONTACT_EMAIL } from "@/lib/site";
import { POLICY_VERSION } from "@/lib/accounts";

export const metadata: Metadata = {
  title: "Privacy notice",
  description: "How INSPIRE collects, uses and protects your personal data, and your rights under UK GDPR.",
  alternates: { canonical: "/privacy" },
};

const UPDATED = "11 November 2026";
const REGION = process.env.NEXT_PUBLIC_DATA_REGION?.trim() || null;

const PURPOSES: { what: string; why: string; basis: string; kept: string }[] = [
  {
    what: "Account details: name, email, password (stored only as a secure hash), university, stage, course, and the account type you choose",
    why: "To create your account, check who is attending and give you the right access",
    basis: "Contract: we need these details to provide the account and your place at the conference",
    kept: "Until you delete your account, or 12 months after the conference if it isn't used again",
  },
  {
    what: "Committee position or presentation title",
    why: "So the executive committee can confirm your role before switching on committee or presenter access",
    basis: "Contract",
    kept: "As for your account",
  },
  {
    what: "Account review: the decision (approved, waitlisted or declined), any note to you, and who made it",
    why: "To manage places fairly, run the waitlist and keep an accountable record",
    basis: "Legitimate interests in running a fair, well organised event",
    kept: "As for your account",
  },
  {
    what: "The selected delegate list: name, email, university, year and any accepted presentation, taken from the application you made to your society or medical school",
    why: "So the people the committee selected are approved straight away when they set up their account",
    basis: "Legitimate interests in running the conference for the people who applied and were selected",
    kept: "Until 31 March 2027, then deleted",
  },
  {
    what: "Your delegate network card: the bio and LinkedIn link you add, and whether to show your email",
    why: "So confirmed delegates can find each other before and after the conference",
    basis: "Legitimate interests for your name, university and year; your choice for everything else. You can hide your card at any time",
    kept: "As for your account",
  },
  {
    what: "Your Delegate Card and check-in time",
    why: "To let you in on the day and know who is in the building in an emergency",
    basis: "Contract, and legitimate interests in safety",
    kept: "Until 31 March 2027",
  },
  {
    what: "Slides, posters and the feedback on them",
    why: "So the committee can review your work, give feedback and run your session",
    basis: "Contract",
    kept: "Until 31 March 2027, then deleted. Feedback is deleted with the file",
  },
  {
    what: "Access and dietary needs",
    why: "To make arrangements for you on the day",
    basis: "Your explicit consent (Article 9(2)(a)), which you can withdraw at any time",
    kept: "Until 28 February 2027, or straight away if you withdraw consent",
  },
  {
    what: "Your photography preference",
    why: "So our photographers know not to photograph you",
    basis: "Legitimate interests in respecting your wishes",
    kept: "As for your account",
  },
  {
    what: "News about future INSPIRE events",
    why: "To tell you about future conferences",
    basis: "Your consent, only if you tick the box. You can stop at any time",
    kept: "Until you withdraw consent or delete your account",
  },
  {
    what: "Messages you send through the contact form",
    why: "To reply to you",
    basis: "Legitimate interests in answering enquiries",
    kept: "12 months after the enquiry is closed",
  },
  {
    what: "A record of what you agreed to, with the date and the version of this notice",
    why: "To show we have your consent where the law requires it",
    basis: "Legal obligation (UK GDPR Article 7(1))",
    kept: "As long as the consent it relates to, plus 12 months",
  },
  {
    what: "A security log of changes made through the committee dashboard",
    why: "To keep your data safe and find out what happened if something goes wrong",
    basis: "Legitimate interests in security, and our duty to keep data secure",
    kept: "24 months",
  },
];

const PROCESSORS: { name: string; does: string; where: string }[] = [
  { name: "Supabase", does: "Database, sign-in and private file storage", where: REGION ? `${REGION}` : "The region chosen for our project, shown here once confirmed" },
  { name: "Vercel", does: "Hosts the website", where: "USA, with public pages cached worldwide" },
  { name: "Resend", does: "Sends our emails, including sign-up and password emails", where: "USA" },
  { name: "Microsoft", does: "Shows PowerPoint and Word slides to committee reviewers who choose to preview them, using a private link that expires within 30 minutes", where: "EU and USA" },
  { name: "CARTO and OpenStreetMap", does: "Map images on the campus map. They receive your IP address when the map loads", where: "EU and USA" },
];

const RIGHTS: { icon: typeof Eye; title: string; body: React.ReactNode }[] = [
  { icon: Eye, title: "See your data", body: <>Download a copy of everything we hold from <Link href="/portal/profile#data">Profile and privacy</Link>, or ask us for it.</> },
  { icon: PencilLine, title: "Correct it", body: <>Edit your details in <Link href="/portal/profile">your account</Link> at any time, or ask us to fix anything you can&apos;t change.</> },
  { icon: Trash2, title: "Delete it", body: <>Delete your account yourself from <Link href="/portal/profile#delete">Profile and privacy</Link>. Everything linked to it goes too.</> },
  { icon: Download, title: "Take it elsewhere", body: <>The download is a standard JSON file you can open or give to another organisation.</> },
  { icon: FileX2, title: "Object or restrict", body: <>Ask us to stop using your data, or pause using it while a concern is looked into.</> },
  { icon: ShieldCheck, title: "Withdraw consent", body: <>Switch off news emails or remove your access needs in your account. This doesn&apos;t affect anything before you withdrew.</> },
];

export default function PrivacyPage() {
  const contact = CONTACT_EMAIL ? (
    <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
  ) : (
    <Link href="/contact">our contact form</Link>
  );

  return (
    <>
      <PageHero eyebrow="Your data" title="Privacy notice" intro={`How INSPIRE uses your personal data, and the choices you have. Last updated ${UPDATED}.`} />

      <section className="bg-paper pb-20 pt-10 sm:pb-24 sm:pt-14">
        <div className="container-narrow">
          {/* At a glance */}
          <div className="rounded-[3px] border border-navy/10 bg-white p-6 sm:p-8">
            <h2 className="font-display text-2xl text-ink">The short version</h2>
            <ul className="mt-5 grid gap-4 text-[0.95rem] leading-relaxed text-slate-700 sm:grid-cols-2">
              <li className="flex gap-3"><Lock aria-hidden className="mt-1 size-4 shrink-0 text-electric-600" /> We only ask for what we need to run your account and the conference.</li>
              <li className="flex gap-3"><Eye aria-hidden className="mt-1 size-4 shrink-0 text-electric-600" /> Only the INSPIRE committee can see your account, and each member sees only what their role needs. Other confirmed delegates see just your network card, which you control.</li>
              <li className="flex gap-3"><ShieldCheck aria-hidden className="mt-1 size-4 shrink-0 text-electric-600" /> We never sell your data, and we don&apos;t use advertising or tracking cookies.</li>
              <li className="flex gap-3"><Trash2 aria-hidden className="mt-1 size-4 shrink-0 text-electric-600" /> You can download or delete your data yourself, at any time.</li>
            </ul>
          </div>

          <nav aria-label="On this page" className="mt-10">
            <p className="font-ui text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate">On this page</p>
            <ol className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              {[
                ["who", "Who we are"],
                ["what", "What we collect, why, and for how long"],
                ["special", "Access and dietary needs"],
                ["see", "Who can see your data"],
                ["processors", "Companies that help us"],
                ["transfers", "Data outside the UK"],
                ["security", "Keeping it safe"],
                ["rights", "Your rights"],
                ["cookies", "Cookies and storage"],
                ["complain", "Questions and complaints"],
              ].map(([id, label], i) => (
                <li key={id}>
                  <a href={`#${id}`} className="flex min-h-10 items-center gap-3 text-ink underline-offset-4 hover:underline">
                    <span className="w-5 font-display text-slate">{i + 1}</span> {label}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="prose-inspire mt-12">
            <h2 id="who">1. Who we are</h2>
            <p>
              INSPIRE National Medical Research Conference (&ldquo;INSPIRE&rdquo;, &ldquo;we&rdquo;) is organised by a committee of students at Lincoln
              Medical School. The INSPIRE committee decides how and why your personal data is used, so it is the <strong>controller</strong> under
              the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018.
            </p>
            <p>For anything about your data, contact the committee through {contact}. We&apos;ll reply within one month.</p>

            <h2 id="what">2. What we collect, why, and for how long</h2>
            <p>
              Every use of your data needs a lawful basis. Here is each thing we collect, what we use it for, the basis we rely on, and when we delete
              it. When we rely on legitimate interests, we have checked that our use is necessary and doesn&apos;t override your rights.
            </p>
          </div>

          <div className="mt-6 space-y-3">
            {PURPOSES.map((p) => (
              <article key={p.what} className="rounded-[3px] border border-navy/10 bg-white p-5">
                <h3 className="font-display text-lg leading-snug text-ink">{p.what}</h3>
                <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                  <div><dt className="font-ui text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate">Why</dt><dd className="mt-1 text-slate-700">{p.why}</dd></div>
                  <div><dt className="font-ui text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate">Lawful basis</dt><dd className="mt-1 text-slate-700">{p.basis}</dd></div>
                  <div><dt className="font-ui text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate">Kept until</dt><dd className="mt-1 text-slate-700">{p.kept}</dd></div>
                </dl>
              </article>
            ))}
          </div>

          <div className="prose-inspire mt-12">
            <p>
              We don&apos;t make decisions about you by automated means alone. Every account is reviewed by a person. We don&apos;t collect data from
              anyone else about you, except a committee member updating your account type if you&apos;ve been accepted to present.
            </p>
            <p>The conference is for adults. Please don&apos;t register if you are under 18.</p>

            <h2 id="special">3. Access and dietary needs</h2>
            <p>
              Details about access or diet can reveal something about your health or religious beliefs. UK GDPR calls this <strong>special category
              data</strong> and protects it more strongly. So:
            </p>
            <ul>
              <li>We never ask for it when you register. You can add it later from your account, only if you want to.</li>
              <li>We only store it after you tick a box giving your explicit permission, and we record when you did.</li>
              <li>Only the executive committee can see it, and we share only what&apos;s needed with the venue to make arrangements for you.</li>
              <li>You can withdraw permission in one click. The details are deleted straight away.</li>
              <li>Otherwise we delete it by 28 February 2027.</li>
            </ul>

            <h2 id="see">4. Who can see your data</h2>
            <p>Access is set by role and enforced by the database itself, not just the website:</p>
            <ul>
              <li><strong>You</strong> see everything about yourself.</li>
              <li><strong>Supporting committee members</strong> see slides and posters with the presenter&apos;s name, so they can review them. They can&apos;t see anyone&apos;s email or profile.</li>
              <li><strong>The executive committee</strong>, vice president and president see account details to review accounts, manage the waitlist and run check-in.</li>
              <li><strong>Other confirmed delegates</strong> see your name, university, year and account type on the delegate network, plus a bio, LinkedIn link or email only if you add them. You can hide yourself from the network in My Hub. People whose account isn&apos;t confirmed see nothing.</li>
            </ul>
            <p>We won&apos;t share your data with anyone else unless the law requires it, for example if the police make a valid request.</p>

            <h2 id="processors">5. Companies that help us</h2>
            <p>
              These companies run parts of the website for us. They act only on our instructions, under data processing agreements, and can&apos;t use
              your data for their own purposes.
            </p>
          </div>

          <div className="mt-6 overflow-hidden rounded-[3px] border border-navy/10 bg-white">
            <ul className="divide-y divide-navy/10">
              {PROCESSORS.map((p) => (
                <li key={p.name} className="grid gap-1 p-5 sm:grid-cols-[10rem_1fr_12rem] sm:gap-4">
                  <span className="font-semibold text-ink">{p.name}</span>
                  <span className="text-sm text-slate-700">{p.does}</span>
                  <span className="text-sm text-slate">{p.where}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="prose-inspire mt-12">
            <p>
              When you tap &ldquo;Walking directions&rdquo; on the campus map, Google Maps or Apple Maps opens and their own privacy policy applies.
            </p>

            <h2 id="transfers">6. Data outside the UK</h2>
            <p>
              Some of these companies are based in, or use servers in, the USA. Where that happens, your data is protected by the UK International Data
              Transfer Addendum to the EU Standard Contractual Clauses, or by the UK Extension to the EU-US Data Privacy Framework where the company is
              certified. You can ask us for a copy of the relevant safeguards.
            </p>

            <h2 id="security">7. Keeping it safe</h2>
            <ul>
              <li>Everything is encrypted when it travels over the internet, and stored data is encrypted at rest.</li>
              <li>Passwords are stored only as secure hashes. Nobody at INSPIRE can see your password.</li>
              <li>Slides and posters are kept in private storage. Download links expire after 30 minutes.</li>
              <li>Your Delegate Card&apos;s QR code holds a random reference number only, never your name or email.</li>
              <li>Changes made in the committee dashboard are logged, and the log records which fields changed, not their contents.</li>
            </ul>
            <p>If something goes wrong that puts your data at risk, we&apos;ll tell the Information Commissioner&apos;s Office within 72 hours where required, and tell you if there&apos;s a high risk to you.</p>
          </div>

          <h2 id="rights" className="mt-12 font-display text-3xl text-ink">8. Your rights</h2>
          <p className="mt-4 text-[1.0625rem] leading-relaxed text-slate-700">
            You have the right to the following. Most you can do yourself, straight away. For anything else, contact us and we&apos;ll respond within one
            month. It&apos;s free.
          </p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {RIGHTS.map((r) => (
              <li key={r.title} className="rounded-[3px] border border-navy/10 bg-white p-5 [&_a]:font-medium [&_a]:text-electric-600 [&_a]:underline [&_a]:underline-offset-4">
                <r.icon aria-hidden className="size-5 text-electric-600" />
                <p className="mt-3 font-semibold text-ink">{r.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-700">{r.body}</p>
              </li>
            ))}
          </ul>

          <div className="prose-inspire mt-12">
            <h2 id="cookies">9. Cookies and storage</h2>
            <p>
              We use only what the site needs to work: a sign-in cookie that keeps you logged in, and storage in your browser that remembers sessions
              you&apos;ve saved. We don&apos;t use analytics, advertising or tracking cookies, so we don&apos;t need to ask for cookie consent. Read the{" "}
              <Link href="/cookies">cookie policy</Link> for details.
            </p>

            <h2 id="complain">10. Questions and complaints</h2>
            <p>
              If you have a question or concern, please contact us first through {contact} and we&apos;ll do our best to help. You also have the right
              to complain to the Information Commissioner&apos;s Office, the UK&apos;s data protection regulator, at{" "}
              <a href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noopener noreferrer">ico.org.uk/make-a-complaint</a> or on 0303 123 1113.
            </p>

            <h2>Changes to this notice</h2>
            <p>
              If we change how we use your data, we&apos;ll update this notice and the date at the top. If a change affects something you agreed to, we&apos;ll
              tell you and ask again. This is version {POLICY_VERSION}.
            </p>
          </div>

          <p className="mt-12 flex items-center gap-2 border-t border-navy/10 pt-6 text-sm text-slate">
            <Mail aria-hidden className="size-4" /> Have an account? <Link href="/portal/profile" className="font-medium text-electric-600 underline underline-offset-4">Manage your data and choices</Link>
          </p>
        </div>
      </section>
    </>
  );
}
