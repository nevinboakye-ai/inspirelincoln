/** Who is in the audience for the oral presentations, by group. */
export const AUDIENCE_GROUPS = ["delegate", "poster", "committee", "judge", "speaker"] as const;
export type AudienceGroup = (typeof AUDIENCE_GROUPS)[number];
export type AudiencePerson = { key: string; hasAccount: boolean; name: string; institution: string | null; group: AudienceGroup };

export const AUDIENCE_GROUP_LABEL: Record<AudienceGroup, { one: string; many: string }> = {
  delegate: { one: "Delegate", many: "Delegates" },
  poster: { one: "Poster presenter", many: "Poster presenters" },
  committee: { one: "Committee", many: "Committee members" },
  judge: { one: "Judge", many: "Judges" },
  speaker: { one: "Speaker", many: "Speakers" },
};

/** Included in a random split unless the committee says otherwise. */
export const AUDIENCE_DEFAULT_GROUPS: AudienceGroup[] = ["delegate", "poster"];
