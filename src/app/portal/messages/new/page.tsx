import { NewMessage } from "@/components/messages/new-message";
import { requireUser } from "@/lib/auth";
import { loadContacts } from "@/lib/messages-server";
import { getSwitches } from "@/lib/switches";

export const dynamic = "force-dynamic";

export default async function NewMessagePage() {
  const { db, profile } = await requireUser("/portal/messages/new");
  const committee = profile.access.owner || profile.access.can.message_people;
  const [contacts, switches] = await Promise.all([loadContacts(db), committee ? null : getSwitches()]);
  let unavailable: string | null = null;
  if (!committee) {
    if (profile.accountStatus !== "approved") unavailable = "You can message other delegates once the committee confirms your place. The committee can still message you, and you can reply.";
    else if (!switches?.network_open || !switches.delegate_messages) unavailable = "Messages between delegates open with the delegate network. The committee can still message you, and you can reply.";
  }
  return <NewMessage contacts={contacts} committee={committee} unavailable={unavailable} />;
}
