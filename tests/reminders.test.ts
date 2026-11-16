import { describe, expect, it } from "vitest";
import { formatDeadline, needsReminder, outstandingTasks, reminderEmail, tasksFor, type ReminderPerson } from "@/lib/email/reminders";

const bio = "Alex is a fourth-year medical student at the University of Lincoln with an interest in digital health. ".repeat(3);

const done: ReminderPerson = {
  email: "a@x.ac.uk",
  fullName: "Alex Example",
  institution: "University of Lincoln",
  joined: true,
  signedIn: true,
  roles: ["delegate"],
  photo: true,
  details: true,
  bio,
  travel: true,
  ranked: true,
  attendance: null,
  submissions: {},
};
const presenter: ReminderPerson = { ...done, roles: ["oral_presenter"], attendance: "confirmed", submissions: { slides: "submitted" } };

describe("outstandingTasks", () => {
  it("asks nothing of someone who is finished", () => {
    expect(outstandingTasks(done)).toEqual([]);
    expect(outstandingTasks(presenter)).toEqual([]);
  });
  it("puts signing in first, then presenter items, then the rest", () => {
    const keys = outstandingTasks({ ...presenter, signedIn: false, bio: null, photo: false, travel: false, ranked: false, attendance: null, submissions: {} }).map((t) => t.key);
    expect(keys).toEqual(["sign_in", "attend", "upload", "bio", "photo", "workshops", "travel"]);
  });
  it("flags a presenter's bio that's too short for the booklet, but not a delegate's", () => {
    expect(outstandingTasks({ ...presenter, bio: "Medical student." }).map((t) => t.key)).toEqual(["bio_short"]);
    expect(outstandingTasks({ ...done, bio: "Medical student." })).toEqual([]);
  });
  it("asks for a new upload when changes were requested", () => {
    expect(outstandingTasks({ ...presenter, submissions: { slides: "changes_requested" } }).map((t) => t.key)).toEqual(["resubmit"]);
  });
  it("asks the oral waiting list for a poster", () => {
    expect(outstandingTasks({ ...done, roles: ["oral_waitlist"], attendance: "confirmed" }).map((t) => t.key)).toEqual(["upload"]);
  });
  it("doesn't ask for workshop ranking when ranking isn't open", () => {
    expect(outstandingTasks({ ...done, ranked: null })).toEqual([]);
  });
});

describe("needsReminder", () => {
  it("sign-in reminder goes only to attendees who've never signed in", () => {
    expect(needsReminder("sign_in", { ...done, signedIn: false })).toBe(true);
    expect(needsReminder("sign_in", done)).toBe(false);
    expect(needsReminder("sign_in", { ...done, signedIn: false, roles: ["finance_team"] })).toBe(false);
  });
  it("presenter reminder needs a booklet item missing, and skips people who can't present", () => {
    expect(needsReminder("presenter", presenter)).toBe(false);
    expect(needsReminder("presenter", { ...presenter, photo: false })).toBe(true);
    expect(needsReminder("presenter", { ...presenter, photo: false, attendance: "unavailable" })).toBe(false);
    expect(needsReminder("presenter", { ...done, photo: false })).toBe(false);
    // Only travel left isn't a presenter task.
    expect(needsReminder("presenter", { ...presenter, travel: false })).toBe(false);
  });
  it("presenter reminder lists presenter items only", () => {
    expect(tasksFor("presenter", { ...presenter, photo: false, travel: false, ranked: false }).map((t) => t.key)).toEqual(["photo"]);
  });
});

describe("formatDeadline", () => {
  it("reads the date as written", () => {
    expect(formatDeadline("2026-11-16", "21:00")).toBe("Monday 16 November, 9pm");
    expect(formatDeadline("2026-11-18", "17:30")).toBe("Wednesday 18 November, 5:30pm");
    expect(formatDeadline("2026-11-18", "12:00")).toBe("Wednesday 18 November, midday");
    expect(formatDeadline("2026-11-18", "")).toBe("Wednesday 18 November");
    expect(formatDeadline("nonsense")).toBeNull();
  });
});

