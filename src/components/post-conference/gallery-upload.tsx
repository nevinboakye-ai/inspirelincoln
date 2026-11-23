"use client";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { CheckCircle2, ImagePlus, Loader2, ShieldCheck, Trash2, TriangleAlert, Upload } from "lucide-react";
import { recordGalleryPhoto } from "@/app/portal/gallery/actions";
import { getBrowserClient } from "@/lib/supabase/client";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import { GALLERY_BATCH, GALLERY_MAX_BYTES, GALLERY_MAX_PICK, fitWithin } from "@/lib/post-conference/photos";
import { viewingAs } from "@/lib/view-as-client";
import { cn } from "@/lib/cn";

type Item = {
  key: string;
  file: File;
  preview: string;
  caption: string;
  state: "ready" | "preparing" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
};

/**
 * Re-saves a photo in the browser: no bigger than the gallery needs, the
 * right way up, as WebP (or JPEG), which also strips hidden details such
 * as where it was taken.
 */
async function prepare(file: File): Promise<{ blob: Blob; width: number; height: number; ext: "webp" | "jpg" } | null> {
  let source: ImageBitmap | HTMLImageElement;
  try {
    source = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
    } catch {
      URL.revokeObjectURL(url);
      return null;
    }
    URL.revokeObjectURL(url);
    source = img;
  }
  const w = "naturalWidth" in source ? source.naturalWidth : source.width;
  const h = "naturalHeight" in source ? source.naturalHeight : source.height;
  const size = fitWithin(w, h);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, size.width, size.height);
  if ("close" in source) source.close();
  const as = (type: string, q: number) => new Promise<Blob | null>((r) => canvas.toBlob(r, type, q));
  for (const q of [0.86, 0.75, 0.6]) {
    const webp = await as("image/webp", q);
    const blob = webp?.type === "image/webp" ? webp : await as("image/jpeg", q + 0.02);
    if (blob && blob.size <= GALLERY_MAX_BYTES) return { blob, ...size, ext: blob.type === "image/webp" ? "webp" : "jpg" };
  }
  return null;
}

