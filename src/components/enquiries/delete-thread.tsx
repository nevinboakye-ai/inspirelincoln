"use client";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { deleteEnquiry } from "@/app/portal/enquiry-actions";

/** Deletes a whole conversation, after asking. */
export function DeleteThread({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm("Delete this whole conversation for everyone? It can't be undone.")) return;
          start(async () => {
            const r = await deleteEnquiry(id);
            if (!r.ok) return setError(r.error);
            router.push("/admin/enquiries");
          });
        }}
        className="inline-flex min-h-11 items-center gap-2 rounded-[3px] px-3 text-sm font-semibold text-danger hover:bg-danger/[0.05] disabled:opacity-60"
      >
        <Trash2 aria-hidden className="size-4" /> Delete conversation
      </button>
      {error && <p role="alert" className="mt-1 text-sm text-danger">{error}</p>}
    </div>
  );
}
