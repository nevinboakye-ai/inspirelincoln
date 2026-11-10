import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Register", robots: { index: false } };

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next = "/portal" } = await searchParams;
  return (
    <AuthShell
      title="Register for INSPIRE"
      intro="Three short steps. Your account holds your ticket, your agenda and, if you're presenting, your slides or poster."
      footer={
        <>
          Already registered?{" "}
          <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-semibold text-electric-600 underline underline-offset-4">Sign in</Link>
        </>
      }
    >
      <RegisterForm next={next} disabled={!isSupabaseConfigured} />
    </AuthShell>
  );
}
