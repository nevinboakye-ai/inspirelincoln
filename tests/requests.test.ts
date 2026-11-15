import { describe, expect, it } from "vitest";
import { requestEmail, accountRemovedEmail } from "@/lib/accounts/requests";

describe("request emails", () => {
  it("lists each item with a link and the deadline", () => {
    const m = requestEmail({ siteUrl: "https://x.test", name: "Ada <b>Lovelace", items: ["photo", "slides"], deadline: "2026-11-19", note: "For the <booklet>", sender: "Nevin" });
    expect(m.subject).toContain("Thursday 19 November");
    expect(m.html).toContain("https://x.test/portal/submission");
    expect(m.html).toContain("&lt;booklet&gt;");
    expect(m.html).not.toContain("<b>Lovelace");
    expect(m.text).toContain("Add a profile photo");
  });
  it("removal email escapes the reason", () => {
    expect(accountRemovedEmail({ siteUrl: "https://x.test", name: "Ada", reason: "<script>" }).html).not.toContain("<script>");
  });
});
