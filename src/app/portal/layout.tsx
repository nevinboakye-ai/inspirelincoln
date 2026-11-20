
import type { Metadata } from "next";
import { PortalNav } from "@/components/portal/portal-nav";
import { requireUser } from "@/lib/auth";
import { getSwitches } from "@/lib/switches";
import { isStaffOnly, presenterKindOf, rolesLabel, rolesOf } from "@/lib/accounts";
import { cookies } from "next/headers";
import { ProfilePrompt } from "@/components/portal/profile-prompt";
import { PROFILE_PROMPT_COOKIE, profileGaps } from "@/lib/profile-prompt";
import { VIEW_AS_COOKIE } from "@/lib/view-as-seal";
import { signAvatar } from "@/lib/avatar";
import { unreadForMember } from "@/lib/enquiries";
import { MessagesProvider } from "@/components/messages/messages-provider";
import { ResearchPrompt } from "@/components/research/research-prompt";
import { RESEARCH_LATER_COOKIE, getMyResearch, needsDecision } from "@/lib/research/server";
import { STAGE_LABEL } from "@/lib/research/instrument";
import { formatWhen, windowOf } from "@/lib/research/schedule";

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
  const [promptPhoto, { data: mine }, switches, research] = await Promise.all([
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

    // The research study, if it's running and they're invited.
    getMyResearch(db, profile),
  ]);

  // The research invitation (or "your questionnaire is open"), until they
  // answer, never on top of the profile prompt or while viewing as someone.
  const researchMode =
    jar.has(VIEW_AS_COOKIE) || jar.has(RESEARCH_LATER_COOKIE) || gaps.length > 0 || askEmail
      ? null
      : needsDecision(research)
        ? ("invite" as const)
        : research.due
          ? ("due" as const)
          : null;
  const showResearch = research.eligible && (research.decision !== "declined" || research.canJoin);

  const unreadEnquiries = (mine ?? []).filter(unreadForMember).length;

  // Staff (speakers, workshop leads, judges) don't get the network list.
  const showNetwork =
    profile.access.owner || (switches.network_open && !isStaffOnly(profile.accountType, profile.extraTypes));

  // People I've Met requires Delegate Card access and approval.
  const showPeople =
    profile.access.owner ||
    (switches.delegate_card &&
      profile.accountStatus === "approved");

  // My Day is available to approved delegates and the site owner.
  const showMyDay =
    profile.accountStatus === "approved" ||
    profile.access.owner;

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
            showMyDay={showMyDay}
            showResearch={showResearch}
            unreadEnquiries={unreadEnquiries}
          />

          <div className="min-w-0">
            {children}
          </div>

          {(gaps.length > 0 || askEmail) && (
            <ProfilePrompt
              gaps={gaps}
              name={profile.fullName}
              photo={promptPhoto}
              email={askEmail ? profile.email : null}
            />
          )}

          {researchMode && (
            <ResearchPrompt
              mode={researchMode}
              href={researchMode === "due" ? `/portal/research/${research.due}` : "/portal/research"}
              closes={formatWhen(researchMode === "due" ? windowOf(research.settings, research.due!).closes : research.settings.preClosesAt)}
              stageTitle={research.due ? STAGE_LABEL[research.due].title : undefined}
              minutes={research.due ? STAGE_LABEL[research.due].minutes : undefined}
            />
          )}
        </div>
      </div>
    </MessagesProvider>
  );
}
