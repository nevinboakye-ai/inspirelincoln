import { describe, expect, it } from "vitest";
import { uniInitials, uniKey } from "@/lib/university-logos";

describe("university logos", () => {
  it("matches names ignoring case and outer spaces", () => expect(uniKey("  University of Lincoln ")).toBe(uniKey("university of lincoln")));
  it("makes initials that skip small words", () => {
    expect(uniInitials("University of East Anglia")).toBe("UEA");
    expect(uniInitials("Hull York Medical School")).toBe("HYMS");
    expect(uniInitials("King's College London")).toBe("KCL");
  });
});
