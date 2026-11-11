"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { CARD_CODE, cleanCode } from "@/lib/card";
import type { ActionResult } from "@/app/portal/actions";

const NOTE_MAX = 500;
const UUID = /^[0-9a-f-]{36}$/i;

/** Save someone whose card you've scanned to "People I've met", with an optional private note. */
export async function saveContact(input: { code: string; note?: string | null }): Promise<ActionResult> {
  const { db } = await requireUser("/portal/people");
  const code = cleanCode(String(input.code ?? ""));
  if (!CARD_CODE.test(code)) return { ok: false, error: "That card code isn't valid." };
  const note = String(input.note ?? "").trim();
  if (note.length > NOTE_MAX) return { ok: false, error: `Keep your note under ${NOTE_MAX} characters.` };
  const { data, error } = await db.rpc("save_contact", { code, note: note || null });
  if (error) return { ok: false, error: "We couldn't save them just now. Please try again." };
  const res = data as { ok: boolean; state?: string };
  if (!res?.ok) return { ok: false, error: res?.state === "hidden" ? "They've turned off sharing, so they can't be saved." : "You can't save this card." };
  revalidatePath("/portal/people");
  return { ok: true, message: "Saved to People I've met." };
}

export async function updateContactNote(input: { id: string; note: string }): Promise<ActionResult> {
  const { db, user } = await requireUser("/portal/people");
  if (!UUID.test(input.id)) return { ok: false, error: "Something went wrong." };
  const note = String(input.note ?? "").trim();
  if (note.length > NOTE_MAX) return { ok: false, error: `Keep your note under ${NOTE_MAX} characters.` };
  const { error } = await db.from("saved_contacts").update({ note: note || null }).eq("owner_id", user.id).eq("contact_id", input.id);
  if (error) return { ok: false, error: "We couldn't save your note. Please try again." };
  revalidatePath("/portal/people");
  return { ok: true, message: note ? "Note saved." : "Note removed." };
}

export async function removeContact(id: string): Promise<ActionResult> {
  const { db, user } = await requireUser("/portal/people");
  if (!UUID.test(id)) return { ok: false, error: "Something went wrong." };
  const { error } = await db.from("saved_contacts").delete().eq("owner_id", user.id).eq("contact_id", id);
  if (error) return { ok: false, error: "We couldn't remove them. Please try again." };
  revalidatePath("/portal/people");
  return { ok: true, message: "Removed." };
}

/** Whether people who scan your card see your details. */
export async function setCardShared(on: boolean): Promise<ActionResult> {
  const { db, user } = await requireUser("/portal/profile");
  const { error } = await db.from("profiles").update({ card_shared: Boolean(on) }).eq("id", user.id);
  if (error) return { ok: false, error: "We couldn't save that. Please try again." };
  revalidatePath("/portal");
  revalidatePath("/portal/profile");
  return { ok: true, message: on ? "People who scan your card will see your details." : "People who scan your card won't see anything about you." };
}

/** Replace your card code. The old QR code stops working straight away. */
export async function newCardCode(): Promise<ActionResult> {
  const { db } = await requireUser("/portal/profile");
  const { error } = await db.rpc("new_my_card_code");
  if (error) return { ok: false, error: "We couldn't make a new code. Please try again." };
  revalidatePath("/portal");
  revalidatePath("/portal/profile");
  return { ok: true, message: "Done. Your card has a new QR code and the old one no longer works." };
}
