import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BUILT_IN_LOGOS, uniInitials, uniKey } from "@/lib/university-logos";

describe("university logos", () => {
  it("matches names ignoring case and outer spaces", () => expect(uniKey("  University of Lincoln ")).toBe(uniKey("university of lincoln")));
  it("makes initials that skip small words", () => {
    expect(uniInitials("University of East Anglia")).toBe("UEA");
    expect(uniInitials("Hull York Medical School")).toBe("HYMS");
    expect(uniInitials("King's College London")).toBe("KCL");
  });
  it("has a built-in logo for each university on the roster except Miva", () => {
    for (const name of ["University of Lincoln", "University of East Anglia", "University of Nottingham", "University of Leeds", "Hull York Medical School", "Keele University", "King's College London", "King’s College London"])
      expect(BUILT_IN_LOGOS[uniKey(name)], name).toMatch(/^\/universities\/[a-z-]+\.svg$/);
    expect(BUILT_IN_LOGOS[uniKey("Miva Open University")]).toBeUndefined();
  });
  it("keys every built-in logo by its matching form and points at a real file", () => {
    for (const [key, path] of Object.entries(BUILT_IN_LOGOS)) {
      expect(key).toBe(uniKey(key));
      expect(existsSync(join(process.cwd(), "public", path))).toBe(true);
    }
  });
});