describe("reminderEmail", () => {
  const base = { siteUrl: "https://inspirelincoln.uk", deadline: "Monday 16 November, 9pm" };
  it("sign-in reminder lists the tasks, the deadline, the warning and login details", () => {
    const p = { ...done, signedIn: false, photo: false };
    const e = reminderEmail({ ...base, kind: "sign_in", name: "Alex Example", roles: p.roles, tasks: tasksFor("sign_in", p), login: [{ label: "Temporary password", value: "abcd-efgh-jkmn" }] });
    expect(e.subject).toBe("Action needed: sign in to My Hub by Monday 16 November, 9pm");
    expect(e.html).toContain("Sign in to My Hub");
    expect(e.html).toContain("Add a photo of yourself");
    expect(e.html).toContain("delegate place may be given to someone");
    expect(e.html).toContain("abcd-efgh-jkmn");
    expect(e.text).toContain("1. Sign in to My Hub");
    expect(e.text).toContain("PLEASE COMPLETE BY: Monday 16 November, 9pm");
  });
  it("presenter reminder explains the booklet and certificate", () => {
    const p = { ...presenter, bio: null, submissions: {} };
    const e = reminderEmail({ ...base, kind: "presenter", name: "Alex", roles: p.roles, tasks: tasksFor("presenter", p) });
    expect(e.subject).toContain("complete your presenter tasks");
    expect(e.html).toContain("post-conference booklet");
    expect(e.html).toContain("certificate");
    expect(e.html).toContain("Upload your presentation slides");
    expect(e.html).toContain("presentation place may be given to someone");
  });
  it("escapes what people typed", () => {
    const e = reminderEmail({ ...base, kind: "sign_in", name: "<b>Alex</b>", roles: ["delegate"], tasks: [], note: "<script>x</script>" });
    expect(e.html).not.toContain("<script>x");
    expect(e.html).not.toContain("<b>Alex");
  });
});

describe("final reminder", () => {
  const base = { siteUrl: "https://inspirelincoln.uk", deadline: "Monday 16 November, 9pm" };
  it("goes to anyone attending with any task left, but not people who can't present or are finished", () => {
    expect(needsReminder("final", done)).toBe(false);
    expect(needsReminder("final", { ...done, travel: false })).toBe(true);
    expect(needsReminder("final", { ...presenter, photo: false })).toBe(true);
    expect(needsReminder("final", { ...presenter, photo: false, attendance: "unavailable" })).toBe(false);
    expect(needsReminder("final", { ...done, travel: false, roles: ["finance_team"] })).toBe(false);
  });
  it("holds every bio to the booklet standard, delegates included", () => {
    expect(tasksFor("final", { ...done, bio: "Medical student." }).map((t) => t.key)).toEqual(["bio_short"]);
    expect(tasksFor("final", { ...done, bio: null, travel: false, ranked: false }).map((t) => t.key)).toEqual(["bio", "workshops", "travel"]);
    expect(tasksFor("final", { ...done, bio: null })[0].title).toContain("booklet and certificates");
  });
  it("tells presenters they may lose their place and explains how to write the bio", () => {
    const p = { ...presenter, bio: null, photo: false, submissions: {} };
    const e = reminderEmail({ ...base, kind: "final", name: "Alex Example", roles: p.roles, tasks: tasksFor("final", p) });
    expect(e.subject).toBe("Final reminder: 3 things to complete by Monday 16 November, 9pm");
    expect(e.html).toContain("may lose your presenting place");
    expect(e.html).toContain("Your biography will be published");
    expect(e.html).toContain("third person");
    expect(e.html).toContain("Upload your presentation slides");
    expect(e.text).toContain("YOUR BIOGRAPHY WILL BE PUBLISHED");
    expect(e.text).toContain("Hello Alex,");
  });
  it("asks delegates with a bio already to re-read it, without the presenter warning", () => {
    const p = { ...done, travel: false };
    const e = reminderEmail({ ...base, kind: "final", name: "Sam", roles: p.roles, tasks: tasksFor("final", p), bioDone: true });
    expect(e.subject).toBe("Final reminder: 1 thing to complete by Monday 16 November, 9pm");
    expect(e.html).toContain("Please re-read your biography");
    expect(e.html).not.toContain("presenting place");
  });
  it("warns delegates who haven't signed in that their place may go", () => {
    const p = { ...done, signedIn: false, photo: false };
    const e = reminderEmail({ ...base, kind: "final", name: "Sam", roles: p.roles, tasks: tasksFor("final", p), login: [{ label: "Temporary password", value: "abcd" }] });
    expect(e.html).toContain("delegate place may be given to someone");
    expect(e.html).toContain("your login details are below");
    expect(e.html).toContain("abcd");
  });
});
