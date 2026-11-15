import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { ConfirmLinkButton } from "@/components/auth/confirm-link-button";
import { LINK_TYPES, linkCopy, safeLinkNext } from "@/lib/accounts/link-paths";
import { completeEmailLink } from "./actions";
import type { EmailOtpType } from "@supabase/supabase-js";

export const metadata: Metadata = { title: "Continue", robots: { index: false } };

type Params = { token_hash?: string; type?: string; next?: string; code?: string };

/**
 * Landing page for every emailed account link (confirm email, set up account,
 * reset password). The token is only used when the person taps the button.
 */
export default async function ConfirmPage({ searchParams }: { searchParams: Promise<Params> }) {
  const p = await searchParams;
  // A Supabase PKCE link that was sent here by mistake.
  if (p.code) redirect(`/auth/callback?code=${encodeURIComponent(p.code)}&next=${encodeURIComponent(safeLinkNext(p.next, p.type))}`);
  const type = (p.type ?? "") as EmailOtpType;
  const valid = Boolean(p.token_hash) && LINK_TYPES.includes(type);
  const next = safeLinkNext(p.next, type);
  const copy = linkCopy(type, next);

  if (!valid)
    return (
      <AuthShell title="This link is incomplete" intro="Part of the link may have been cut off by your email app.">
        <div className="space-y-3">
          <Link href="/auth/reset" className="flex min-h-12 w-full items-center justify-center rounded-[3px] bg-navy font-ui font-semibold text-paper hover:bg-navy-700">
            Send me a new password link
          </Link>
          <Link href="/auth/activate" className="flex min-h-12 w-full items-center justify-center rounded-[3px] border border-navy/20 bg-white font-ui font-semibold text-ink hover:border-navy/40">
            Set up my account again
          </Link>
        </div>
      </AuthShell>
    );

  return (
    <AuthShell title={copy.title} intro={copy.intro}>
      <form action={completeEmailLink}>
        <input type="hidden" name="token_hash" value={p.token_hash} />
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="next" value={next} />
        <ConfirmLinkButton>{copy.button}</ConfirmLinkButton>
      </form>
      <p className="mt-6 text-sm text-slate-700">
        Problems? Email <a href="mailto:inspiresoc@lincolnsu.com" className="font-semibold text-electric-600 underline underline-offset-4">inspiresoc@lincolnsu.com</a> and we&apos;ll sort it out.
      </p>
    </AuthShell>
  );
}
