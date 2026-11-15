1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
32
33
34
35
36
37
38
39
40
41
42
43
44
45
46
47
48
49
50
51
52
53
54
55
56
57
58
59
60
61
62
63
64
65
66
67
68
69
70
71
72
73
74
75
76
77
78
79
80
81
82
83
84
85
86
87
88
89
90
91
92
93
94
95
96
import type { AccountStatus, AccountType, SubmissionKind, SubmissionStatus, UserRole } from "@/lib/types";

export const ACCOUNT_TYPES: AccountType[] = [
  "delegate",
  "oral_presenter",
  "poster_presenter",
  "oral_waitlist",
  "supporting_committee",
  "academic_team",
  "publicity_team",
  "finance_team",
  "logistics_team",
  "executive_committee",
  "vice_president",
  "president",
];

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  delegate: "Delegate",
  oral_presenter: "Oral presenter",
  poster_presenter: "Poster presenter",
  oral_waitlist: "Oral waiting list",
  supporting_committee: "Supporting committee",
  academic_team: "Academic Team",
  publicity_team: "Publicity Team",
  finance_team: "Finance Team",
  logistics_team: "Logistics Team",
  executive_committee: "Executive committee",
  vice_president: "Vice president",
  president: "President",
};

export const ACCOUNT_TYPE_BLURB: Record<AccountType, string> = {
  delegate: "Attending the conference, talks and workshops.",
  oral_presenter: "Giving a talk. You'll upload your slides here.",
  poster_presenter: "Presenting a poster. You'll upload it for feedback.",
  oral_waitlist: "Presenting a poster, and on the waiting list for an oral presentation.",
  supporting_committee: "Helping run INSPIRE on the supporting committee.",
  academic_team: "Supporting committee: the Academic Team.",
  publicity_team: "Supporting committee: the Publicity Team.",
  finance_team: "Supporting committee: the Finance Team.",
  logistics_team: "Supporting committee: the Logistics Team.",
  executive_committee: "A member of the executive committee.",
  vice_president: "INSPIRE vice president.",
  president: "INSPIRE president.",
};

export const ACCOUNT_STATUS_LABEL: Record<AccountStatus, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  pending: { label: "Awaiting review", tone: "neutral" },
  approved: { label: "Approved", tone: "success" },
  waitlisted: { label: "Waitlisted", tone: "warning" },
  declined: { label: "Not approved", tone: "danger" },
};

/** Types that can go on the selected delegate list: everyone attending who isn't committee. */
export const ROSTER_TYPES = ["delegate", "poster_presenter", "oral_presenter", "oral_waitlist"] as const satisfies readonly AccountType[];
export type RosterType = (typeof ROSTER_TYPES)[number];

/** The supporting committee and its teams. */
export const SUPPORTING_TYPES: AccountType[] = ["supporting_committee", "academic_team", "publicity_team", "finance_team", "logistics_team"];
export const COMMITTEE_TYPES: AccountType[] = [...SUPPORTING_TYPES, "executive_committee", "vice_president", "president"];
export const EXEC_TYPES: AccountType[] = ["executive_committee", "vice_president", "president"];

/** Account types grouped the way the committee thinks about them, for pickers. */
export const ACCOUNT_TYPE_GROUPS: { title: string; hint: string; types: AccountType[] }[] = [
  { title: "Attending", hint: "Delegates and presenters", types: ["delegate", "oral_presenter", "poster_presenter", "oral_waitlist"] },
  { title: "Supporting committee", hint: "Can edit the website and review slides and posters", types: SUPPORTING_TYPES },
  { title: "Executive committee", hint: "Can also review accounts and email groups", types: EXEC_TYPES },
];
export const LEADERSHIP_TYPES: AccountType[] = ["vice_president", "president"];

/**
 * Every role, most senior first. Someone can hold several (the vice president
 * who also leads the Academic Team, or a committee member presenting a
 * poster); the most senior is their main role and the rest are extra roles.
 */
export const ROLE_RANK: AccountType[] = [
  "president",
  "vice_president",
  "executive_committee",
  "academic_team",
  "publicity_team",
  "finance_team",
  "logistics_team",
  "supporting_committee",
  "oral_presenter",
  "poster_presenter",
  "oral_waitlist",
  "delegate",
];
const ATTENDING: AccountType[] = ["delegate", "oral_presenter", "poster_presenter", "oral_waitlist"];

/** Every role someone holds, main role first, without repeats. */
export function rolesOf(main: AccountType, extra?: readonly AccountType[] | null): AccountType[] {
  return [main, ...(extra ?? []).filter((t, i, a) => t !== main && a.indexOf(t) === i)];
}