import { describe, expect, it } from "vitest";
import { PROFILE_ITEMS, profileGaps } from "@/lib/profile-prompt";

const done = { avatarPath: "a/b.webp", bio: "Hello", linkedinUrl: "https://www.linkedin.com/in/x", institution: "Lincoln", careerStage: "Year 3" };

describe("profileGaps", () => {
  it("asks for nothing once the profile is finished", () => {
    expect(profileGaps(done)).toEqual([]);
  });
  it("lists every gap, photo first", () => {
    const gaps = profileGaps({ avatarPath: null, bio: null, linkedinUrl: null, institution: null, careerStage: null });
    expect(gaps.map((g) => g.key)).toEqual(["photo", "details", "bio", "linkedin"]);
    expect(gaps).toHaveLength(PROFILE_ITEMS);
  });
  it("treats blank text as missing", () => {
    expect(profileGaps({ ...done, bio: "   ", careerStage: "" }).map((g) => g.key)).toEqual(["details", "bio"]);
  });
  it("links each gap to its place on the profile page", () => {
    for (const g of profileGaps({ ...done, avatarPath: null, linkedinUrl: null })) expect(g.href).toMatch(/^\/portal\/profile#/);
  });
});
