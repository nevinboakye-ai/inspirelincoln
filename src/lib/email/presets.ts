import type { AccountStatus, AccountType } from "@/lib/types";
import { COMMITTEE_TYPES, ROSTER_TYPES } from "@/lib/accounts";

/**
 * Ready-made emails for the committee, based on the committee's own drafts.
 * Choosing one fills in the subject, message and suggested recipients, and
 * everything stays editable before sending.
 *
 * Placeholders are filled in for each person:
 *   {first_name}  {full_name}  {title} (their presentation title)  {website}
 * With "Include their login details" ticked, each email also gets a box with
 * the website, their email and, for anyone who hasn't chosen a password yet,
 * a temporary password they must change when they first log in.
 */
export interface EmailPreset {
  id: string;
  name: string;
  /** When to use it, shown under the picker. */
  use: string;
  subject: string;
  body: string;
  audience: { types: AccountType[]; statuses: AccountStatus[]; includeSelected: boolean };
  login: boolean;
}

const SIGN_OFF = `Warm regards,
Lincoln INSPIRE Society
INSPIRE National Medical Research Conference 2026`;

const QUESTIONS = "Should you have any questions, please do not hesitate to get in touch at inspiresoc@lincolnsu.com.";

const LOG_IN = `Log in to My Hub at {website} with the details below. The first time you log in, you'll be asked to choose your own password.`;

const PRESENTERS: AccountType[] = [...ROSTER_TYPES];

