import type { StudySettings } from "@/lib/research/schedule";
import { formatWhen } from "@/lib/research/schedule";

/**
 * The participant information and consent wording. Ethics committees
 * approve this text, so it carries the version number set in the study
 * settings, and every consent records the version that was shown.
 * Change it only with an approved amendment.
 */

export const STUDY_TITLE = "Research confidence, opportunities and what happens next: a study of student-led research conferences";

export type InfoSection = { heading: string; body: string[] };

export function participantInformation(s: StudySettings): InfoSection[] {
  const lead = s.leadName && s.leadEmail ? `${s.leadName} (${s.leadEmail})` : "the lead researcher (named once the study is approved)";
  return [
    {
      heading: "What is the study about?",
      body: [
        "Student-led research conferences are common, but we know little about whether they change students' confidence in research, how easy students find it to get into research, or what students actually do afterwards. This study asks students at INSPIRE 2026 three short sets of questions, so we can find out, and so future conferences can better support students who have had fewer research opportunities.",
        "This is a research study, separate from any feedback about the day. We are studying conferences in general, not marking INSPIRE.",
      ],
    },
    {
      heading: "Why have I been invited?",
      body: ["You have a place, or a place on the waiting list, as a delegate or presenter at INSPIRE 2026. Everyone in that group is invited, whatever their experience of research. You must be 18 or over to take part."],
    },
    {
      heading: "Do I have to take part?",
      body: [
        "No. Taking part is entirely voluntary. Saying no, or stopping later, makes no difference to your registration, your place, your presentation or poster, judging, prizes, workshop places or your certificate. The conference committee cannot see who has taken part.",
      ],
    },
    {
      heading: "What would I do?",
      body: [
        `Answer three online questionnaires here in My Hub: one before the conference (about 5 minutes, open until ${formatWhen(s.preClosesAt)}), one just after it (about 4 minutes, ${formatWhen(s.postOpensAt, false)} to ${formatWhen(s.postClosesAt, false)}) and one about eight weeks later (about 5 minutes, ${formatWhen(s.followupOpensAt, false)} to ${formatWhen(s.followupClosesAt, false)}).`,
        "The questions ask how confident you feel about research tasks, how easy you find it to find research opportunities, and which research activities you have done. There are no right answers, and it's fine to answer \"no\" or choose low numbers.",
      ],
    },
    {
      heading: "Are there any risks or benefits?",
      body: [
        "There are no expected risks beyond the time it takes. Some people may find questions about their experience or background personal: those questions have a \"Prefer not to say\" option. There is no direct benefit to you, but the results may help conferences and medical schools widen access to research.",
      ],
    },
    {
      heading: "How is my information kept confidential?",
      body: [
        "Your answers are stored under a random study code, not your name. The link between your code and your account is kept separately and is used only to connect your three questionnaires, to send you reminders if you agree, and to delete your answers if you ask.",
        "Only the named research team can open the answers, and only as a dataset labelled with study codes. The conference committee, judges and other delegates cannot see them. Data are held in the website's secure database (the privacy notice says where it is hosted), with the same protection as your account.",
        "When the last questionnaire closes, the link between codes and accounts is permanently deleted, so the answers become anonymous. Results are published only as group figures and anonymised quotations, never in a way that identifies anyone.",
      ],
    },
    {
      heading: "What if I change my mind?",
      body: [
        "You can stop at any time from the Research study page in My Hub, without giving a reason. You can choose to keep the answers you have already given or to have them deleted. Deletion is possible until the answers are anonymised after the last questionnaire closes; after that we can no longer tell which answers are yours.",
      ],
    },
    {
      heading: "Data protection",
      body: [
        "We process your answers for research in the public interest (UK GDPR Article 6(1)(e)), and any information about your background as part of scientific research (Article 9(2)(j)), under the data protection policy of the sponsoring university. You can contact the university's data protection officer, or complain to the Information Commissioner's Office (ico.org.uk).",
      ],
    },
    {
      heading: "Who is running the study?",
      body: [
        `The study is led by ${lead}.${s.ethicsCommittee && s.ethicsReference ? ` It has been reviewed and approved by ${s.ethicsCommittee} (reference ${s.ethicsReference}).` : " It will not start until a university research ethics committee has approved it."} If you have questions or concerns, contact the lead researcher.`,
      ],
    },
  ];
}

export type ConsentStatement = { id: string; text: string; required: boolean };

export function consentStatements(s: StudySettings): ConsentStatement[] {
  return [
    { id: "read", text: `I have read the participant information (version ${s.infoVersion}) and had the chance to ask questions.`, required: true },
    { id: "age", text: "I am 18 or over.", required: true },
    { id: "voluntary", text: "I understand that taking part is voluntary, that I can stop at any time without giving a reason, and that this will not affect my place, presentation, prizes or certificate.", required: true },
    { id: "confidential", text: "I understand that my answers will be stored under a study code, seen only by the named research team, and published only in anonymised form.", required: true },
    { id: "agree", text: "I agree to take part in this study.", required: true },
    { id: "contact", text: "Optional: I agree to be emailed reminders when the next questionnaire opens.", required: false },
    { id: "linkage", text: "Optional: I agree that whether I checked in on the day may be linked to my study code (nothing else from my account is linked).", required: false },
    { id: "sharing", text: "Optional: I agree that my fully anonymised answers may be shared in a research data repository for other researchers to check or reuse.", required: false },
  ];
}
