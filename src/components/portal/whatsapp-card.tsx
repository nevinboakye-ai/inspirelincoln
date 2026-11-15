import { ArrowUpRight, MessageCircle } from "lucide-react";

/** The official INSPIRE WhatsApp group. The QR code in /public is the one the committee shared and opens the same group. */
export const WHATSAPP_GROUP_URL = "https://chat.whatsapp.com/JefzdkzTAd71yPm7uGXsW2?s=qt&p=i&iam=2";

/**
 * Shown in My Hub while the WhatsApp group switch is on. On a phone the
 * button opens WhatsApp straight away; on a computer the QR code can be
 * scanned with a phone camera.
 */
export function WhatsAppCard({ previewNote }: { previewNote?: string | null }) {
  return (
    <section aria-labelledby="whatsapp-h" className="app-card p-4 sm:p-5">
      <h2 id="whatsapp-h" className="flex items-center gap-2 font-display text-lg text-ink">
        <span className="icon-chip-sm bg-[#25D366]/15 text-[#0b7a3b]">
          <MessageCircle aria-hidden className="size-4" />
        </span>
        Join the WhatsApp group
      </h2>
      <p className="mt-2 text-sm text-slate-700">
        The official INSPIRE group chat for delegates and the committee. Updates on the day, reminders, and a place to say hello before you arrive.
      </p>
      <div className="mt-3 flex items-center gap-4">
        <img
          src="/whatsapp/inspire-group-qr.png"
          alt="QR code to join the INSPIRE WhatsApp group"
          width={376}
          height={376}
          className="size-28 shrink-0 rounded-xl border border-navy/10 bg-white p-1 sm:size-32 xl:size-28"
        />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="hidden text-xs text-slate sm:block">Scan with your phone camera, or use the button.</p>
          <a
            href={WHATSAPP_GROUP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="tap inline-flex min-h-12 w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-[#25D366] px-4 font-ui text-sm font-semibold text-[#06301a] hover:bg-[#1fbd5a]"
          >
            Join group
            <ArrowUpRight aria-hidden className="size-4" />
            <span className="sr-only">(opens WhatsApp)</span>
          </a>
        </div>
      </div>
      {previewNote && <p className="mt-3 rounded-md bg-paper p-2.5 text-xs text-slate-700">{previewNote}</p>}
    </section>
  );
}
