import { MessagesSquare } from "lucide-react";

/** On laptops, the space beside the inbox before a conversation is chosen. Phones show only the inbox. */
export default function MessagesHome() {
  return (
    <div className="relative hidden h-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-navy/10 bg-white px-8 text-center lg:flex">
      <span aria-hidden className="lanyard-grid pointer-events-none absolute inset-0 opacity-[0.05]" />
      <span aria-hidden className="relative grid size-20 place-items-center rounded-full bg-[radial-gradient(circle_at_30%_30%,var(--color-cyan-300),var(--color-cyan))] text-navy shadow-[0_18px_40px_-20px_rgba(26,49,84,0.6)]">
        <MessagesSquare className="size-9" />
      </span>
      <p className="relative mt-5 font-display text-2xl text-ink">Choose a conversation</p>
      <p className="relative mt-2 max-w-sm text-sm text-slate-700">Pick someone from your messages, or start a new conversation. Only the two of you can see what you send.</p>
    </div>
  );
}
