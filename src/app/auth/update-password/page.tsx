import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { UpdatePasswordForm } from "@/components/auth/auth-forms";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default async function UpdatePasswordPage({ searchParams }: { searchParams: Promise<{ setup?: string }> }) {
  const { user } = await requireUser("/auth/update-password");
  const first = user.app_metadata?.must_change_password === true;
  const setup = (await searchParams).setup === "1";
  return (
    <AuthShell
      title={first ? "Welcome to INSPIRE" : setup ? "Choose your password" : "Choose a new password"}
      intro={
        first
          ? "You logged in with a temporary password from the committee. Please choose your own password to continue to My Hub."
          : setup
            ? "Your email is confirmed. Choose the password you'll use to log in to My Hub."
            : "You're signed in. Choose a new password to finish."
      }
    >
      <UpdatePasswordForm first={first} setup={setup} />
    </AuthShell>
  );
}
