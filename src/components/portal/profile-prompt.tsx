"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, Camera, FileText, GraduationCap, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { dismissProfilePrompt } from "@/app/portal/actions";
import { Avatar } from "@/components/ui/avatar";
import type { ProfileGap } from "@/lib/profile-prompt";
import { PROFILE_ITEMS } from "@/lib/profile-prompt";

const ICON = { photo: Camera, details: GraduationCap, bio: FileText, linkedin: LinkedIn } as const;

function LinkedIn({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z" />
    </svg>
  );
}

/**
 * Shown once after signing in, while someone's profile is unfinished: what's
 * missing, with a link to each, and a way to carry on without.
 */
export function ProfilePrompt({ gaps, name, photo }: { gaps: ProfileGap[]; name: string | null; photo: string | null }) {
  const path = usePathname();
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(true);
  const titleId = useId();
  const descId = useId();
  // They're already on the profile page, so there's nothing to point them to.
  const here = path === "/portal/profile";

  useEffect(() => {
    if (here) {
      void dismissProfilePrompt();
      return;
    }
    const d = dialog.current;
    if (open && d && !d.open) d.showModal();
  }, [open, here]);

  if (here || !open) return null;

  const close = () => {
    setOpen(false);
    dialog.current?.close();
    void dismissProfilePrompt();
  };
  const go = (href: string) => {
    close();
    router.push(href);
  };

  const done = PROFILE_ITEMS - gaps.length;
  const first = name?.split(" ")[0];

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      aria-describedby={descId}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      className="m-auto w-[min(30rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl bg-white p-0 text-ink shadow-[0_40px_90px_-30px_rgba(12,24,44,0.7)] backdrop:bg-midnight/60 backdrop:backdrop-blur-[2px] open:animate-[enter-pop_0.45s_var(--ease-out-expo)] motion-reduce:open:animate-none"
    >
      <div className="relative overflow-hidden bg-midnight px-6 pb-6 pt-7 text-paper sm:px-7">
        <div aria-hidden className="lanyard-grid pointer-events-none absolute inset-0 opacity-20" />
        <button type="button" onClick={close} className="absolute right-3 top-3 grid size-11 place-items-center rounded-full text-paper/70 hover:bg-white/10 hover:text-paper focus-visible:outline-2 focus-visible:outline-gold" aria-label="Close">
          <X aria-hidden className="size-5" />
        </button>
        <div className="relative flex items-center gap-4">
          <span className="relative">
            <Avatar url={photo} name={name} className="size-16 ring-4 ring-white/10" fallbackClassName="bg-paper/10 text-lg text-gold-300" />
            {!photo && (
              <span aria-hidden className="absolute -bottom-1 -right-1 grid size-7 place-items-center rounded-full bg-gold text-midnight ring-2 ring-midnight">
                <Camera className="size-3.5" />
              </span>
            )}
          </span>
          <div className="min-w-0">
            <p className="eyebrow text-gold">
              {done} of {PROFILE_ITEMS} done
            </p>
            <h2 id={titleId} className="mt-1 font-display text-2xl leading-tight">
              {first ? `${first}, finish your profile` : "Finish your profile"}
            </h2>
          </div>
        </div>
        <div aria-hidden className="relative mt-5 flex gap-1.5">
          {Array.from({ length: PROFILE_ITEMS }, (_, i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full ${i < done ? "bg-gold" : "bg-white/15"}`} />
          ))}
        </div>
      </div>

      <div className="px-6 py-6 sm:px-7">
        <p id={descId} className="text-sm text-slate-700">
          It takes a couple of minutes and helps people recognise you and keep in touch. Here&apos;s what&apos;s left:
        </p>
        <ul className="mt-4 space-y-2">
          {gaps.map((g) => {
            const Icon = ICON[g.key];
            return (
              <li key={g.key}>
                <Link
                  href={g.href}
                  onClick={(e) => {
                    e.preventDefault();
                    go(g.href);
                  }}
                  className="group flex min-h-14 items-center gap-3.5 rounded-xl border border-navy/10 px-4 py-3 transition-colors hover:border-navy/30 hover:bg-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric-600"
                >
                  <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-cyan/15 text-navy">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-ink">{g.label}</span>
                    <span className="block text-sm text-slate-700">{g.hint}</span>
                  </span>
                  <ArrowRight aria-hidden className="size-4 shrink-0 text-slate transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={close} className="min-h-12 rounded-[3px] px-5 font-ui text-sm font-semibold text-slate-700 hover:text-ink">
            Not now
          </button>
          <button type="button" onClick={() => go(gaps[0]?.href ?? "/portal/profile")} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[3px] bg-navy px-5 font-ui text-sm font-semibold text-paper hover:bg-navy-700">
            Complete my profile <ArrowRight aria-hidden className="size-4" />
          </button>
        </div>
      </div>
    </dialog>
  );
}
