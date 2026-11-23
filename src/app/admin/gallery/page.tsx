import type { Metadata } from "next";
import Link from "next/link";
import { Images } from "lucide-react";
import { requireAccess } from "@/lib/auth";
import { AdminHeader, btn } from "@/components/admin/ui";
import { Notice } from "@/components/ui/notice";
import { GalleryModeration, type QueuePhoto, type QueueView } from "@/components/admin/gallery-moderation";
import { signGallery } from "@/lib/post-conference/gallery";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Photo gallery" };
export const dynamic = "force-dynamic";

const TABS: { key: QueueView; label: string }[] = [
  { key: "pending", label: "Waiting" },
  { key: "reported", label: "Reported" },
  { key: "accepted", label: "In the gallery" },
  { key: "rejected", label: "Not accepted" },
];

type Row = {
  id: string;
  path: string;
  caption: string | null;
  uploader: string;
  created_at: string;
  review_note: string | null;
  reviewed_at: string | null;
  reviewer: string | null;
  report_note: string | null;
};

/** Photos people have added to the gallery in My Hub, for the committee to accept or reject. */
export default async function GalleryAdmin({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const sp = await searchParams;
  const view: QueueView = TABS.some((t) => t.key === sp.view) ? (sp.view as QueueView) : "pending";
  const { db } = await requireAccess("moderate_gallery", "/admin/gallery");

  const [{ data, error }, counts] = await Promise.all([
    db.rpc("gallery_queue", { p_status: view }),
    Promise.all(
      (["pending", "accepted", "rejected"] as const).map((s) =>
        db.from("gallery_photos").select("id", { count: "exact", head: true }).eq("status", s).then((r) => [s, r.count ?? 0] as const),
      ),
    ).then(async (c) => {
      const reported = await db.from("gallery_photos").select("id", { count: "exact", head: true }).eq("status", "pending").not("reported_at", "is", null);
      return { ...Object.fromEntries(c), reported: reported.count ?? 0 } as Record<QueueView, number>;
    }),
  ]);

  if (error) {
    return (
      <div className="space-y-6">
        <AdminHeader title="Photo gallery" />
        <Notice tone="warning" title="One database step left">
          Run <code>20261223000000_post_conference_feedback_and_gallery.sql</code> in the Supabase SQL editor to add the gallery.
        </Notice>
      </div>
    );
  }

  const rows = (data ?? []) as Row[];
  const urls = await signGallery(db, rows.map((r) => r.path));
  const photos: QueuePhoto[] = rows.map((r) => ({
    id: r.id,
    url: urls.get(r.path) ?? null,
    caption: r.caption,
    uploader: r.uploader,
    createdAt: r.created_at,
    reviewNote: r.review_note,
    reviewer: r.reviewer,
    reviewedAt: r.reviewed_at,
    reportNote: r.report_note,
  }));

  return (
    <div className="space-y-5">
      <AdminHeader
        title="Photo gallery"
        description="Photos delegates add in My Hub wait here until someone accepts them. Only accepted photos appear in the gallery slideshow. If someone asks for a photo to be taken down, it's hidden straight away and shows under Reported."
        actions={
          <Link href="/portal/gallery" className={btn.secondary}>
            <Images aria-hidden className="size-4" /> Open the gallery
          </Link>
        }
      />
      <nav aria-label="Photo lists" className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {TABS.map((t) => {
          const on = t.key === view;
          const n = counts[t.key];
          return (
            <Link
              key={t.key}
              href={t.key === "pending" ? "/admin/gallery" : `/admin/gallery?view=${t.key}`}
              aria-current={on ? "page" : undefined}
              className={cn(
                "tap inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold",
                on ? "bg-navy text-paper" : "bg-white text-slate-700 ring-1 ring-navy/[0.08] hover:bg-paper-200",
              )}
            >
              {t.label}
              <span className={cn("grid min-w-6 place-items-center rounded-full px-1.5 text-xs leading-6", on ? "bg-gold text-midnight" : (t.key === "pending" || t.key === "reported") && n ? "bg-coral text-white" : "bg-paper-200 text-slate-700")}>{n}</span>
            </Link>
          );
        })}
      </nav>
      <GalleryModeration key={view} view={view} photos={photos} />
    </div>
  );
}
