import "server-only";
import { cache } from "react";
import type { Profile, requireUser } from "@/lib/auth";
import { getSwitches } from "@/lib/switches";

type SupabaseClient = Awaited<ReturnType<typeof requireUser>>["db"];

export type PostConference = {
  /** False until the post-conference setup file has been run. */
  ready: boolean;
  /** The "Post-conference hub" switch. */
  open: boolean;
  /** Shown the hub and the gallery in their menu. */
  member: boolean;
  /** Has given feedback this year. */
  done: boolean;
  /** Must give feedback before using My Hub (see PostConferenceGate). */
  required: boolean;
  /** Moderates the gallery. */
  moderator: boolean;
};

/**
 * Where the signed-in person stands with the post-conference hub. Everyone
 * with an approved account gives feedback once it opens. The site owner is
 * never held up by it (they need to see everything) but can still give it.
 */
export const getPostConference = cache(async (db: SupabaseClient, profile: Profile): Promise<PostConference> => {
  const switches = await getSwitches();
  const moderator = profile.access.owner || profile.access.can.moderate_gallery;
  const open = switches.post_conference;
  const member = profile.accountStatus === "approved" || profile.access.owner;
  const none = { ready: false, open, member: false, done: false, required: false, moderator };
  if (!open && !profile.access.owner) return none;
  const { data, error } = await db.rpc("gave_feedback");
  if (error) return { ...none, member: profile.access.owner };
  const done = data === true;
  return {
    ready: true,
    open,
    member: member && (open || profile.access.owner),
    done,
    required: open && profile.accountStatus === "approved" && !profile.access.owner && !done,
    moderator,
  };
});
