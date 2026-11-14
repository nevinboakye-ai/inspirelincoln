import { describe, expect, it } from "vitest";
import { failedLinkPath, safeLinkNext, strayAuthTarget } from "@/lib/accounts/link-paths";

const q = (s: string) => new URLSearchParams(s);

describe("account link routing", () => {
  it("only follows paths on this site", () => {
    expect(safeLinkNext("/portal/profile")).toBe("/portal/profile");
    expect(safeLinkNext("//evil.example")).toBe("/portal?welcome=1");
    expect(safeLinkNext("/\\evil.example")).toBe("/portal?welcome=1");
    expect(safeLinkNext("https://evil.example")).toBe("/portal?welcome=1");
    expect(safeLinkNext(null, "recovery")).toBe("/auth/update-password");
  });

  it("sends a failed link to the place that issues a fresh one", () => {
    expect(failedLinkPath("recovery", "/auth/update-password")).toBe("/auth/reset?error=expired");
    expect(failedLinkPath("recovery", "/auth/update-password?setup=1")).toBe("/auth/activate?error=expired");
    expect(failedLinkPath("signup", "/portal?welcome=1")).toBe("/login?error=link");
  });

  it("rescues links that fell back to the homepage", () => {
    expect(strayAuthTarget("/", q("code=abc"))).toBe("/auth/callback?code=abc&next=%2Fportal%3Fwelcome%3D1");
    expect(strayAuthTarget("/", q("token_hash=t&type=recovery"))).toBe("/auth/confirm?token_hash=t&type=recovery");
    expect(strayAuthTarget("/", q("error=access_denied&error_code=otp_expired&error_description=x"))).toBe("/login?error=link");
  });

  it("leaves ordinary pages alone", () => {
    expect(strayAuthTarget("/programme", q("code=abc"))).toBeNull();
    expect(strayAuthTarget("/auth/callback", q("code=abc"))).toBeNull();
    expect(strayAuthTarget("/", q("utm_source=x"))).toBeNull();
  });
});
