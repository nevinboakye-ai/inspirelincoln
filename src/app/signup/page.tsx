import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignUpForm } from "@/components/auth/auth-forms";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Create an account", robots: { index: false } };

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next = "/portal" } = await searchParams;
  return (
    <AuthShell
      title="Create your account"
      intro="An account keeps your agenda in sync and lets you follow your registration and presentations. Creating one does not register you for the conference."
      footer={
        <>
          Already have an account?{" "}
          <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-semibold text-electric-600 underline underline-offset-4">Sign in</Link>
        </>
      }
    >
      <SignUpForm next={next} disabled={!isSupabaseConfigured} />
    </AuthShell>
  );
}
