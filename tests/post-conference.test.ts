import { describe, expect, it } from "vitest";
import { HIGHLIGHTS, IMPROVEMENTS, IMPROVE_NOTHING, PARTS, feedbackSchema, groupOf, netPromoter, partScore, partsFor, summarise, type FeedbackRow } from "@/lib/post-conference/feedback";
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
      expect(r.data.workshops).toEqual([]);
      expect(r.data.research).toBeNull();
      expect(r.data.researchContact).toBe(false);
    }
    expect(feedbackSchema.safeParse({ recommend: 9 }).success).toBe(false);
    expect(feedbackSchema.safeParse({ overall: 4 }).success).toBe(false);
  });

  it("rejects ratings and phrases that aren't on the form", () => {
    expect(feedbackSchema.safeParse({ ...base, overall: 6 }).success).toBe(false);
    expect(feedbackSchema.safeParse({ ...base, recommend: 11 }).success).toBe(false);
    expect(feedbackSchema.safeParse({ ...base, parts: { keynotes: "amazing" } }).success).toBe(false);
    expect(feedbackSchema.safeParse({ ...base, parts: { keynotes: 6 } }).success).toBe(false);
    expect(feedbackSchema.safeParse({ ...base, parts: { keynotes: 0 } }).success).toBe(false);
    expect(feedbackSchema.safeParse({ ...base, parts: { keynotes: 3.5 } }).success).toBe(false);
    expect(feedbackSchema.safeParse({ ...base, parts: { lunch_queue: 4 } }).success).toBe(false);
    expect(feedbackSchema.safeParse({ ...base, research: "definitely" }).success).toBe(false);
    expect(feedbackSchema.safeParse({ ...base, highlights: ["free_pizza"] }).success).toBe(false);
    expect(feedbackSchema.safeParse({ ...base, comments: "x".repeat(1001) }).success).toBe(false);
  });

  it("lets people score only some parts of the day, from 1 to 5", () => {
    const r = feedbackSchema.safeParse({ ...base, parts: { keynotes: 5, venue: 2 } });
    expect(r.success && r.data.parts).toEqual({ keynotes: 5, venue: 2 });
  });

  it("reads answers from the first version of the form as 5, 3 and 1", () => {
    expect([partScore("great"), partScore("ok"), partScore("poor")]).toEqual([5, 3, 1]);
    expect(partScore(4)).toBe(4);
    expect(partScore(9)).toBeNull();
    expect(partScore("amazing")).toBeNull();
  });

  it("takes each workshop once, with either score left blank", () => {
    const id = "6f1c2c8e-2a55-4a3a-9b7e-0c1d2e3f4a5b";
    const r = feedbackSchema.safeParse({ ...base, workshops: [{ id, workshop: 4, lead: null, note: "  Great  " }, { id, workshop: 1 }] });
    expect(r.success && r.data.workshops).toEqual([{ id, workshop: 4, lead: null, note: "Great" }]);
    expect(feedbackSchema.safeParse({ ...base, workshops: [{ id, workshop: 6 }] }).success).toBe(false);
    expect(feedbackSchema.safeParse({ ...base, workshops: [{ id: "workshop-1", workshop: 3 }] }).success).toBe(false);
  });

  it("only asks the committee to get in touch when someone said yes or maybe", () => {
    const yes = feedbackSchema.safeParse({ ...base, research: "yes", researchContact: true });
    expect(yes.success && yes.data.researchContact).toBe(true);
    const no = feedbackSchema.safeParse({ ...base, research: "no", researchContact: true });
    expect(no.success && no.data.researchContact).toBe(false);
    const blank = feedbackSchema.safeParse({ ...base, researchContact: true });
    expect(blank.success && blank.data.researchContact).toBe(false);
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
      row({ overall: 4, parts: { keynotes: "great" }, highlights: ["people", "keynotes"], comments: "Thank you", workshops: [{ id: "w1", workshop: 5, lead: 4, note: "Loved the cases" }], research: "yes" }),
      row({ overall: 5, parts: { keynotes: 2, presenting: 4 }, highlights: ["people"], roles: ["oral_presenter"], quote_ok: true, improve_note: "Signs", workshops: [{ id: "w1", workshop: 3 }], research: "no" }),
    ], [{ id: "w1", number: 1, title: "Suturing", facilitator: "Dr Rao" }, { id: "w2", number: 2, title: "Ultrasound", facilitator: null }]);
    expect(s.responses).toBe(2);
    expect(s.overallAverage).toBe(4.5);
    expect(s.nps).toBe(100);
    expect(s.highlights[0]).toMatchObject({ id: "people", n: 2 });
    // An old "great" (5) and a new 2.
    expect(s.parts.find((p) => p.id === "keynotes")).toMatchObject({ average: 3.5, n: 2 });
    expect(s.parts.find((p) => p.id === "keynotes")?.spread.map((x) => x.n)).toEqual([0, 1, 0, 0, 1]);
    expect(s.workshops[0]).toMatchObject({ went: 2, workshop: { average: 4, n: 2 }, lead: { average: 4, n: 1 }, notes: ["Loved the cases"] });
    expect(s.workshops[1]).toMatchObject({ went: 0, workshop: { average: null, n: 0 } });
    expect(s.research.map((r) => r.n)).toEqual([1, 0, 1]);
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
