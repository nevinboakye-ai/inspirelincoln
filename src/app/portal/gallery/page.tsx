import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ImagePlus, Images, ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getPostConference } from "@/lib/post-conference/server";
import { loadGallery, loadMyUploads } from "@/lib/post-conference/gallery";
import { getEdition } from "@/lib/data/content";
import { GallerySlideshow } from "@/components/post-conference/gallery-slideshow";
import { GalleryUpload } from "@/components/post-conference/gallery-upload";
import { MyUploads } from "@/components/post-conference/my-uploads";

export const metadata: Metadata = { title: "Gallery" };
export const dynamic = "force-dynamic";

/** Photos from the day as a slideshow, and a place to add your own. */
export default async function GalleryPage() {
  const { db, profile, user } = await requireUser("/portal/gallery");
  const after = await getPostConference(db, profile);
  if (!after.member) redirect("/portal");
  // Before feedback the portal layout shows the form here instead; the site owner and moderators go straight in.
  if (!after.ready || (!after.done && !after.moderator)) redirect("/portal/after");

  const [photos, mine, edition, waiting] = await Promise.all([
    loadGallery(db),
    loadMyUploads(db, user.id),
    getEdition(),
    after.moderator ? db.from("gallery_photos").select("id", { count: "exact", head: true }).eq("status", "pending").then((r) => r.count ?? 0) : 0,
  ]);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow flex items-center gap-1.5 text-electric-600">
            <Images aria-hidden className="size-3.5" /> INSPIRE {edition.year}
          </p>
          <h1 className="mt-1 font-display text-3xl leading-tight text-ink sm:text-4xl">Gallery</h1>
          <p className="mt-1 text-sm text-slate-700 sm:text-base">
            {photos.length ? `${photos.length} photo${photos.length === 1 ? "" : "s"} from the day.` : "Photos from the day."} Only people with an INSPIRE account can see them.
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          {after.moderator && (
            <Link href="/admin/gallery" className="tap inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full border border-navy/15 bg-white px-4 font-ui text-sm font-semibold text-ink sm:flex-none">
              <ShieldCheck aria-hidden className="size-4 text-electric-600" />
              Review{waiting ? ` (${waiting})` : ""}
            </Link>
          )}
          <a href="#add" className="tap inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-navy px-4 font-ui text-sm font-semibold text-paper sm:flex-none">
            <ImagePlus aria-hidden className="size-4" /> Add photos
          </a>
        </div>
      </header>

      <GallerySlideshow photos={photos} />
      <GalleryUpload userId={user.id} moderator={after.moderator} />
      <MyUploads items={mine} />
    </div>
  );
}
