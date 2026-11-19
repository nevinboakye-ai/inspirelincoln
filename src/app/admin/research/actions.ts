"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAccess } from "@/lib/auth";
import { getViewAs } from "@/lib/supabase/server";
import { fromZonedInputValue } from "@/lib/time";
import { STAGES, type Stage } from "@/lib/research/instrument";
import { launchBlockers, settingsFromRow, windowOf } from "@/lib/research/schedule";
import { researchEmail } from "@/lib/research/emails";
import { emailConfigured, sendBatch } from "@/lib/email/resend";

const PAGE = "/admin/research";

async function gate() {
  const current = await requireAccess("research_data", PAGE);
  if (await getViewAs()) redirect(`${PAGE}?error=view_as`);
  return current;
}

const text = (max: number) => z.string().trim().max(max).transform((v) => (v ? v : null));

/** Contact details, versions and the questionnaire windows. */
export async function saveStudySettings(form: FormData) {
  const { db, user } = await gate();
  const v = z
    .object({
      lead_name: text(120),
      lead_email: z.union([z.literal(""), z.string().trim().email().max(200)]).transform((v) => v || null),
      info_version: z.string().trim().min(1).max(20),
      protocol_version: z.string().trim().min(1).max(20),
      event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })
    .safeParse({
      lead_name: String(form.get("lead_name") ?? ""),
      lead_email: String(form.get("lead_email") ?? ""),
      info_version: String(form.get("info_version") ?? "1.0"),
      protocol_version: String(form.get("protocol_version") ?? "1.0"),
      event_date: String(form.get("event_date") ?? ""),
    });
  if (!v.success) redirect(`${PAGE}?error=settings`);
  const when = (k: string) => fromZonedInputValue(String(form.get(k) ?? ""));
  const row = {
    ...v.data,
    pre_closes_at: when("pre_closes_at"),
    post_opens_at: when("post_opens_at"),
    post_closes_at: when("post_closes_at"),
    followup_opens_at: when("followup_opens_at"),
    followup_closes_at: when("followup_closes_at"),
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  };
  const { error } = await db.from("research_study").update(row).eq("id", 1);
  // A running study can't lose its approval details: the database refuses.
  if (error) redirect(`${PAGE}?error=${error.code === "23514" ? "running" : "settings"}`);
  revalidatePath(PAGE);
  redirect(`${PAGE}?saved=settings`);
}

/** The switch. On only once every blocker is cleared (the database checks this too). */
export async function setStudyEnabled(form: FormData) {
  const { db, user } = await gate();
  const on = form.get("enabled") === "on";
  if (on) {
    const { data } = await db.from("research_study").select("*").eq("id", 1).maybeSingle();
    if (launchBlockers(settingsFromRow(data)).length) redirect(`${PAGE}?error=blocked`);
  }
  const { error } = await db.from("research_study").update({ enabled: on, updated_by: user.id, updated_at: new Date().toISOString() }).eq("id", 1);
  if (error) redirect(`${PAGE}?error=${error.code === "23514" ? "blocked" : "settings"}`);
  revalidatePath("/", "layout");
  redirect(`${PAGE}?saved=${on ? "on" : "off"}`);
}

/**
 * Emails: an invitation to everyone eligible who hasn't answered (while the
 * first questionnaire is open), or a reminder to participants who agreed to
 * reminders and haven't done the open questionnaire. Nobody is reminded more
 * than once in two days. The email says nothing about anyone's answers.
 */
export async function sendResearchEmails(form: FormData) {
  const { db } = await gate();
  const kind = String(form.get("kind"));
  if (!emailConfigured()) redirect(`${PAGE}?error=email`);
  const { data: st } = await db.from("research_study").select("*").eq("id", 1).maybeSingle();
  const s = settingsFromRow(st);
  if (!s.enabled) redirect(`${PAGE}?error=off`);

  let list: { email: string; full_name: string | null }[] = [];
  let stage: Stage = "pre";
  if (kind === "invite") {
    const { data, error } = await db.rpc("research_invite_list");
    if (error) redirect(`${PAGE}?error=settings`);
    list = (data ?? []) as typeof list;
  } else if ((STAGES as readonly string[]).includes(kind)) {
    stage = kind as Stage;
    const { data, error } = await db.rpc("research_reminder_list", { p_stage: stage });
    if (error) redirect(`${PAGE}?error=settings`);
    list = (data ?? []) as typeof list;
  } else redirect(`${PAGE}?error=settings`);

  const closesAt = windowOf(s, stage).closes;
  const messages = list.map((p) => researchEmail({ kind: kind === "invite" ? "invite" : stage, to: p.email, name: p.full_name, closesAt, settings: s }));
  const sent = messages.length ? await sendBatch(messages) : 0;
  redirect(`${PAGE}?sent=${sent}&of=${messages.length}`);
}

/** After the last questionnaire closes: break the link between codes and accounts for good. */
export async function anonymiseStudy(form: FormData) {
  const { db } = await requireAccess("owner", PAGE);
  if (await getViewAs()) redirect(`${PAGE}?error=view_as`);
  if (String(form.get("confirm") ?? "").trim().toUpperCase() !== "ANONYMISE") redirect(`${PAGE}?error=confirm`);
  const { error } = await db.rpc("research_anonymise");
  if (error) redirect(`${PAGE}?error=${error.code === "P0001" ? "too_early" : "settings"}`);
  revalidatePath(PAGE);
  redirect(`${PAGE}?saved=anonymised`);
}
