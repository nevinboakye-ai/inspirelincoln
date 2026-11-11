import { describe, expect, it } from "vitest";
import { cleanInstagram, instagramUrl } from "@/lib/instagram";

describe("cleanInstagram", () => {
  it("accepts a username with or without @", () => {
    expect(cleanInstagram("inspire.lincoln")).toBe("inspire.lincoln");
    expect(cleanInstagram("  @inspire_lincoln ")).toBe("inspire_lincoln");
  });
  it("pulls the username out of a profile link", () => {
    expect(cleanInstagram("https://www.instagram.com/inspire.lincoln/")).toBe("inspire.lincoln");
    expect(cleanInstagram("instagram.com/inspire?igsh=abc")).toBe("inspire");
  });
  it("treats blank as removing it", () => expect(cleanInstagram("   ")).toBe(""));
  it("rejects things that aren't usernames", () => {
    for (const bad of ["two words", "a".repeat(31), "https://example.com/x", "name!", ".dot", "dot.", "a..b"]) expect(cleanInstagram(bad)).toBeNull();
  });
  it("links to the profile", () => expect(instagramUrl("inspire.lincoln")).toBe("https://www.instagram.com/inspire.lincoln/"));
});