/** Sends one file straight to the person's private gallery folder, with progress. */
function put(path: string, blob: Blob, token: string, onProgress: (p: number) => void) {
  return new Promise<boolean>((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${SUPABASE_URL}/storage/v1/object/gallery/${path}`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", SUPABASE_ANON_KEY);
    xhr.setRequestHeader("Content-Type", blob.type);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("cache-control", "max-age=31536000");
    xhr.upload.onprogress = (ev) => ev.lengthComputable && onProgress(Math.round((ev.loaded / ev.total) * 100));
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
    xhr.onerror = () => resolve(false);
    xhr.send(blob);
  });
}

/**
 * Add photos to the gallery: pick several at once (or drop them here), add a
 * caption if you like, confirm they're fine to share, and send. Photos wait
 * for the committee unless you moderate the gallery yourself.
 */
export function GalleryUpload({ userId, moderator }: { userId: string; moderator: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [consent, setConsent] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const consentBox = useRef<HTMLInputElement>(null);
  const id = useId();

  // Free the previews when they're no longer shown.
  const previews = useRef(new Set<string>());
  useEffect(() => {
    const set = previews.current;
    return () => set.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const patch = (key: string, p: Partial<Item>) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...p } : i)));

  const add = (files: FileList | File[] | null) => {
    setMessage(null);
    if (!files) return;
    const chosen = [...files];
    const images = chosen.filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
    const room = GALLERY_BATCH - items.filter((i) => i.state !== "done").length;
    const tooBig = images.filter((f) => f.size > GALLERY_MAX_PICK).length;
    const usable = images.filter((f) => f.size <= GALLERY_MAX_PICK).slice(0, Math.max(0, room));
    const next = usable.map((file) => {
      const preview = URL.createObjectURL(file);
      previews.current.add(preview);
      return { key: crypto.randomUUID(), file, preview, caption: "", state: "ready" as const, progress: 0 };
    });
    setItems((list) => [...list.filter((i) => i.state !== "done"), ...next]);
    const notes = [
      chosen.length > images.length && "Only photos can be added.",
      tooBig && `${tooBig} photo${tooBig === 1 ? " is" : "s are"} over 40 MB.`,
      images.length - tooBig > usable.length && `You can add ${GALLERY_BATCH} photos at a time.`,
    ].filter(Boolean);
    if (notes.length) setMessage({ ok: false, text: notes.join(" ") });
    if (input.current) input.current.value = "";
  };

  const remove = (key: string) =>
    setItems((list) => {
      const gone = list.find((i) => i.key === key);
      if (gone) {
        URL.revokeObjectURL(gone.preview);
        previews.current.delete(gone.preview);
      }
      return list.filter((i) => i.key !== key);
    });

  const send = async () => {
    setMessage(null);
    if (viewingAs()) return setMessage({ ok: false, text: "You're viewing as someone else, so uploads are switched off." });
    const todo = items.filter((i) => i.state === "ready" || i.state === "error");
    if (!todo.length) return setMessage({ ok: false, text: "Choose some photos first." });
    if (!consent) {
      setConsentError(true);
      consentBox.current?.focus();
      return;
    }
    const db = getBrowserClient();
    const { data } = (await db?.auth.getSession()) ?? { data: { session: null } };
    const token = data.session?.access_token;
    if (!token) return setMessage({ ok: false, text: "Your session has expired. Please sign in again." });

    setBusy(true);
    let sent = 0;
    let accepted = false;
    // Two at a time: quick on good Wi-Fi without choking a phone signal.
    const queue = [...todo];
    const worker = async () => {
      for (let item = queue.shift(); item; item = queue.shift()) {
        patch(item.key, { state: "preparing", error: undefined, progress: 0 });
        const ready = await prepare(item.file);
        if (!ready) {
          patch(item.key, { state: "error", error: "We couldn't open this photo. Try a JPEG or PNG." });
          continue;
        }
        patch(item.key, { state: "uploading" });
        const path = `${userId}/${crypto.randomUUID()}.${ready.ext}`;
        const ok = await put(path, ready.blob, token, (p) => patch(item!.key, { progress: p }));
        if (!ok) {
          patch(item.key, { state: "error", error: "The upload didn't finish. Check your connection and try again." });
          continue;
        }
        const r = await recordGalleryPhoto({ path, width: ready.width, height: ready.height, caption: item.caption });
        if (!r.ok) {
          patch(item.key, { state: "error", error: r.error });
          continue;
        }
        accepted ||= r.status === "accepted";
        sent += 1;
        patch(item.key, { state: "done", progress: 100 });
      }
    };
    await Promise.all([worker(), worker()]);
    setBusy(false);
    if (sent) {
      setConsent(false);
      setMessage({
        ok: true,
        text: accepted
          ? `${sent} photo${sent === 1 ? " is" : "s are"} in the gallery now.`
          : `Thank you. ${sent} photo${sent === 1 ? " has" : "s have"} gone to the committee. You'll see ${sent === 1 ? "it" : "them"} in the slideshow once ${sent === 1 ? "it's" : "they're"} accepted.`,
      });
      router.refresh();
    }
  };

  const waiting = items.filter((i) => i.state !== "done");

  return (
    <section id="add" aria-labelledby={`${id}-h`} className="app-card scroll-mt-28 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 id={`${id}-h`} className="flex items-center gap-2 font-display text-xl text-ink">
            <span className="icon-chip-sm tone-coral">
              <ImagePlus aria-hidden className="size-4" />
            </span>
            Add your photos
          </h2>
          <p className="mt-1 text-sm text-slate-700">
            {moderator
              ? "You moderate the gallery, so your photos go straight in."
              : "The committee checks each photo before it goes in the slideshow."}
          </p>
        </div>
        {moderator && (
          <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
            <ShieldCheck aria-hidden className="size-3.5" /> Goes straight in
          </span>
        )}
      </div>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          add(e.dataTransfer.files);
        }}
        className={cn(
          "mt-4 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed px-5 py-7 text-center transition-colors has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-electric/20",
          dragging ? "border-electric-600 bg-electric/5" : "border-navy/20 bg-paper/60 hover:border-navy/40",
        )}
      >
        <Upload aria-hidden className="size-7 text-electric-600" />
        <span className="font-semibold text-ink">Tap to choose photos</span>
        <span className="text-sm text-slate-700">Up to {GALLERY_BATCH} at a time, from your camera roll or computer</span>
        <input ref={input} type="file" accept="image/*" multiple onChange={(e) => add(e.target.files)} className="sr-only" disabled={busy} />
      </label>

      {items.length > 0 && (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {items.map((i) => (
            <li key={i.key} className={cn("flex gap-3 rounded-xl border p-2.5", i.state === "error" ? "border-danger/30 bg-danger/[0.03]" : i.state === "done" ? "border-success/25 bg-success/[0.04]" : "border-navy/10 bg-white")}>
              <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-paper-200">
                <img src={i.preview} alt="" className="size-full object-cover" />
                {(i.state === "uploading" || i.state === "preparing") && (
                  <div className="absolute inset-0 grid place-items-center bg-midnight/50 text-paper">
                    <span className="font-ui text-xs font-semibold">{i.state === "preparing" ? <Loader2 aria-hidden className="size-5 animate-spin" /> : `${i.progress}%`}</span>
                  </div>
                )}
                {i.state === "done" && (
                  <div className="absolute inset-0 grid place-items-center bg-success/60 text-white">
                    <CheckCircle2 aria-hidden className="size-7" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                {i.state === "done" ? (
                  <p className="pt-1 text-sm font-semibold text-success">{moderator ? "Added" : "Sent for review"}</p>
                ) : (
                  <>
                    <label htmlFor={`${id}-${i.key}`} className="sr-only">
                      Caption for this photo
                    </label>
                    <input
                      id={`${id}-${i.key}`}
                      value={i.caption}
                      onChange={(e) => patch(i.key, { caption: e.target.value })}
                      maxLength={200}
                      disabled={busy}
                      placeholder="Add a caption (optional)"
                      className="w-full rounded-lg border border-navy/15 px-3 py-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-electric-600"
                    />
                    {i.error ? (
                      <p className="mt-1.5 flex items-start gap-1 text-xs font-medium text-danger">
                        <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" /> {i.error}
                      </p>
                    ) : (
                      <p className="mt-1.5 truncate text-xs text-slate">{i.file.name}</p>
                    )}
                  </>
                )}
              </div>
              {i.state !== "done" && !busy && (
                <button type="button" onClick={() => remove(i.key)} className="tap grid size-10 shrink-0 place-items-center self-start rounded-full text-slate hover:bg-paper-200 hover:text-danger" aria-label={`Remove ${i.file.name}`}>
                  <Trash2 aria-hidden className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {waiting.length > 0 && (
        <div className="mt-4 space-y-3">
          <label className={cn("flex cursor-pointer items-start gap-3 rounded-xl p-3 text-sm text-slate-700", consentError ? "bg-danger/[0.06] ring-2 ring-danger/40" : "bg-paper-200/70")}>
            <input
              ref={consentBox}
              type="checkbox"
              checked={consent}
              onChange={(e) => {
                setConsent(e.target.checked);
                setConsentError(false);
              }}
              aria-describedby={consentError ? `${id}-consent-err` : undefined}
              className="mt-0.5 size-5 shrink-0 accent-[var(--color-navy)]"
            />
            <span>
              <span className="font-semibold text-ink">I took these photos or have permission to share them</span>, and the people in them are happy to be seen by INSPIRE delegates.
            </span>
          </label>
          {consentError && (
            <p id={`${id}-consent-err`} role="alert" className="text-sm font-medium text-danger">
              Tick the box to confirm the photos are fine to share.
            </p>
          )}
          <button type="button" onClick={send} disabled={busy} className="tap inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-navy px-6 font-ui text-sm font-semibold text-paper disabled:opacity-60 sm:w-auto">
            {busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Upload aria-hidden className="size-4" />}
            {busy ? "Sending…" : `Send ${waiting.length} photo${waiting.length === 1 ? "" : "s"}`}
          </button>
        </div>
      )}

      {message && (
        <p role={message.ok ? "status" : "alert"} className={cn("mt-3 flex items-start gap-2 rounded-xl p-3 text-sm font-medium", message.ok ? "border border-success/25 bg-success/[0.06] text-success" : "border border-danger/25 bg-danger/[0.06] text-danger")}>
          {message.ok ? <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0" /> : <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />}
          {message.text}
        </p>
      )}
    </section>
  );
}
