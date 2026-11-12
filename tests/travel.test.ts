import { describe, expect, it } from "vitest";
import { cleanRegistration, isTravelMode } from "@/lib/travel";

describe("car registrations", () => {
  it("tidies case and spacing", () => {
    expect(cleanRegistration("  ab12   cde ")).toBe("AB12 CDE");
    expect(cleanRegistration("ab12cde")).toBe("AB12CDE");
  });
  it("drops punctuation", () => {
    expect(cleanRegistration("ab-12.cde")).toBe("AB12CDE");
  });
  it("rejects empty or overlong entries", () => {
    expect(cleanRegistration("")).toBeNull();
    expect(cleanRegistration(" - ")).toBeNull();
    expect(cleanRegistration("A")).toBeNull();
    expect(cleanRegistration("ABCDEFGHIJK")).toBeNull();
  });
});

describe("travel modes", () => {
  it("accepts only the five answers", () => {
    expect(isTravelMode("car")).toBe(true);
    expect(isTravelMode("local")).toBe(true);
    expect(isTravelMode("plane")).toBe(false);
    expect(isTravelMode(null)).toBe(false);
  });
});
