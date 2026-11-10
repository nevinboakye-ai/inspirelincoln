import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ActivateForm } from "@/components/auth/auth-forms";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Set up your account", robots: { index: false } };

export default function ActivatePage() {
  return (
    <AuthShell
      title="Set up your account"
      intro="For delegates and presenters the committee has selected. Use the email you applied with and your place is confirmed straight away."
      footer={
        <>
          Already set up?{" "}
          <Link href="/login" className="font-semibold text-electric-600 underline underline-offset-4">Log in</Link>
          <span className="mt-2 block">
            Not on the delegate list?{" "}
            <Link href="/signup" className="font-semibold text-electric-600 underline underline-offset-4">Register</Link>
          </span>
        </>
      }
    >
      <ActivateForm disabled={!isSupabaseConfigured} />
    </AuthShell>
  );
}
