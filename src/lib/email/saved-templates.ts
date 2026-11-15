import type { SupabaseClient } from "@supabase/supabase-js";
import { EMAIL_PRESETS, type EmailPreset } from "@/lib/email/presets";

type SavedRow = {
  id: string;
  subject: string;
  body: string;
  audience: Partial<EmailPreset["audience"]> | null;
  login: boolean;
  updated_name: string;
  updated_at: string;
};

/**
 * The Group email templates, with the committee's saved edits in place of
 * the original wording. If the saved templates can't be read (for example
 * before setup file 48 has been run), the originals are used.
 */
export async function loadEmailTemplates(db: SupabaseClient): Promise<EmailPreset[]> {
  const { data, error } = await db.from("email_templates").select("id, subject, body, audience, login, updated_name, updated_at");
  if (error || !data) return EMAIL_PRESETS;
  const saved = new Map((data as SavedRow[]).map((r) => [r.id, r]));
  return EMAIL_PRESETS.map((p) => {
    const s = saved.get(p.id);
    if (!s) return p;
    const a = s.audience ?? {};
    return {
      ...p,
      subject: s.subject,
      body: s.body,
      login: s.login,
      audience: {
        types: Array.isArray(a.types) ? a.types : p.audience.types,
        statuses: Array.isArray(a.statuses) ? a.statuses : p.audience.statuses,
        includeSelected: typeof a.includeSelected === "boolean" ? a.includeSelected : p.audience.includeSelected,
        notAccepted: Array.isArray(a.notAccepted) ? a.notAccepted : p.audience.notAccepted,
      },
      saved: { by: s.updated_name, at: s.updated_at },
    };
  });
}
