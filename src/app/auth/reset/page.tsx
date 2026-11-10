import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetForm } from "@/components/auth/auth-forms";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Reset your password", robots: { index: false } };

export default function ResetPage() {
  return (
    <AuthShell title="Reset your password" intro="Enter your email and we'll send you a secure link." footer={<Link href="/login" className="font-semibold text-electric-600 underline underline-offset-4">Back to log in</Link>}>
      <ResetForm disabled={!isSupabaseConfigured} />
    </AuthShell>
  );
}
