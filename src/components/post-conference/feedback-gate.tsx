"use client";
import { usePathname } from "next/navigation";
import { Award, BookOpen, Images, MessageSquareQuote, Sparkles } from "lucide-react";
import { FeedbackForm } from "@/components/post-conference/feedback-form";
import type { FeedbackWorkshop } from "@/lib/post-conference/feedback";

type Workshops = { workshops: FeedbackWorkshop[]; mine: string[] };

/** Pages that stay open before feedback: privacy and account rights, contacting the committee, and the research study. */
const OPEN = /^\/portal\/(profile|enquiries|research)(\/|$)/;

/**
 * Once the post-conference hub opens, everyone with a confirmed place gives
 * quick feedback before using My Hub again. Every other My Hub page shows
 * the form in its place until they've sent it.
 */
export function PostConferenceGate({
  required,
  presenter,
  firstName,
  workshops,
  children,
}: {
  required: boolean;
  presenter: boolean;
  firstName: string | null;
  workshops?: Workshops;
  children: React.ReactNode;
}) {
  const path = usePathname();
  if (!required || OPEN.test(path)) return <>{children}</>;
  return <FeedbackUnlock presenter={presenter} firstName={firstName} workshops={workshops} />;
}

/** The feedback form under a header that says what it unlocks. */
export function FeedbackUnlock({ presenter, firstName, workshops, preview = false }: { presenter: boolean; firstName: string | null; workshops?: Workshops; preview?: boolean }) {
  const unlocks = [
    { icon: Images, label: "Conference photos" },
    { icon: Award, label: "Certificates" },
    { icon: BookOpen, label: "Post-conference booklet" },
    ...(presenter ? [{ icon: MessageSquareQuote, label: "Judges' feedback" }] : []),
  ];
  return (
    <div className="max-w-2xl space-y-4">
      <header className="relative isolate overflow-hidden rounded-2xl bg-midnight px-5 py-5 text-paper sm:px-7 sm:py-7">
        <span aria-hidden className="hub-orb -left-16 -top-20 size-60 bg-navy-600/70" />
        <span aria-hidden className="hub-orb -bottom-24 right-[-4rem] size-64 bg-gold/25 [animation-delay:-6s]" />
        <div aria-hidden className="lanyard-grid pointer-events-none absolute inset-0 opacity-25" />
        <div className="relative">
          <p className="eyebrow flex items-center gap-1.5 text-gold">
            <Sparkles aria-hidden className="size-3.5" /> {preview ? "Preview · " : ""}About a minute
          </p>
          <h1 className="mt-1.5 font-display text-2xl leading-[1.1] sm:text-4xl">
            Thanks for coming{firstName ? `, ${firstName}` : ""}.
            <span className="hidden text-paper/80 sm:block">Tell us how it went.</span>
          </h1>
          <p className="mt-1.5 max-w-lg text-sm text-paper/75 sm:mt-2 sm:text-base">
            <span className="sm:hidden">A few taps unlock your post-conference hub:</span>
            <span className="hidden sm:inline">A few taps, then your post-conference hub opens. Everything from the day will be there as it&apos;s ready.</span>
          </p>
          <ul className="no-scrollbar -mx-5 mt-3 flex gap-1.5 overflow-x-auto px-5 sm:mx-0 sm:mt-4 sm:flex-wrap sm:gap-2 sm:px-0" aria-label="What the hub gives you">
            {unlocks.map((u) => (
              <li key={u.label} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs sm:px-3 sm:py-1.5 font-semibold text-paper ring-1 ring-white/15">
                <u.icon aria-hidden className="size-3.5 text-cyan" />
                {u.label}
              </li>
            ))}
          </ul>
        </div>
      </header>
      <FeedbackForm presenter={presenter} workshops={workshops?.workshops} myWorkshops={workshops?.mine} preview={preview} />
    </div>
  );
}
