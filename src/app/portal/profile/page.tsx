import { requireUser } from "@/lib/auth";
import { DeleteAccountForm, ProfileForm } from "@/components/portal/profile-forms";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const { profile } = await requireUser("/portal/profile");
  return (
    <div className="space-y-6">
      <h1 className="text-display-sm font-medium text-ink">Profile &amp; settings</h1>
      <section className="rounded-xl border border-navy/10 bg-white p-6 sm:p-8">
        <ProfileForm profile={profile} />
      </section>
      <section className="rounded-xl border border-danger/20 bg-white p-6 sm:p-8">
        <h2 className="font-display text-lg font-semibold text-ink">Delete your account</h2>
        <p className="mb-6 mt-2 text-sm text-slate-700">
          This permanently removes your account, saved agenda and profile. Abstracts you have submitted are also deleted. This cannot be undone.
        </p>
        <DeleteAccountForm />
      </section>
    </div>
  );
}
