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
      intro="For anyone not on the selected delegate list. The committee reviews each new account. If you were selected, log in instead."
      footer={
        <>
          Already have an account, or on the delegate list?{" "}
          <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-semibold text-electric-600 underline underline-offset-4">Log in</Link>
        </>
      }
    >
      <RegisterForm next={next} disabled={!isSupabaseConfigured} />
    </AuthShell>
  );
}
