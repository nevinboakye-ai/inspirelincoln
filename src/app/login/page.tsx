import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/auth-forms";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Log in", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next = "/portal", error } = await searchParams;
  return (
    <AuthShell
      title="Log in to My Hub"
      intro={error === "link" ? "That link has expired or was already used. Please log in, or request a new link." : "Your Delegate Card, agenda, presentation and the delegate network."}
      footer={
        <>
          Not on the delegate list?{" "}
          <Link href={`/signup?next=${encodeURIComponent(next)}`} className="font-semibold text-electric-600 underline underline-offset-4">
            Register
          </Link>{" "}
          and the committee will review your account.
        </>
      }
    >
      <SignInForm next={next} disabled={!isSupabaseConfigured} />
      <Link
        href="/auth/activate"
        className="group mt-6 flex items-center justify-between gap-4 rounded-[3px] border border-navy/15 bg-white p-4 text-sm transition-colors hover:border-navy/40"
      >
        <span>
          <span className="block font-semibold text-ink">First time logging in?</span>
          <span className="mt-0.5 block text-slate-700">If you were selected, set up your password with the email you applied with.</span>
        </span>
        <ArrowRight aria-hidden className="size-4 shrink-0 text-electric-600 transition-transform group-hover:translate-x-1" />
      </Link>
    </AuthShell>
  );
}
