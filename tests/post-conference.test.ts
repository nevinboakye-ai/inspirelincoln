import { describe, expect, it } from "vitest";
import { HIGHLIGHTS, IMPROVEMENTS, IMPROVE_NOTHING, PARTS, feedbackSchema, groupOf, netPromoter, partsFor, summarise, type FeedbackRow } from "@/lib/post-conference/feedback";
import { GALLERY_PATH, fitWithin, swipeDirection, wrapIndex } from "@/lib/post-conference/photos";

const base = { overall: 5, recommend: 9 };

describe("post-conference feedback", () => {
  it("needs only the star rating and the 0 to 10 answer", () => {
    const r = feedbackSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.parts).toEqual({});
      expect(r.data.highlights).toEqual([]);
      expect(r.data.comments).toBeNull();
      expect(r.data.quoteOk).toBe(false);
    }
    expect(feedbackSchema.safeParse({ recommend: 9 }).success).toBe(false);
    expect(feedbackSchema.safeParse({ overall: 4 }).success).toBe(false);
  });

  it("rejects ratings and phrases that aren't on the form", () => {
    expect(feedbackSchema.safeParse({ ...base, overall: 6 }).success).toBe(false);
    expect(feedbackSchema.safeParse({ ...base, recommend: 11 }).success).toBe(false);
    expect(feedbackSchema.safeParse({ ...base, parts: { keynotes: "amazing" } }).success).toBe(false);
    expect(feedbackSchema.safeParse({ ...base, parts: { lunch_queue: "poor" } }).success).toBe(false);
    expect(feedbackSchema.safeParse({ ...base, highlights: ["free_pizza"] }).success).toBe(false);
    expect(feedbackSchema.safeParse({ ...base, comments: "x".repeat(1001) }).success).toBe(false);
  });

  it("lets people rate only some parts of the day", () => {
    const r = feedbackSchema.safeParse({ ...base, parts: { keynotes: "great", venue: "poor" } });
    expect(r.success && r.data.parts).toEqual({ keynotes: "great", venue: "poor" });
  });

  it("never keeps 'Nothing, it was great' alongside a suggestion, and drops repeats", () => {
    const r = feedbackSchema.safeParse({ ...base, improvements: [IMPROVE_NOTHING, "timing", "timing"], highlights: ["people", "people"] });
    expect(r.success && r.data.improvements).toEqual(["timing"]);
    expect(r.success && r.data.highlights).toEqual(["people"]);
    const alone = feedbackSchema.safeParse({ ...base, improvements: [IMPROVE_NOTHING] });
    expect(alone.success && alone.data.improvements).toEqual([IMPROVE_NOTHING]);
  });

  it("trims written comments and treats blank ones as none", () => {
    const r = feedbackSchema.safeParse({ ...base, highlightNote: "   ", comments: "  Loved it  " });
    expect(r.success && r.data.highlightNote).toBeNull();
    expect(r.success && r.data.comments).toBe("Loved it");
  });

  it("only asks presenters about presenting", () => {
    expect(partsFor(false).some((p) => p.id === "presenting")).toBe(false);
    expect(partsFor(true).some((p) => p.id === "presenting")).toBe(true);
    expect(partsFor(true)).toHaveLength(PARTS.length);
  });

  it("keeps every phrase id unique", () => {
    for (const list of [HIGHLIGHTS, IMPROVEMENTS, PARTS]) expect(new Set(list.map((p) => p.id)).size).toBe(list.length);
  });

  it("works out the Net Promoter Score", () => {
    expect(netPromoter([])).toBeNull();
    expect(netPromoter([10, 9, 8, 7, 0])).toBe(20);
    expect(netPromoter([0, 1, 6])).toBe(-100);
  });

  it("groups people by their roles when they answered", () => {
    expect(groupOf(["delegate"])).toBe("Delegate");
    expect(groupOf(["executive_committee", "poster_presenter"])).toBe("Presenter");
    expect(groupOf(["judge"])).toBe("Committee or staff");
  });

  it("summarises answers for the committee without anything that identifies people", () => {
    const row = (o: Partial<FeedbackRow>): FeedbackRow => ({
      roles: ["delegate"],
      overall: 5,
      recommend: 10,
      parts: {},
      highlights: [],
      highlight_note: null,
      improvements: [],
      improve_note: null,
      comments: null,
      quote_ok: false,
      day: "2026-11-23",
      ...o,
    });
    const s = summarise([
      row({ overall: 4, parts: { keynotes: "great" }, highlights: ["people", "keynotes"], comments: "Thank you" }),
      row({ overall: 5, parts: { keynotes: "ok", presenting: "great" }, highlights: ["people"], roles: ["oral_presenter"], quote_ok: true, improve_note: "Signs" }),
    ]);
    expect(s.responses).toBe(2);
    expect(s.overallAverage).toBe(4.5);
    expect(s.nps).toBe(100);
    expect(s.highlights[0]).toMatchObject({ id: "people", n: 2 });
    expect(s.parts.find((p) => p.id === "keynotes")).toMatchObject({ great: 1, ok: 1, poor: 0, n: 2 });
    expect(s.parts.find((p) => p.id === "presenting")?.n).toBe(1);
    expect(s.comments.map((c) => c.kind)).toEqual(["Anything else", "To change"]);
    expect(s.comments[1]).toMatchObject({ quoteOk: true, group: "Presenter" });
    expect(s.groups.find((g) => g.group === "Presenter")).toMatchObject({ n: 1, overallAverage: 5 });
  });
});

describe("gallery", () => {
  it("only accepts photos saved in the uploader's own folder under a random name", () => {
    const id = "6f1c2c8e-2a55-4a3a-9b7e-0c1d2e3f4a5b";
    expect(GALLERY_PATH.test(`${id}/${id}.webp`)).toBe(true);
    expect(GALLERY_PATH.test(`${id}/${id}.jpg`)).toBe(true);
    expect(GALLERY_PATH.test(`${id}/${id}.png`)).toBe(false);
    expect(GALLERY_PATH.test(`${id}/../${id}.jpg`)).toBe(false);
    expect(GALLERY_PATH.test(`${id}/holiday.jpg`)).toBe(false);
  });

  it("shrinks big photos to fit, keeping their shape, and never enlarges small ones", () => {
    expect(fitWithin(6000, 4000)).toEqual({ width: 2400, height: 1600 });
    expect(fitWithin(3000, 4000)).toEqual({ width: 1800, height: 2400 });
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it("wraps round from the last photo to the first and back", () => {
    expect(wrapIndex(5, 5)).toBe(0);
    expect(wrapIndex(-1, 5)).toBe(4);
    expect(wrapIndex(3, 0)).toBe(0);
  });

  it("treats a long sideways drag as a swipe but not a scroll or a tap", () => {
    expect(swipeDirection(-80, 5)).toBe(-1);
    expect(swipeDirection(80, 10)).toBe(1);
    expect(swipeDirection(20, 0)).toBe(0);
    expect(swipeDirection(-60, 70)).toBe(0);
  });
});
