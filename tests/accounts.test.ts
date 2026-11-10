import { describe, expect, it } from "vitest";
import { accessFor, accessFromCaps, canApprove, effectiveRole, resolveFileType, submissionKindFor } from "@/lib/accounts";
import { effectiveFor } from "@/lib/accounts/effective";
import { escapeHtml, renderEmail } from "@/lib/email/template";
import { accountDecisionEmail } from "@/lib/email/messages";

const p = (accountType: Parameters<typeof accessFor>[0]["accountType"], accountStatus: Parameters<typeof accessFor>[0]["accountStatus"], role: Parameters<typeof accessFor>[0]["role"] = "delegate") => ({ accountType, accountStatus, role });

const flags = (a: ReturnType<typeof accessFor>) => ({ committee: a.committee, exec: a.exec, leadership: a.leadership, owner: a.owner });

describe("account access", () => {
  it("gives nothing extra until an account is approved", () => {
    expect(flags(accessFor(p("president", "pending")))).toEqual({ committee: false, exec: false, leadership: false, owner: false });
    expect(accessFor(p("executive_committee", "waitlisted")).exec).toBe(false);
  });
  it("matches each committee level by default", () => {
    expect(flags(accessFor(p("supporting_committee", "approved")))).toEqual({ committee: true, exec: false, leadership: false, owner: false });
    expect(flags(accessFor(p("executive_committee", "approved")))).toEqual({ committee: true, exec: true, leadership: false, owner: false });
    expect(flags(accessFor(p("vice_president", "approved")))).toEqual({ committee: true, exec: true, leadership: true, owner: false });
    expect(flags(accessFor(p("delegate", "approved")))).toEqual({ committee: false, exec: false, leadership: false, owner: false });
    expect(accessFor(p("supporting_committee", "approved")).can.send_email).toBe(false);
    expect(accessFor(p("executive_committee", "approved")).can.check_in).toBe(true);
  });
  it("puts the site owner above everyone", () => {
    expect(accessFor(p("president", "approved")).owner).toBe(false);
    const owner = accessFor(p("delegate", "pending", "admin"));
    expect(flags(owner)).toEqual({ committee: true, exec: true, leadership: true, owner: true });
    expect(Object.values(owner.can).every(Boolean)).toBe(true);
  });
  it("uses exactly what the database grants", () => {
    const a = accessFromCaps(["check_in"], "delegate");
    expect(a.committee).toBe(true);
    expect(a.can.check_in).toBe(true);
    expect(a.can.edit_website).toBe(false);
    expect(accessFromCaps([], "delegate").committee).toBe(false);
  });
  it("maps to the role tiers the older gates use", () => {
    expect(effectiveRole(accessFor(p("executive_committee", "approved")), "delegate")).toBe("admin");
    expect(effectiveRole(accessFor(p("supporting_committee", "approved")), "delegate")).toBe("editor");
    expect(effectiveRole(accessFor(p("oral_presenter", "approved")), "delegate")).toBe("delegate");
  });
  it("only lets leadership approve executive accounts", () => {
    const exec = accessFor(p("executive_committee", "approved"));
    const pres = accessFor(p("president", "approved"));
    expect(canApprove(exec, "executive_committee")).toBe(false);
    expect(canApprove(exec, "poster_presenter")).toBe(true);
    expect(canApprove(pres, "vice_president")).toBe(true);
  });
});

describe("individual access", () => {
  const rules = { supporting_committee: { edit_website: true } };
  it("follows the account type, then any override", () => {
    const base = effectiveFor({ role: "delegate", accountType: "supporting_committee", accountStatus: "approved" }, rules, {});
    expect(base.edit_website).toEqual({ allowed: true, source: "type" });
    const blocked = effectiveFor({ role: "delegate", accountType: "supporting_committee", accountStatus: "approved" }, rules, { edit_website: false });
    expect(blocked.edit_website.allowed).toBe(false);
  });
  it("lets an override work before approval, but never for declined accounts", () => {
    expect(effectiveFor({ role: "delegate", accountType: "delegate", accountStatus: "pending" }, rules, { check_in: true }).check_in.allowed).toBe(true);
    expect(effectiveFor({ role: "delegate", accountType: "delegate", accountStatus: "declined" }, rules, { check_in: true }).check_in.allowed).toBe(false);
  });
});

describe("submissions", () => {
  it("knows who submits what", () => {
    expect(submissionKindFor("oral_presenter")).toBe("slides");
    expect(submissionKindFor("poster_presenter")).toBe("poster");
    expect(submissionKindFor("delegate")).toBeNull();
  });
  it("accepts Keynote and PowerPoint even without a browser type", () => {
    expect(resolveFileType("slides", "Talk.key", "")).toEqual({ mime: "application/vnd.apple.keynote", ext: "key" });
    expect(resolveFileType("slides", "Talk.PPTX", "")?.ext).toBe("pptx");
    expect(resolveFileType("poster", "poster.jpeg", "")?.ext).toBe("jpg");
  });
  it("rejects the wrong kind of file", () => {
    expect(resolveFileType("poster", "talk.pptx", "")).toBeNull();
    expect(resolveFileType("slides", "virus.exe", "application/x-msdownload")).toBeNull();
  });
});

describe("emails", () => {
  it("escapes what people type", () => {
    expect(escapeHtml('<script>"x"</script>')).toBe("&lt;script&gt;&quot;x&quot;&lt;/script&gt;");
    const m = accountDecisionEmail({ siteUrl: "https://inspirelincoln.uk", name: "<b>Ann</b>", status: "approved", type: "delegate", note: "<img src=x>" });
    expect(m!.html).not.toContain("<img src=x>");
    expect(m!.html).not.toContain("<b>Ann</b>");
  });
  it("has a plain text version with the link", () => {
    const m = renderEmail({ siteUrl: "https://inspirelincoln.uk", preheader: "p", heading: "Hello", paragraphs: ["Body <strong>text</strong>"], cta: { label: "Go", url: "https://inspirelincoln.uk/portal" } });
    expect(m.text).toContain("Body text");
    expect(m.text).toContain("Go: https://inspirelincoln.uk/portal");
    expect(m.html).toContain("https://inspirelincoln.uk/brand/crest-white.png");
  });
  it("never uses em dashes", () => {
    const all = ["approved", "waitlisted", "declined"].map((s) => accountDecisionEmail({ siteUrl: "https://x.test", name: "A", status: s as "approved", type: "oral_presenter", note: null })!.html).join("");
    expect(all).not.toMatch(/—/);
  });
});

describe("help contact", () => {
  it("is in every email, HTML and plain text", () => {
    const m = renderEmail({ siteUrl: "https://inspirelincoln.uk", preheader: "p", heading: "H", paragraphs: ["x"] });
    expect(m.html).toContain("mailto:inspiresoc@lincolnsu.com");
    expect(m.text).toContain("inspiresoc@lincolnsu.com");
  });
});
