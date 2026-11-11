"use client";
import { Pencil } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { WorkshopTextEditor, type EditableWorkshop } from "@/components/conference/workshop-text-editor";
import { loadAccess } from "@/components/layout/edit-shortcut";
import { Overlay } from "@/components/ui/overlay";
import { hasSessionCookie } from "@/lib/supabase/session-hint";

/**
 * "Edit this workshop" on the public workshop page, shown only to committee
 * members who can edit the website. The page itself stays cached: the
 * permission check happens in the browser.
 */
export function WorkshopEditButton({ workshop }: { workshop: EditableWorkshop }) {
  const [canEdit, setCanEdit] = useState(false);
  const [open, setOpen] = useState(false);
  const titleId = useId();
  useEffect(() => {
    if (!hasSessionCookie()) return;
    let live = true;
    loadAccess().then((a) => live && setCanEdit(Boolean(a.edit)));
    return () => {
      live = false;
    };
  }, []);
  if (!canEdit) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-12 items-center gap-2 rounded-[3px] border border-gold/60 bg-gold/10 px-5 font-ui font-medium text-paper hover:bg-gold/20"
      >
        <Pencil aria-hidden className="size-4" /> Edit this workshop
      </button>
      <Overlay open={open} onClose={() => setOpen(false)} labelledBy={titleId}>
        <div className="shrink-0 border-b border-navy/10 px-6 pb-4 pt-6 pr-16">
          <h2 id={titleId} className="font-display text-2xl text-ink">
            Edit workshop
          </h2>
          <p className="mt-1 text-sm text-slate-700">Change the name and wording shown on the website and in My Hub.</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <WorkshopTextEditor workshop={workshop} onDone={() => setOpen(false)} onCancel={() => setOpen(false)} />
        </div>
      </Overlay>
    </>
  );
}
