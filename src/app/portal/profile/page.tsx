import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { requireUser } from "@/lib/auth";
import {
  DeleteAccountForm,
  NeedsForm,
  PreferenceToggle,
  ProfileForm,
} from "@/components/portal/profile-forms";
import { Badge } from "@/components/ui/badge";
import { NetworkCardForm } from "@/components/portal/network";
import { ACCOUNT_STATUS_LABEL, ACCOUNT_TYPE_LABEL, hasRole } from "@/lib/accounts";
import { cardPath } from "@/lib/card";
import { CardSettings } from "@/components/card/card-settings";
import { AvatarEditor } from "@/components/portal/avatar-editor";
import { signAvatar } from "@/lib/avatar";

export const metadata: Metadata = { title: "Profile and privacy" };
export const dynamic = "force-dynamic";

const PURPOSE: Record<string, string> = {
  privacy_notice: "Read the privacy notice",
  marketing_email: "News about future events",
  special_category: "Access and dietary needs",
  photography_opt_out: "Prefers not to be photographed",
};

const box = "rounded-xl border border-navy/10 bg-white p-5 sm:p-8";

export default async function ProfilePage() {
  const { profile, db, user } = await requireUser("/portal/profile");
  const { data: consents } = await db
    .from("consent_records")
    .select("id, purpose, granted, policy_version, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);
  const s = ACCOUNT_STATUS_LABEL[profile.accountStatus];
  const photo = await signAvatar(db, profile.avatarPath);
  return (
    <div className="space-y-5 sm:space-y-6">
      <header>
        <h1 className="text-display-sm font-normal text-ink">
          Profile and privacy
        </h1>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-slate-700">
          <Badge tone="violet">{ACCOUNT_TYPE_LABEL[profile.accountType]}</Badge>
          <Badge tone={s.tone}>{s.label}</Badge>
        </p>
      </header>

      <section id="photo" className={`${box} scroll-mt-28`} aria-labelledby="photo-title">
        <h2 id="photo-title" className="font-display text-xl text-ink">
          Your photo
        </h2>
        <p className="mb-5 mt-2 text-sm text-slate-700">
          Optional. A clear photo of your face helps people find you on the day. It goes on your Delegate Card, so the committee and anyone you share your card with can see it, and on the delegate network once it opens. You can change or remove it at any time.
        </p>
        <AvatarEditor url={photo} name={profile.fullName} />
      </section>

      <section id="details" className={`${box} scroll-mt-28`} aria-labelledby="details-title">
        <h2 id="details-title" className="mb-5 font-display text-xl text-ink">
          Your details
        </h2>
        <ProfileForm profile={profile} />
      </section>

      <section
        id="bio"
        className={`${box} scroll-mt-28`}
        aria-labelledby="bio-title"
      >
        <h2 id="bio-title" className="font-display text-xl text-ink">
          Your bio
        </h2>
        <p className="mb-5 mt-2 text-sm text-slate-700">
          A few lines about you and, if you like, your LinkedIn and Instagram. Once the
          delegate network opens, other confirmed delegates will see this with
          your name, university and year. Until then, only the committee can see
          it.
        </p>
        <NetworkCardForm
          profile={{
            bio: profile.bio,
            linkedinUrl: profile.linkedinUrl,
            instagram: profile.instagram,
            networkShowEmail: profile.networkShowEmail,
            networkListed: profile.networkListed,
            email: profile.email,
          }}
        />
      </section>

      {profile.cardCode && profile.accountStatus === "approved" && (
        <section id="card" className={`${box} scroll-mt-28`} aria-labelledby="card-title">
          <h2 id="card-title" className="font-display text-xl text-ink">
            Your Delegate Card QR code
          </h2>
          <p className="mb-5 mt-2 text-sm text-slate-700">
            The QR code on the back of your Delegate Card lets other delegates see your card and save you, and lets the committee check you in on the day. It holds a private link, not your details.
          </p>
          <CardSettings
            shared={profile.cardShared}
            previewHref={cardPath(profile.cardCode)}
            presenting={hasRole(profile, "oral_presenter", "poster_presenter")}
            showsEmail={profile.networkShowEmail}
          />
        </section>
      )}

      <section
        id="needs"
        className={`${box} scroll-mt-28`}
        aria-labelledby="needs-title"
      >
        <h2 id="needs-title" className="font-display text-xl text-ink">
          Access and dietary needs
        </h2>
        <p className="mb-5 mt-2 text-sm text-slate-700">
          Optional. Because these details can say something about your health or
          beliefs, we only keep them with your explicit permission, and only
          until the end of February 2027.{" "}
          <Link
            href="/privacy#special"
            className="font-medium text-electric-600 underline underline-offset-4"
          >
            Why we ask
          </Link>
        </p>
        <NeedsForm
          accessibility={profile.accessibilityNeeds ?? ""}
          dietary={profile.dietaryRequirements ?? ""}
        />
      </section>

      <section className={box} aria-labelledby="choices">
        <h2 id="choices" className="font-display text-xl text-ink">
          Your choices
        </h2>
        <div className="mt-2 divide-y divide-navy/10">
          <PreferenceToggle
            purpose="marketing_email"
            value={profile.marketingOptIn}
            label="Email me about future INSPIRE events"
            description="A few emails a year. Practical emails about this year's conference are sent either way."
          />
          <PreferenceToggle
            purpose="photography_opt_out"
            value={profile.photoOptOut}
            label="I'd prefer not to be photographed"
            description="We'll give you a lanyard on the day so our photographers know."
          />
        </div>
      </section>

      <section className={box} aria-labelledby="data">
        <h2 id="data" className="font-display text-xl text-ink">
          Your data
        </h2>
        <p className="mt-2 text-sm text-slate-700">
          Download a copy of everything INSPIRE holds about you, in a format you
          can open or take elsewhere.
        </p>
        <a
          href="/portal/profile/export"
          className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-[3px] border border-navy/15 px-5 font-ui font-semibold text-ink hover:border-navy/40"
        >
          <Download aria-hidden className="size-4" /> Download my data
        </a>
        {(consents?.length ?? 0) > 0 && (
          <details className="mt-6">
            <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-ink">
              What you&apos;ve agreed to, and when
            </summary>
            <ul className="mt-2 divide-y divide-navy/10 text-sm">
              {consents!.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap justify-between gap-2 py-2.5"
                >
                  <span className="text-ink">
                    {PURPOSE[c.purpose] ?? c.purpose}:{" "}
                    <strong>{c.granted ? "yes" : "no"}</strong>
                  </span>
                  <span className="text-slate">
                    {new Date(c.created_at).toLocaleString("en-GB", {
                      timeZone: "Europe/London",
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}{" "}
                    · notice of {c.policy_version}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section
        className="rounded-xl border border-danger/20 bg-white p-5 sm:p-8"
        aria-labelledby="delete"
      >
        <h2 id="delete" className="font-display text-xl text-ink">
          Delete your account
        </h2>
        <p className="mb-6 mt-2 text-sm text-slate-700">
          This permanently deletes your account, Delegate Card, agenda, details
          and any slides or posters you uploaded. It can&apos;t be undone.
        </p>
        <DeleteAccountForm />
      </section>
    </div>
  );
}
