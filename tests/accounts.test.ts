import { describe, expect, it } from "vitest";
import { accessFor, canApprove, effectiveRole, resolveFileType, submissionKindFor } from "@/lib/accounts";
import { escapeHtml, renderEmail } from "@/lib/email/template";
import { accountDecisionEmail } from "@/lib/email/messages";

const p = (accountType: Parameters<typeof accessFor>[0]["accountType"], accountStatus: Parameters<typeof accessFor>[0]["accountStatus"], role: Parameters<typeof accessFor>[0]["role"] = "delegate") => ({ accountType, accountStatus, role });

describe("account access", () => {
  it("gives nothing extra until an account is approved", () => {
    expect(accessFor(p("president", "pending"))).toEqual({ committee: false, exec: false, leadership: false });
    expect(accessFor(p("executive_committee", "waitlisted")).exec).toBe(false);
  });
  it("matches each committee level", () => {
    expect(accessFor(p("supporting_committee", "approved"))).toEqual({ committee: true, exec: false, leadership: false });
    expect(accessFor(p("executive_committee", "approved"))).toEqual({ committee: true, exec: true, leadership: false });
    expect(accessFor(p("vice_president", "approved"))).toEqual({ committee: true, exec: true, leadership: true });
    expect(accessFor(p("delegate", "approved"))).toEqual({ committee: false, exec: false, leadership: false });
  });
  it("treats a site admin as leadership whatever their account", () => {
    expect(accessFor(p("delegate", "pending", "admin")).leadership).toBe(true);
  });
  it("maps to the role tiers the gates use", () => {
    expect(effectiveRole(p("executive_committee", "approved"))).toBe("admin");
    expect(effectiveRole(p("supporting_committee", "approved"))).toBe("editor");
    expect(effectiveRole(p("oral_presenter", "approved"))).toBe("delegate");
  });
  it("only lets leadership approve executive accounts", () => {
    const exec = accessFor(p("executive_committee", "approved"));
    const pres = accessFor(p("president", "approved"));
    expect(canApprove(exec, "executive_committee")).toBe(false);
    expect(canApprove(exec, "poster_presenter")).toBe(true);
    expect(canApprove(pres, "vice_president")).toBe(true);
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
