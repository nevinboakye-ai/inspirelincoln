import { describe, expect, it } from "vitest";
import { cardRoles, formatCode, parseScan, toVCard, type CardData } from "@/lib/card";

describe("parseScan", () => {
  const code = "jb7gghfkisprz6sa";
  it("reads a card link from any host", () => {
    expect(parseScan(`https://inspirelincoln.uk/m/${code}`)).toEqual({ kind: "card", code });
    expect(parseScan(`http://localhost:3100/m/${code}?x=1`)).toEqual({ kind: "card", code });
  });
  it("reads a typed code with spaces and capitals", () => {
    expect(parseScan("JB7G GHFK ISPR Z6SA")).toEqual({ kind: "card", code });
  });
  it("still reads older check-in codes", () => {
    expect(parseScan("INSPIRE-CHECKIN:0f8b2c1e-1234-4abc-8def-0123456789ab")).toEqual({ kind: "ticket", token: "0f8b2c1e-1234-4abc-8def-0123456789ab" });
  });
  it("rejects anything else", () => {
    expect(parseScan("hello")).toBeNull();
    expect(parseScan("https://example.com/m/short")).toBeNull();
    expect(parseScan("https://example.com/other")).toBeNull();
    // 0, 1, l and o are never in a code.
    expect(parseScan("lo01lo01lo01lo01")).toBeNull();
  });
});

describe("card helpers", () => {
  it("spaces codes for reading aloud", () => {
    expect(formatCode("jb7gghfkisprz6sa")).toBe("JB7G GHFK ISPR Z6SA");
  });
  const card: CardData = {
    id: "x",
    full_name: "Ada Lovelace",
    institution: "Lincoln Medical School",
    year_of_study: "Year 3",
    roles: ["poster_presenter", "academic_team"],
    committee_position: "Academic Lead",
    bio: null,
    linkedin_url: null,
    email: null,
    presentation_title: null,
  };
  it("labels roles most senior first, using the committee position", () => {
    expect(cardRoles(card)).toEqual(["Academic Lead", "Poster presenter"]);
  });
  it("makes a vCard with only what is shared, escaping text", () => {
    const v = toVCard({ ...card, institution: "Lincoln, UK" }, "Met; at posters");
    expect(v).toContain("FN:Ada Lovelace");
    expect(v).toContain("N:Lovelace;Ada;;;");
    expect(v).toContain("ORG:Lincoln\\, UK");
    expect(v).toContain("NOTE:Met at INSPIRE. Met\\; at posters");
    expect(v).not.toContain("EMAIL");
  });
});
