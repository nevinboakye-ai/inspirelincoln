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

export const metadata: Metadata = { title: "My conference", robots: { index: false } };

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { profile, db } = await requireUser("/portal");
  // Just signed in with an unfinished profile: ask them to finish it. Never while viewing as someone.
  const jar = await cookies();
  const gaps = jar.has(PROFILE_PROMPT_COOKIE) && !jar.has(VIEW_AS_COOKIE) ? profileGaps(profile) : [];
  const promptPhoto = gaps.length ? await signAvatar(db, profile.avatarPath) : null;
  // Conversations where the committee has replied since they last looked.
  const { data: mine } = await db.from("enquiry_threads").select("last_from, last_message_at, member_read_at").eq("user_id", profile.id).eq("last_from", "committee").limit(100);
  const unreadEnquiries = (mine ?? []).filter(unreadForMember).length;
  // The network stays out of the menu entirely until the owner opens it.
  const switches = await getSwitches();
  const showNetwork = profile.access.owner || switches.network_open;
  // People I've met follows the Delegate Card, which carries the QR code.
  const showPeople = profile.access.owner || (switches.delegate_card && profile.accountStatus === "approved");
  return (
    <div className="min-h-screen bg-paper pb-28 pt-24 sm:pt-28 lg:pb-24">
      <div className="container-page grid gap-5 lg:grid-cols-[15rem_1fr] lg:gap-12">
        <PortalNav
          name={profile.fullName ?? profile.email}
          typeLabel={rolesLabel(rolesOf(profile.accountType, profile.extraTypes))}
          presenter={Boolean(presenterKindOf(profile))}
          access={profile.access}
          reviewer={profile.siteRole === "reviewer"}
          showNetwork={showNetwork}
          showPeople={showPeople}
          unreadEnquiries={unreadEnquiries}
        />
        <div className="min-w-0">{children}</div>
        {gaps.length > 0 && <ProfilePrompt gaps={gaps} name={profile.fullName} photo={promptPhoto} />}
      </div>
    </div>
  );
}
