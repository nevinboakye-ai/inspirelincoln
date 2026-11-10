import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { UpdatePasswordForm } from "@/components/auth/auth-forms";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default async function UpdatePasswordPage() {
  const { user } = await requireUser("/auth/update-password");
  const first = user.app_metadata?.must_change_password === true;
  return (
    <AuthShell
      title={first ? "Welcome to INSPIRE" : "Choose a new password"}
      intro={first ? "You logged in with a temporary password from the committee. Please choose your own password to continue to My Hub." : undefined}
    >
      <UpdatePasswordForm first={first} />
    </AuthShell>
  );
}
