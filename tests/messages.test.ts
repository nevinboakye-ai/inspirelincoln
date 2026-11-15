import { describe, expect, it } from "vitest";
import { CONTACT_GROUPS, fillTemplate, headlineRole, isCommitteeRole, previewLine, type Contact } from "@/lib/messages";

const person = (roles: Contact["roles"], status: Contact["account_status"] = "approved"): Contact => ({
  id: "x", full_name: "Amy Jones", institution: null, year_of_study: null, roles, committee_position: null, avatar_path: null, account_status: status,
});

describe("messages helpers", () => {
  it("fills a template with a first name, or drops it for groups", () => {
    expect(fillTemplate("Hi {first}, please do it.", "Amy Jones")).toBe("Hi Amy, please do it.");
    expect(fillTemplate("Hi {first}, please do it.", null)).toBe("Hi, please do it.");
  });
  it("labels the most useful role", () => {
    expect(headlineRole(["delegate", "finance_team"], null)).toBe("Finance Team");
    expect(headlineRole(["executive_committee"], "Head of Logistics")).toBe("Head of Logistics");
    expect(headlineRole(["poster_presenter"], null)).toBe("Poster presenter");
    expect(headlineRole(null)).toBeNull();
  });
  it("spots the committee", () => {
    expect(isCommitteeRole(["delegate"])).toBe(false);
    expect(isCommitteeRole(["delegate", "president"])).toBe(true);
  });
  it("groups contacts for the committee's picker", () => {
    expect(CONTACT_GROUPS.delegates.match(person(["delegate"]))).toBe(true);
    expect(CONTACT_GROUPS.delegates.match(person(["oral_presenter"]))).toBe(false);
    expect(CONTACT_GROUPS.oral.match(person(["oral_presenter"]))).toBe(true);
    expect(CONTACT_GROUPS.pending.match(person(["delegate"], "pending"))).toBe(true);
    expect(CONTACT_GROUPS.committee.match(person(["academic_team"]))).toBe(true);
  });
  it("prefixes your own last message", () => {
    expect(previewLine({ last_body: "see  you\nsoon", last_from_me: true })).toBe("You: see you soon");
    expect(previewLine({ last_body: "hi", last_from_me: false })).toBe("hi");
  });
});
