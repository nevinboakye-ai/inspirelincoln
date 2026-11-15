import { describe, expect, it } from "vitest";
import { greetingName, judgeQueue, judgingError, markPercent, nextToMark, previewKind, rankResults, type BoardEntry, type Criterion, type Mark } from "@/lib/judging";

const entry = (id: string, kind: "oral" | "poster", over: Partial<BoardEntry> = {}): BoardEntry => ({
  presenterId: id, kind, name: id, institution: null, title: null, avatarPath: null, label: null, sort: 0, attendance: null, checkedIn: false,
  submission: null, assigned: false, myStatus: null, myTotal: null, myMax: null, marksIn: 0, ...over,
});
const crit: Criterion[] = [
  { id: "c1", kind: "poster", label: "A", description: "", maxScore: 10, sort: 1 },
  { id: "c2", kind: "poster", label: "B", description: "", maxScore: 5, sort: 2 },
];
const mark = (presenterId: string, judge: string, scores: Record<string, number>, status: "draft" | "submitted" = "submitted"): Mark => ({
  id: `${presenterId}-${judge}`, judgeId: judge, judgeName: judge, presenterId, kind: "poster", scores,
  total: Object.values(scores).reduce((a, b) => a + b, 0), maxTotal: 15, strengths: "", improvements: "", committeeNote: "", status, submittedAt: null, updatedAt: "",
});

describe("judging", () => {
  it("previews images, PDFs and PowerPoint in the page, and leaves Keynote to download", () => {
    expect(previewKind("image/png", "poster.png")).toBe("image");
    expect(previewKind("application/pdf", "talk.pdf")).toBe("pdf");
    expect(previewKind("", "talk.PDF")).toBe("pdf");
    expect(previewKind("application/vnd.openxmlformats-officedocument.presentationml.presentation", "talk.pptx")).toBe("office");
    expect(previewKind("application/octet-stream", "talk.ppt")).toBe("office");
    expect(previewKind("application/vnd.apple.keynote", "talk.key")).toBeNull();
  });

  it("shows judges only their kinds, never themselves, and only assigned people when assigned", () => {
    const all = [entry("me", "poster"), entry("a", "poster"), entry("b", "poster", { assigned: true }), entry("c", "oral")];
    expect(judgeQueue(all, { me: "me", kinds: ["poster"] }).map((e) => e.presenterId)).toEqual(["b"]);
    expect(judgeQueue(all, { me: "me", kinds: ["oral", "poster"] }).map((e) => e.presenterId)).toEqual(["b", "c"]);
  });

  it("finds the next presentation still to mark, wrapping round", () => {
    const q = [entry("a", "poster", { myStatus: "submitted" }), entry("b", "poster"), entry("c", "poster"), entry("d", "oral")];
    expect(nextToMark(q, { presenterId: "b", kind: "poster" })?.presenterId).toBe("c");
    expect(nextToMark(q, { presenterId: "c", kind: "poster" })?.presenterId).toBe("b");
    expect(nextToMark([entry("a", "poster")], { presenterId: "a", kind: "poster" })).toBeNull();
  });

  it("works out percentages from the current criteria", () => {
    expect(markPercent(mark("p", "j", { c1: 10, c2: 5 }), crit)).toBe(100);
    expect(markPercent(mark("p", "j", { c1: 5 }), crit)).toBe(50);
  });

  it("ranks by average, ignores drafts, shares ranks on ties and flags disagreement", () => {
    const marks = [
      mark("x", "j1", { c1: 10, c2: 5 }), mark("x", "j2", { c1: 2, c2: 1 }),
      mark("y", "j1", { c1: 9, c2: 4 }),
      mark("z", "j1", { c1: 9, c2: 4 }),
      mark("w", "j1", { c1: 10, c2: 5 }, "draft"),
    ];
    const rows = rankResults(["x", "y", "z", "w"].map((id) => entry(id, "poster")), marks, crit, "poster");
    expect(rows.map((r) => [r.presenterId, r.rank])).toEqual([["y", 1], ["z", 1], ["x", 3], ["w", null]]);
    expect(rows.find((r) => r.presenterId === "x")?.spread).toBeCloseTo(80);
    expect(rows.find((r) => r.presenterId === "w")?.drafts).toBe(1);
  });

  it("greets judges sensibly and explains database errors", () => {
    expect(greetingName("Dr Asha Patel")).toBe("Dr Patel");
    expect(greetingName("Sam Jones")).toBe("Sam");
    expect(judgingError("JUDGING_CLOSED")).toMatch(/closed/);
  });
});
