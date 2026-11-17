import { describe, expect, it } from "vitest";
import { unreadMessagesEmail } from "@/lib/email/messages";
import { groupDueEmails } from "@/lib/message-emails";

const row = (user: string, conversation: string, sender: string, unread: number) => ({
  user_id: user, email: `${user}@x.test`, full_name: `${user} Person`, conversation_id: conversation, sender_name: sender, unread,
});

describe("unread message emails", () => {
  it("sends one email per person, covering all their conversations", () => {
    const mails = groupDueEmails([row("amy", "c1", "Ben", 2), row("amy", "c2", "Cat", 1), row("dan", "c3", "Ben", 1)], "https://site.test");
    expect(mails).toHaveLength(2);
    const amy = mails.find((m) => m.to === "amy@x.test")!;
    expect(amy.subject).toBe("You have unread messages from Ben and Cat on INSPIRE");
    expect(amy.html).toContain("https://site.test/portal/messages\"");
    expect(amy.text).toContain("3 unread messages");
  });
  it("links straight to the conversation when there is only one", () => {
    const m = unreadMessagesEmail({ siteUrl: "https://site.test", name: "Amy Jones", conversations: [{ conversationId: "c1", sender: "Ben <b>", unread: 1 }] });
    expect(m.subject).toBe("Unread message from Ben <b> on INSPIRE");
    expect(m.html).toContain("https://site.test/portal/messages/c1");
    expect(m.html).toContain("Ben &lt;b&gt;");
    expect(m.html).not.toContain("Ben <b>");
  });
});