export const EMAIL_PRESETS: EmailPreset[] = [
  {
    id: "accept-poster",
    name: "Acceptance: poster presentation",
    use: "For poster presenters. Includes their poster title and login details.",
    subject: "Your abstract has been accepted for poster presentation at INSPIRE 2026",
    audience: { types: ["poster_presenter"], statuses: ["approved"], includeSelected: true },
    login: true,
    body: `Dear {first_name},

Thank you for submitting your abstract to the 2026 INSPIRE National Medical Research Conference, taking place on Saturday 21st November 2026 at Lincoln Medical School, University of Lincoln.

Following a competitive submission and review process, we are delighted to inform you that your abstract has been accepted for poster presentation!

Poster details
Title: {title}
Presenting author: {full_name}

Congratulations on this achievement. We look forward to giving you the opportunity to showcase your research to fellow students, academics and healthcare professionals.

Next steps
1. ${LOG_IN}
2. Upload a digital copy of your poster in My Hub, under My submission, by Friday 13th November 2026.
3. Complete your profile, including a short bio and any access or dietary needs.
4. Bring a printed copy of your poster to the conference on Saturday 21st November. Both portrait and landscape orientations are accepted.
5. As the designated presenting author, please share this confirmation with your co-authors.

We are excited to welcome you to Lincoln and celebrate the outstanding research being undertaken by the next generation of medical professionals.

${QUESTIONS}

${SIGN_OFF}`,
  },
  {
    id: "accept-oral",
    name: "Acceptance: oral presentation",
    use: "For oral presenters. Includes their presentation title and login details.",
    subject: "Your abstract has been accepted for oral presentation at INSPIRE 2026",
    audience: { types: ["oral_presenter"], statuses: ["approved"], includeSelected: true },
    login: true,
    body: `Dear {first_name},

Thank you for submitting your abstract to the 2026 INSPIRE National Medical Research Conference, taking place on Saturday 21st November 2026 at Lincoln Medical School, University of Lincoln.

Following a competitive submission and review process, we are delighted to inform you that your abstract has been accepted for oral presentation!

Presentation details
Title: {title}
Presenting author: {full_name}

Congratulations on this achievement. We look forward to giving you the opportunity to present your research to fellow students, academics and healthcare professionals.

Next steps
1. ${LOG_IN}
2. Upload your presentation slides in My Hub, under My submission, as early as you can before the conference. The committee may send you feedback there.
3. Complete your profile, including a short bio and any access or dietary needs.
4. As the designated presenting author, please share this confirmation with your co-authors.

We are excited to welcome you to Lincoln and celebrate the outstanding research being undertaken by the next generation of medical professionals.

${QUESTIONS}

${SIGN_OFF}`,
  },
  {
    id: "accept-delegate",
    name: "Acceptance: delegate place",
    use: "For delegates who applied to attend. Includes login details.",
    subject: "Your place at INSPIRE 2026 is confirmed",
    audience: { types: ["delegate"], statuses: ["approved"], includeSelected: true },
    login: true,
    body: `Dear {first_name},

Thank you for applying to attend the 2026 INSPIRE National Medical Research Conference, taking place on Saturday 21st November 2026 at Lincoln Medical School, University of Lincoln.

Following a competitive selection process, we are delighted to confirm your place as a delegate!

You will have the opportunity to engage with exciting research, attend insightful talks and workshops, and connect with fellow students, researchers and healthcare professionals.

Next steps
1. ${LOG_IN}
2. Complete your profile, including a short bio and any access or dietary needs, so we can make the day work for you.
3. Keep an eye on {website} for the programme, speakers and the campus map.

We look forward to welcoming you to Lincoln for what promises to be an inspiring day of learning, collaboration and innovation.

${QUESTIONS}

${SIGN_OFF}`,
  },
  {
    id: "abstract-not-selected-delegate",
    name: "Abstract not selected, delegate place offered",
    use: "For people whose abstract wasn't selected but who keep a delegate place. Untick anyone who doesn't fit before sending.",
    subject: "Your INSPIRE 2026 abstract and your delegate place",
    audience: { types: ["delegate"], statuses: ["approved"], includeSelected: true },
    login: true,
    body: `Dear {first_name},

Thank you for submitting your abstract to the 2026 INSPIRE National Medical Research Conference, taking place on Saturday 21st November 2026 at the University of Lincoln.

We received a high number of submissions this year, and following a thorough review and selection process, we regret to inform you that your abstract has not been selected for presentation on this occasion.

We sincerely appreciate the time and effort you invested in your submission and encourage you to continue pursuing and sharing your research.

We are, however, delighted to confirm your place as a delegate at this year's conference. You will still have the opportunity to engage with exciting research, attend insightful talks and workshops, and connect with fellow students, researchers and healthcare professionals.

Next steps
1. ${LOG_IN}
2. Complete your profile, including a short bio and any access or dietary needs.

We look forward to welcoming you to Lincoln for what promises to be an inspiring day of learning, collaboration and innovation.

${QUESTIONS}

${SIGN_OFF}`,
  },
  {
    id: "waitlist-oral",
    name: "Waiting list for oral presentation, delegate place offered",
    use: "For everyone in the Oral waiting list group. They keep a delegate place.",
    subject: "Your INSPIRE 2026 abstract: waiting list for oral presentation",
    audience: { types: ["oral_waitlist"], statuses: ["approved"], includeSelected: true },
    login: true,
    body: `Dear {first_name},

Thank you for submitting your abstract to the 2026 INSPIRE National Medical Research Conference, taking place on Saturday 21st November 2026 at the University of Lincoln.

We received a high number of submissions this year, and following a thorough review and selection process, your abstract has been placed on the waiting list for oral presentation.

While we are unable to confirm a presentation place at this stage, this does not necessarily mean rejection. Your submission remains under consideration, and we will be in touch should a place become available.

We are, however, delighted to confirm your place as a delegate at this year's conference, where you will have the opportunity to engage with exciting research, attend insightful talks and workshops, and connect with fellow students, researchers and healthcare professionals.

Next steps
1. ${LOG_IN}
2. Complete your profile, including a short bio and any access or dietary needs.

We sincerely appreciate the time and effort you have invested in your submission and look forward to welcoming you to Lincoln for an inspiring day of learning, collaboration and innovation.

${QUESTIONS}

${SIGN_OFF}`,
  },
  {
    id: "not-selected",
    name: "Not selected, no place this year",
    use: "For applicants whose account was declined. No login details, as they won't need the website.",
    subject: "Your application to INSPIRE 2026",
    audience: { types: PRESENTERS, statuses: ["declined"], includeSelected: false },
    login: false,
    body: `Dear {first_name},

Thank you for completing the registration and abstract submission form for the 2026 INSPIRE National Medical Research Conference, taking place on Saturday 21st November 2026 at the University of Lincoln.

We received a high volume of applications this year, and following a thorough review and selection process, we regret to inform you that your abstract has not been selected for presentation, and we are unfortunately unable to offer you a delegate place at this year's conference.

We sincerely appreciate the time, effort and enthusiasm you have invested in your application. With considerable interest and limited places available, the selection process has been particularly competitive.

While we are unable to welcome you on this occasion, we encourage you to continue pursuing your research interests and hope to see you at future INSPIRE conferences and events.

Thank you once again for your interest in INSPIRE, and we wish you every success in your future academic and research endeavours.

${SIGN_OFF}`,
  },
  {
    id: "reminder-poster",
    name: "Reminder: poster due 13 November",
    use: "For poster presenters who still need to upload. Untick anyone who has already uploaded.",
    subject: "Reminder: please upload your INSPIRE 2026 poster by Friday 13th November",
    audience: { types: ["poster_presenter"], statuses: ["approved"], includeSelected: true },
    login: true,
    body: `Dear {first_name},

A quick reminder that the deadline to submit your poster for INSPIRE 2026 is Friday 13th November 2026.

Please log in to My Hub at {website} and upload a digital copy of your poster under My submission. Your login details are below. If you haven't logged in before, you'll be asked to choose your own password first.

Please also bring a printed copy of your poster on Saturday 21st November. Both portrait and landscape orientations are accepted.

${QUESTIONS}

${SIGN_OFF}`,
  },
  {
    id: "committee-login",
    name: "Committee: log in before the conference",
    use: "For the executive and supporting committee. Thanks everyone, includes login details and asks them to check their access before the day.",
    subject: "INSPIRE 2026 is nearly here: please log in to your committee account",
    audience: { types: [...COMMITTEE_TYPES], statuses: ["approved"], includeSelected: false },
    login: true,
    body: `Dear {first_name},

Thank you for everything you've put into INSPIRE 2026 so far. The time and effort the whole committee has given has got us to this point, and it really shows. We're very grateful.

The conference is now just around the corner, on Saturday 21st November at Lincoln Medical School, University of Lincoln, so we'd like everyone to be set up on the website before the day.

What we'd like you to do
1. ${LOG_IN}
2. Check your details in My Hub, including your committee position, and add any access or dietary needs so we can plan for you too.
3. Open the committee dashboard from My Hub and make sure you can see the areas for your role. Depending on your role, this is where you review slides and posters, keep track of accounts and presenter attendance, update the website, and check delegates in on the day by scanning the QR code on their Delegate Card.
4. If anything doesn't look right, or you can't see something you need, let us know this week rather than on the day.

Thank you again for all your hard work. We can't wait to see it come together in Lincoln.

${QUESTIONS}

${SIGN_OFF}`,
  },
  {
    id: "reminder-login",
    name: "Reminder: log in and complete your profile",
    use: "For anyone with a place who hasn't logged in yet, or needs their login details again.",
    subject: "Your INSPIRE 2026 login details",
    audience: { types: PRESENTERS, statuses: ["approved"], includeSelected: true },
    login: true,
    body: `Dear {first_name},

We're looking forward to seeing you at INSPIRE 2026 on Saturday 21st November at Lincoln Medical School, University of Lincoln.

Your login details for My Hub are below. Please log in at {website} to check your details, add a short bio and tell us about any access or dietary needs. Presenters can also upload their slides or poster there. If you haven't logged in before, you'll be asked to choose your own password first.

${QUESTIONS}

${SIGN_OFF}`,
  },
];

/** Fills in a person's placeholders. Unknown values fall back to plain wording. */
export function fillPlaceholders(text: string, p: { first_name?: string | null; full_name?: string | null; title?: string | null; website: string }) {
  return text
    .replace(/\{first_name\}/g, p.first_name || "there")
    .replace(/\{full_name\}/g, p.full_name || "you")
    .replace(/\{title\}/g, p.title || "as submitted")
    .replace(/\{website\}/g, p.website);
}

export const PLACEHOLDER_HELP = "{first_name}, {full_name}, {title} and {website} are filled in for each person.";
