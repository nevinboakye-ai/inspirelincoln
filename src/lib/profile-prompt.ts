/**
 * After each sign-in, people whose profile isn't finished are asked to
 * finish it. Signing in sets a short-lived flag; the prompt shows once and
 * clears it, whichever button they choose.
 */
export const PROFILE_PROMPT_COOKIE = "inspire_profile_prompt";

export const PROFILE_PROMPT_OPTIONS = {
  path: "/",
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 12,
};

type Fields = {
  avatarPath: string | null;
  bio: string | null;
  linkedinUrl: string | null;
  institution: string | null;
  careerStage: string | null;
};

export type ProfileGap = { key: "photo" | "bio" | "linkedin" | "details"; label: string; hint: string; href: string };

/** What's still missing from someone's profile, in the order the profile page asks for it. */
export function profileGaps(p: Fields): ProfileGap[] {
  const gaps: ProfileGap[] = [];
  if (!p.avatarPath) gaps.push({ key: "photo", label: "Add a photo", hint: "So people can find you on the day", href: "/portal/profile#photo" });
  if (!p.institution?.trim() || !p.careerStage?.trim())
    gaps.push({ key: "details", label: "Your university and stage", hint: "Shown under your name on your card", href: "/portal/profile#details" });
  if (!p.bio?.trim()) gaps.push({ key: "bio", label: "Write a short bio", hint: "A few lines about you and your interests", href: "/portal/profile#bio" });
  if (!p.linkedinUrl?.trim()) gaps.push({ key: "linkedin", label: "Add your LinkedIn", hint: "So people can keep in touch afterwards", href: "/portal/profile#bio" });
  return gaps;
}

/** How many of the profile items are done, out of how many. */
export const PROFILE_ITEMS = 4;
