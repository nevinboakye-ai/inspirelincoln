import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, EyeOff, Lock, QrCode, Settings } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { CARD_CODE, cardPath, cleanCode, type CardLookup } from "@/lib/card";
import { ContactCard } from "@/components/card/contact-card";
import { signAvatar } from "@/lib/avatar";
import { getLogoMap } from "@/lib/university-logos-server";
import { uniKey } from "@/lib/university-logos";
import { CheckInPanel, SaveContact } from "@/components/card/card-actions";

export const metadata: Metadata = { title: "Delegate Card", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

const linkBtn = "inline-flex min-h-12 items-center justify-center gap-2 rounded-[3px] px-5 font-ui text-sm font-semibold";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper pb-24 pt-24 sm:pt-32">
      <div className="mx-auto w-full max-w-xl space-y-5 px-4 sm:px-6">{children}</div>
    </div>
  );
}

/** A plain message card, used whenever there's nothing about the person to show. */
function Message({ icon: Icon, title, children, actions }: { icon: typeof Lock; title: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-navy/10 bg-white">
      <div className="relative overflow-hidden bg-midnight px-6 py-7 text-paper sm:px-8">
        <div aria-hidden className="lanyard-grid pointer-events-none absolute inset-0 opacity-20" />
        <div className="relative flex items-center gap-3">
          <img src="/brand/conference-mark-white.png" alt="" aria-hidden className="h-10 w-auto" />
          <p className="eyebrow text-gold">INSPIRE Delegate Card</p>
        </div>
      </div>
      <div className="px-6 py-7 sm:px-8">
        <Icon aria-hidden className="size-8 text-electric-600" />
        <h1 className="mt-3 font-display text-2xl text-ink">{title}</h1>
        <div className="mt-2 space-y-3 leading-relaxed text-slate-700">{children}</div>
        {actions && <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">{actions}</div>}
      </div>
    </section>
  );
}

/**
 * What you see after scanning someone's Delegate Card. Confirmed delegates see
 * what the person shares and can save them; check-in staff also get a button
 * to check them in. Nothing about the person is shown to anyone else.
 */
export default async function CardPage({ params }: { params: Promise<{ code: string }> }) {
  const code = cleanCode((await params).code);
  if (!CARD_CODE.test(code)) notFound();
  const current = await getCurrentUser();

  if (!current) {
    const next = encodeURIComponent(cardPath(code));
    return (
      <Shell>
        <Message
          icon={QrCode}
          title="You've scanned an INSPIRE Delegate Card"
          actions={
            <>
              <Link href={`/login?next=${next}`} className={`${linkBtn} bg-navy text-paper hover:bg-navy-700`}>
                Log in to see who this is <ArrowRight aria-hidden className="size-4" />
              </Link>
              <Link href="/" className={`${linkBtn} border border-navy/15 bg-white text-ink hover:border-navy/40`}>
                About INSPIRE
              </Link>
            </>
          }
        >
          <p>Log in to My Hub to see their details and save them to People I&apos;ve met. Cards can only be seen by confirmed delegates, so nothing about them is shown here.</p>
        </Message>
      </Shell>
    );
  }

  const { data, error } = await current.db.rpc("card_lookup", { code });
  const res = (data ?? { state: "unknown" }) as CardLookup;
  if (res.card?.avatar_path) res.card.avatar_url = await signAvatar(current.db, res.card.avatar_path);
  if (res.card?.institution) res.card.uni_logo_url = (await getLogoMap())[uniKey(res.card.institution)] ?? null;
  const desk = res.checkin ? <CheckInPanel info={res.checkin} /> : null;

  if (error) {
    return (
      <Shell>
        <Message icon={Lock} title="Cards aren't available just now">
          <p>Please try again in a moment.</p>
        </Message>
      </Shell>
    );
  }

  if (res.state === "self" && res.card) {
    return (
      <Shell>
        {desk}
        <div className="rounded-xl border border-gold/40 bg-gold/10 px-5 py-4 text-sm text-ink">
          <p>
            <strong>This is your card.</strong>{" "}
            {res.shared ? "This is exactly what other confirmed delegates see when they scan it." : "Sharing is off, so people who scan it see nothing about you. Only you can see this."}
          </p>
          <Link href="/portal/profile#card" className="mt-2 inline-flex min-h-11 items-center gap-1.5 font-semibold text-electric-600 underline-offset-4 hover:underline">
            <Settings aria-hidden className="size-4" /> Change what you share
          </Link>
        </div>
        <ContactCard card={res.card} eyebrow="Your Delegate Card" />
      </Shell>
    );
  }

  if (res.state === "ok" && res.card) {
    return (
      <Shell>
        {desk}
        <ContactCard card={res.card} eyebrow="Met at INSPIRE">
          <SaveContact code={code} card={res.card} saved={Boolean(res.saved)} note={res.note ?? null} />
        </ContactCard>
        <p className="px-1 text-center text-xs leading-relaxed text-slate-700">
          They chose what&apos;s shown here. Please only use their details to keep in touch about INSPIRE and your work together.
        </p>
      </Shell>
    );
  }

  const messages: Record<string, { icon: typeof Lock; title: string; body: React.ReactNode; actions?: React.ReactNode }> = {
    hidden: {
      icon: EyeOff,
      title: "They've chosen not to share their card",
      body: <p>Their details stay private. You can still swap contact details in person.</p>,
    },
    not_member: {
      icon: Lock,
      title: "Cards open once your place is confirmed",
      body: <p>Only confirmed delegates can see each other&apos;s cards. Your account hasn&apos;t been confirmed yet.</p>,
      actions: (
        <Link href="/portal" className={`${linkBtn} bg-navy text-paper hover:bg-navy-700`}>
          Go to My Hub
        </Link>
      ),
    },
    cards_off: {
      icon: Lock,
      title: "Delegate Cards aren't live yet",
      body: <p>You&apos;ll be able to see each other&apos;s cards closer to the conference.</p>,
    },
    unknown: {
      icon: QrCode,
      title: "We don't recognise this code",
      body: <p>The card may have been given a new code. Ask them to show you the card in their My Hub.</p>,
    },
  };
  const m = messages[res.state] ?? messages.unknown;
  return (
    <Shell>
      {desk}
      <Message icon={m.icon} title={m.title} actions={m.actions}>
        {m.body}
      </Message>
    </Shell>
  );
}
