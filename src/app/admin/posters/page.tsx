import type { Metadata } from "next";
import { FilePreview } from "@/components/admin/file-preview";
import { requireRole } from "@/lib/auth";
import { AdminHeader } from "@/components/admin/ui";
import { PosterReviewForm } from "@/components/admin/people-forms";

export const metadata: Metadata = { title: "Posters" };
export const dynamic = "force-dynamic";

export default async function PostersPage() {
  const { db } = await requireRole(["admin"], "/admin/posters");
  const { data } = await db.from("poster_uploads").select("id, file_path, orientation, status, admin_note, created_at, abstracts(reference, title, presenting_author)").order("created_at", { ascending: false });
  const rows = await Promise.all(
    (data ?? []).map(async (p) => ({ ...p, url: (await db.storage.from("posters").createSignedUrl(p.file_path, 1800)).data?.signedUrl ?? null,
      download: (await db.storage.from("posters").createSignedUrl(p.file_path, 1800, { download: true })).data?.signedUrl ?? null, abs: p.abstracts as unknown as { reference: string; title: string; presenting_author: string } | null })),
  );
  return (
    <div className="space-y-6">
      <AdminHeader title="Posters" description="Uploaded poster files for accepted abstracts. Preview any poster here, or download it. Links last 30 minutes; refresh for new ones." />
      {!rows.length && <p className="text-sm text-slate-700">No posters uploaded yet.</p>}
      <ul className="space-y-4">
        {rows.map((p) => (
          <li key={p.id} className="rounded-xl border border-navy/10 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-ink">{p.abs?.title}</p>
                <p className="text-sm text-slate-700">{p.abs?.reference} · {p.abs?.presenting_author} · {p.orientation ?? "orientation not given"}</p>
                <p className="text-xs text-slate">Uploaded {new Date(p.created_at).toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "medium", timeStyle: "short" })}</p>
              </div>
            </div>
            {p.url && (
              <div className="mt-4">
                <FilePreview url={p.url} downloadUrl={p.download} name={p.file_path} title={`Poster: ${p.abs?.title ?? "untitled"}`} open={false} />
              </div>
            )}
            <div className="mt-4"><PosterReviewForm id={p.id} status={p.status} note={p.admin_note ?? ""} /></div>
          </li>
        ))}
      </ul>
    </div>
  );
}
