import { describe, expect, it } from "vitest";
import { directionsUrl, distanceMetres, walkingMinutes } from "@/components/map/map-config";
import { seedMapPlaces } from "@/content/seed";

describe("campus map", () => {
  it("measures short campus distances sensibly", () => {
    // Isaac Newton Building to Minerva Building is a short walk, well under half a kilometre.
    const d = distanceMetres({ lat: 53.226757, lng: -0.548265 }, { lat: 53.228584, lng: -0.5478345 });
    expect(d).toBeGreaterThan(150);
    expect(d).toBeLessThan(300);
    expect(walkingMinutes(d)).toBeGreaterThanOrEqual(2);
    expect(walkingMinutes(0)).toBe(1);
  });

  it("links directions by coordinates when pinned and by name when not", () => {
    expect(directionsUrl({ name: "INB", lat: 53.2, lng: -0.5 })).toContain("destination=53.2%2C-0.5");
    const byName = directionsUrl({ name: "Ross Lucas Medical Sciences Building", lat: null, lng: null });
    expect(byName).toContain("Ross%20Lucas");
    expect(byName).toContain("travelmode=walking");
    expect(directionsUrl({ name: "X", lat: 1, lng: 2 }, "apple")).toBe("https://maps.apple.com/?daddr=1,2&dirflg=w");
  });

  it("never pins a seed place without both coordinates, and parents exist", () => {
    const ids = new Set(seedMapPlaces.map((p) => p.id));
    for (const p of seedMapPlaces) {
      expect((p.lat == null) === (p.lng == null)).toBe(true);
      if (p.parentId) expect(ids.has(p.parentId)).toBe(true);
    }
    expect(new Set(seedMapPlaces.map((p) => p.slug)).size).toBe(seedMapPlaces.length);
  });
});
