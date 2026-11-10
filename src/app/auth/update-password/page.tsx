import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { UpdatePasswordForm } from "@/components/auth/auth-forms";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default async function UpdatePasswordPage() {
  await requireUser("/auth/update-password");
  return (
    <AuthShell title="Choose a new password">
      <UpdatePasswordForm />
    </AuthShell>
  );
}
