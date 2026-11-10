import { z } from "zod";

export const ENQUIRY_CATEGORIES = {
  general: "General enquiry",
  speakers_workshops: "Speaker and workshop enquiries",
  research_abstracts: "Research and abstract enquiries",
  partnerships: "Partnership and sponsorship enquiries",
  accessibility: "Accessibility enquiries",
} as const;

export type EnquiryCategory = keyof typeof ENQUIRY_CATEGORIES;

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name.").max(120, "Name is too long."),
  email: z.string().trim().max(254).email("Please enter a valid email address."),
  category: z.enum(Object.keys(ENQUIRY_CATEGORIES) as [EnquiryCategory, ...EnquiryCategory[]], { message: "Please choose a category." }),
  subject: z.string().trim().min(3, "Please add a short subject.").max(160, "Subject is too long."),
  message: z.string().trim().min(20, "Please write at least 20 characters.").max(5000, "Message is too long (5,000 characters maximum)."),
  consent: z.literal(true, { message: "Please confirm we can use your details to respond." }),
  // Spam traps: must be empty / old enough. Not shown to people.
  website: z.string().max(0).optional(),
  startedAt: z.number().optional(),
});

export type ContactInput = z.infer<typeof contactSchema>;
