import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/auth-forms";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next = "/portal", error } = await searchParams;
  return (
    <AuthShell
      title="Sign in to My Conference"
      intro={error === "link" ? "That link has expired or was already used. Please sign in, or request a new link." : "Access your agenda, registration and presentations."}
      footer={
        <>
          New here?{" "}
          <Link href={`/signup?next=${encodeURIComponent(next)}`} className="font-semibold text-electric-600 underline underline-offset-4">
            Create an account
          </Link>
        </>
      }
    >
      <SignInForm next={next} disabled={!isSupabaseConfigured} />
    </AuthShell>
  );
}
