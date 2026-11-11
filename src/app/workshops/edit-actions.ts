"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAccess } from "@/lib/auth";

export type WorkshopTextResult = { ok: true } | { ok: false; error: string } | null;

const schema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(3, "Give the workshop a name.").max(120, "Keep the name under 120 characters."),
  strapline: z.string().trim().max(160, "Keep the tagline under 160 characters."),
  summary: z.string().trim().max(400, "Keep the summary under 400 characters."),
  description: z.string().trim().max(3000, "Keep the description under 3,000 characters."),
});

/** Changes a workshop's name and wording from the page itself. Needs the "Edit the website" permission. */
export async function saveWorkshopText(input: z.input<typeof schema>): Promise<WorkshopTextResult> {
  const { db } = await requireAccess("edit_website", "/workshops");
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the details." };
  const { id, ...row } = parsed.data;
  const { data, error } = await db
    .from("workshops")
    .update({ title: row.title, strapline: row.strapline || null, summary: row.summary || null, description: row.description || null })
    .eq("id", id)
    .select("slug")
    .maybeSingle();
  if (error || !data) {
    if (error?.message.includes("VIEW_AS")) return { ok: false, error: "You're viewing as someone else, so changes are switched off." };
    return { ok: false, error: "We couldn't save that. Please try again." };
  }
  for (const p of ["/", "/workshops", `/workshops/${data.slug}`, "/programme", "/portal", "/admin/workshops", "/admin/content/workshops"]) revalidatePath(p);
  return { ok: true };
}
