
import type { Metadata } from "next";
import { PortalNav } from "@/components/portal/portal-nav";
import { requireUser } from "@/lib/auth";
import { getSwitches } from "@/lib/switches";
import { presenterKindOf, rolesLabel, rolesOf } from "@/lib/accounts";
import { cookies } from "next/headers";
import { ProfilePrompt } from "@/components/portal/profile-prompt";
import { PROFILE_PROMPT_COOKIE, profileGaps } from "@/lib/profile-prompt";
import { VIEW_AS_COOKIE } from "@/lib/view-as-seal";
import { signAvatar } from "@/lib/avatar";
import { unreadForMember } from "@/lib/enquiries";
import { MessagesProvider } from "@/components/messages/messages-provider";

export const metadata: Metadata = {
  title: "My conference",
  robots: { index: false },
};

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile, db } = await requireUser("/portal");

  // Ask users to finish incomplete profiles, except when viewing as someone else.
  const jar = await cookies();
  const prompting =
    jar.has(PROFILE_PROMPT_COOKIE) && !jar.has(VIEW_AS_COOKIE);

  const gaps = prompting ? profileGaps(profile) : [];

  // Everyone is asked once whether to share their email with delegates.
  const askEmail = prompting && !profile.networkEmailAsked;

  // Fetch data concurrently to reduce loading time.
  const [promptPhoto, { data: mine }, switches] = await Promise.all([
    gaps.length || askEmail
      ? signAvatar(db, profile.avatarPath)
      : null,

    // Conversations where the committee has replied since the user last checked.
    db
      .from("enquiry_threads")
      .select("last_from, last_message_at, member_read_at")
      .eq("user_id", profile.id)
      .eq("last_from", "committee")
      .limit(100),

    // Hide networking until enabled by the site owner.
    getSwitches(),
  ]);

  const unreadEnquiries = (mine ?? []).filter(unreadForMember).length;

  const showNetwork =
    profile.access.owner || switches.network_open;

  // People I've Met requires Delegate Card access and approval.
  const showPeople =
    profile.access.owner ||
    (switches.delegate_card &&
      profile.accountStatus === "approved");

  return (
    <MessagesProvider>
      <div
        data-app-shell
        className="min-h-screen bg-paper pb-28 pt-[var(--header-h)] lg:pb-24 lg:pt-28"
      >
        <div className="container-page grid gap-4 lg:grid-cols-[15rem_1fr] lg:gap-12">
          <PortalNav
            name={profile.fullName ?? profile.email}
            typeLabel={rolesLabel(
              rolesOf(profile.accountType, profile.extraTypes)
            )}
            presenter={Boolean(presenterKindOf(profile))}
            access={profile.access}
            reviewer={profile.siteRole === "reviewer"}
            showNetwork={showNetwork}
            showPeople={showPeople}
            unreadEnquiries={unreadEnquiries}
          />

          <div className="min-w-0">{children}</div>

          {(gaps.length > 0 || askEmail) && (
            <ProfilePrompt
              gaps={gaps}
              name={profile.fullName}
              photo={promptPhoto}
              email={askEmail ? profile.email : null}
            />
          )}
        </div>
      </div>
    </MessagesProvider>
  );
}
