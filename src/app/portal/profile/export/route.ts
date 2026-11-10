import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** UK GDPR right of access and portability: everything INSPIRE holds about you, as JSON. */
export async function GET() {
  const current = await getCurrentUser();
  if (!current) return NextResponse.redirect(new URL("/login?next=/portal/profile", process.env.NEXT_PUBLIC_SITE_URL || "https://inspirelincoln.uk"));
  const { db, user } = current;
  const [profile, registrations, consents, submissions, agenda, workshops, abstracts, enquiries] = await Promise.all([
    db.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    db.from("registrations").select("status, source, checked_in_at, created_at, updated_at").eq("user_id", user.id),
    db.from("consent_records").select("purpose, granted, policy_version, source, created_at").eq("user_id", user.id).order("created_at"),
    db.from("presentation_submissions").select("kind, version, title, presenter_note, file_name, file_type, file_size, status, created_at, submission_feedback(author_name, decision, body, created_at)").eq("user_id", user.id),
    db.from("agenda_items").select("session_id, created_at").eq("user_id", user.id),
    db.from("saved_workshops").select("workshop_id, created_at").eq("user_id", user.id),
    db.from("abstracts").select("reference, title, status, presenting_author, email, university, created_at, submitted_at").eq("submitter_id", user.id),
    db.from("contact_enquiries").select("subject, category, created_at").eq("email", user.email ?? ""),
  ]);
  const p = profile.data ?? {};
  // Internal review fields are left out, but the decision and note are included.
  delete (p as Record<string, unknown>).reviewed_by;
  const body = {
    exported_at: new Date().toISOString(),
    controller: "INSPIRE National Medical Research Conference",
    account: { email: user.email, created_at: user.created_at, last_sign_in_at: user.last_sign_in_at },
    profile: p,
    registrations: registrations.data ?? [],
    consent_history: consents.data ?? [],
    submissions: submissions.data ?? [],
    saved_sessions: agenda.data ?? [],
    saved_workshops: workshops.data ?? [],
    abstracts: abstracts.data ?? [],
    contact_enquiries: enquiries.data ?? [],
  };
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="inspire-my-data-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
