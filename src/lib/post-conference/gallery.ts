import "server-only";
import type { requireUser } from "@/lib/auth";

type SupabaseClient = Awaited<ReturnType<typeof requireUser>>["db"];

/** Gallery photos are private; pages show them through links that last two hours. */
const TTL = 2 * 60 * 60;

export type GalleryPhoto = {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
  caption: string | null;
  credit: string;
  mine: boolean;
};

export type MyUpload = {
  id: string;
  url: string | null;
  caption: string | null;
  status: "pending" | "accepted" | "rejected";
  note: string | null;
  createdAt: string;
};

/** Short-lived links for gallery files, keyed by path. Storage rules decide who may open each one. */
export async function signGallery(db: SupabaseClient, paths: string[]) {
  const unique = [...new Set(paths)];
  const out = new Map<string, string>();
  // Signed in batches so a large gallery doesn't make one huge request.
  for (let i = 0; i < unique.length; i += 200) {
    const { data } = await db.storage.from("gallery").createSignedUrls(unique.slice(i, i + 200), TTL);
    for (const d of data ?? []) if (d.path && d.signedUrl) out.set(d.path, d.signedUrl);
  }
  return out;
}

/** Every accepted photo the signed-in person may see, oldest first. */
export async function loadGallery(db: SupabaseClient): Promise<GalleryPhoto[]> {
  const { data, error } = await db.rpc("gallery_feed");
  if (error || !Array.isArray(data)) return [];
  const rows = data as { id: string; path: string; width: number | null; height: number | null; caption: string | null; credit: string; mine: boolean }[];
  const urls = await signGallery(db, rows.map((r) => r.path));
  return rows.flatMap((r) => {
    const url = urls.get(r.path);
    return url ? [{ id: r.id, url, width: r.width, height: r.height, caption: r.caption, credit: r.credit, mine: r.mine }] : [];
  });
}

/** The photos someone has added themselves, newest first, with where each one is up to. */
export async function loadMyUploads(db: SupabaseClient, userId: string): Promise<MyUpload[]> {
  const { data } = await db
    .from("gallery_photos")
    .select("id, path, caption, status, review_note, created_at")
    .eq("uploaded_by", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  const rows = data ?? [];
  const urls = await signGallery(db, rows.map((r) => r.path as string));
  return rows.map((r) => ({
    id: r.id as string,
    url: urls.get(r.path as string) ?? null,
    caption: (r.caption as string | null) ?? null,
    status: r.status as MyUpload["status"],
    note: (r.review_note as string | null) ?? null,
    createdAt: r.created_at as string,
  }));
}
