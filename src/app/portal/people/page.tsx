import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NotebookPen, ScanLine } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { signAvatars } from "@/lib/avatar";
import { getSwitches } from "@/lib/switches";
import { Notice } from "@/components/ui/notice";
import { PeopleList, type SavedContact } from "@/components/card/people-list";

export const metadata: Metadata = { title: "People I've met" };
export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  const { profile, db } = await requireUser("/portal/people");
  const switches = await getSwitches();
  // Follows the Delegate Card: hidden until the card is live, except for the owner.
  if (!switches.delegate_card && !profile.access.owner) redirect("/portal");
  const { data, error } = await db.rpc("my_contacts");
  const contacts = (data ?? []) as SavedContact[];
  const photos = await signAvatars(db, contacts.map((p) => p.card?.avatar_path));
  for (const p of contacts) if (p.card?.avatar_path) p.card.avatar_url = photos.get(p.card.avatar_path) ?? null;

  return (
    <div className="space-y-5 sm:space-y-6">
      <header className="relative overflow-hidden rounded-xl bg-midnight p-6 text-paper sm:p-8">
        <img src="/brand/crest-white.png" alt="" aria-hidden className="pointer-events-none absolute -bottom-10 -right-6 h-48 w-auto opacity-[0.07]" />
        <div className="relative">
          <p className="eyebrow flex items-center gap-2 text-gold">
            <NotebookPen aria-hidden className="size-4" /> People I&apos;ve met
          </p>
          <h1 className="mt-3 font-display text-3xl sm:text-4xl">Keep in touch</h1>
          <p className="mt-3 max-w-xl text-sm text-paper/75 sm:text-base">
            Everyone you&apos;ve saved by scanning their Delegate Card, with your private notes. Only you can see this list.
          </p>
          <p className="mt-4 flex max-w-xl items-start gap-2 text-sm text-paper/85">
            <ScanLine aria-hidden className="mt-0.5 size-4 shrink-0 text-gold" />
            <span>To add someone, point your phone camera at the QR code on the back of their card.</span>
          </p>
        </div>
      </header>
      {error ? (
        <Notice tone="warning">Your saved people aren&apos;t available just now. Please try again later.</Notice>
      ) : (
        <PeopleList initial={contacts} />
      )}
    </div>
  );
}
