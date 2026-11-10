import { z } from "zod";
import type { AbstractConfig } from "@/lib/types";

export const ABSTRACT_SECTIONS = ["background", "aim", "methods", "results", "conclusion"] as const;
export type AbstractSection = (typeof ABSTRACT_SECTIONS)[number];

export const countWords = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

/**
 * Builds the abstract schema from the edition's configurable limits. Drafts may
 * be incomplete; submissions must be complete and within limits.
 */
export function abstractSchema(cfg: AbstractConfig, mode: "draft" | "submit") {
  const section = z
    .string()
    .trim()
    .max(5000)
    .refine((v) => countWords(v) <= cfg.sectionWordLimit, { message: `Keep this section to ${cfg.sectionWordLimit} words or fewer.` });
  const required = (s: z.ZodType<string>, msg: string) => (mode === "submit" ? s.refine((v) => v.length > 0, { message: msg }) : s);

  return z
    .object({
      presentingAuthor: z.string().trim().min(2, "Enter the presenting author's name.").max(120),
      email: z.string().trim().email("Enter a valid email address.").max(254),
      university: z.string().trim().min(2, "Enter your university.").max(160),
      programmeYear: z.string().trim().min(2, "Enter your programme and year of study.").max(120),
      title: z.string().trim().min(5, "Enter a title of at least 5 characters.").max(300),
      coAuthors: z.string().trim().max(2000).default(""),
      category: z.string().refine((v) => cfg.categories.includes(v), { message: "Choose a research category." }),
      presentationPreference: z.string().optional().default(""),
      background: required(section, "Add a background."),
      aim: required(section, "Add an aim."),
      methods: required(section, "Add your methods."),
      results: required(section, "Add your results."),
      conclusion: required(section, "Add a conclusion."),
      consentData: mode === "submit" ? z.literal(true, { message: "This consent is required to submit." }) : z.boolean().default(false),
      declarationOriginal: mode === "submit" ? z.literal(true, { message: "This declaration is required to submit." }) : z.boolean().default(false),
      consentShowcase: z.boolean().default(false),
    })
    .superRefine((v, ctx) => {
      const total = ABSTRACT_SECTIONS.reduce((n, k) => n + countWords(v[k]), 0);
      if (total > cfg.totalWordLimit) ctx.addIssue({ code: "custom", path: ["conclusion"], message: `Your abstract is ${total} words; the limit is ${cfg.totalWordLimit}.` });
    });
}

export type AbstractInput = z.infer<ReturnType<typeof abstractSchema>>;

export const ABSTRACT_STATUS_LABEL: Record<string, { label: string; tone: "neutral" | "electric" | "success" | "warning" | "danger" | "violet" }> = {
  draft: { label: "Draft", tone: "neutral" },
  submitted: { label: "Submitted", tone: "electric" },
  under_review: { label: "Under review", tone: "violet" },
  accepted: { label: "Accepted", tone: "success" },
  rejected: { label: "Not accepted", tone: "danger" },
  waitlisted: { label: "Waitlisted", tone: "warning" },
  withdrawn: { label: "Withdrawn", tone: "neutral" },
};

export const FILE_RULES = {
  abstract: { types: ["application/pdf"], label: "PDF" },
  poster: { types: ["application/pdf", "image/png", "image/jpeg"], label: "PDF, PNG or JPEG", maxMb: 25 },
};
