"use client";
import { BookmarkCheck, BookmarkPlus } from "lucide-react";
import { useAgenda } from "@/components/programme/agenda-context";
import { cn } from "@/lib/cn";

export function SaveWorkshopButton({ id, title }: { id: string; title: string }) {
  const agenda = useAgenda();
  const saved = agenda.workshops.has(id);
  return (
    <button
      type="button"
      aria-pressed={saved}
      onClick={() => agenda.toggleWorkshop(id, title)}
      className={cn(
        "inline-flex min-h-12 items-center gap-2 rounded-[3px] px-6 font-ui font-semibold transition-colors",
        saved ? "bg-paper text-midnight" : "bg-cyan text-midnight hover:bg-cyan-300",
      )}
    >
      {saved ? <BookmarkCheck aria-hidden className="size-4" /> : <BookmarkPlus aria-hidden className="size-4" />}
      {saved ? "Saved to my agenda" : "Add to my agenda"}
    </button>
  );
}
