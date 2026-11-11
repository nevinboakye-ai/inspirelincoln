"use client";
import { Camera, Loader2, Minus, Plus, Trash2 } from "lucide-react";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { removeAvatar, saveAvatar } from "@/app/portal/actions";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";
import { viewingAs } from "@/lib/view-as-client";

const VIEW = 256; // crop area, CSS pixels
const OUT = 512; // saved photo, pixels
const MAX_ZOOM = 4;
const MAX_FILE = 25 * 1024 * 1024;

type Crop = { img: HTMLImageElement; url: string; zoom: number; x: number; y: number };

/** Keeps the photo covering the whole crop square. */
function clamp(c: Crop): Crop {
  const s = (VIEW / Math.min(c.img.naturalWidth, c.img.naturalHeight)) * c.zoom;
  const w = c.img.naturalWidth * s;
  const h = c.img.naturalHeight * s;
  return { ...c, x: Math.min(0, Math.max(VIEW - w, c.x)), y: Math.min(0, Math.max(VIEW - h, c.y)) };
}
const scaleOf = (c: Crop) => (VIEW / Math.min(c.img.naturalWidth, c.img.naturalHeight)) * c.zoom;

/** The cropped square as an image file: WebP, or JPEG where the browser can't make WebP. */
async function exportCrop(c: Crop): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = OUT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const s = scaleOf(c);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(c.img, -c.x / s, -c.y / s, VIEW / s, VIEW / s, 0, 0, OUT, OUT);
  const as = (type: string, q: number) => new Promise<Blob | null>((r) => canvas.toBlob(r, type, q));
  const webp = await as("image/webp", 0.86);
  return webp?.type === "image/webp" ? webp : as("image/jpeg", 0.88);
}

/**
 * Add, change or remove a profile photo. The photo is cropped to a square
 * here in the browser (drag, or use the arrow keys, and zoom) and re-saved,
 * which also strips hidden details such as where it was taken.
 */
export function AvatarEditor({ url, name }: { url: string | null; name: string | null }) {
  const [crop, setCrop] = useState<Crop | null>(null);
  const [preview, setPreview] = useState(url);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const file = useRef<HTMLInputElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; ox: number; oy: number } | null>(null);
  const hint = useId();
  const zoomId = useId();

  // Draw the crop preview whenever it changes.
  useEffect(() => {
    const el = canvas.current;
    if (!crop || !el) return;
    const dpr = window.devicePixelRatio || 1;
    el.width = el.height = VIEW * dpr;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    const s = scaleOf(crop);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, VIEW, VIEW);
    ctx.drawImage(crop.img, crop.x, crop.y, crop.img.naturalWidth * s, crop.img.naturalHeight * s);
  }, [crop]);

  const cropUrl = crop?.url;
  useEffect(() => {
    if (!cropUrl) return;
    return () => URL.revokeObjectURL(cropUrl);
  }, [cropUrl]);

  const choose = async (f: File | undefined) => {
    setMsg(null);
    if (!f) return;
    if (viewingAs()) return setMsg({ ok: false, text: "You're viewing as someone else, so photo changes are switched off." });
    if (!f.type.startsWith("image/")) return setMsg({ ok: false, text: "Please choose a photo (JPEG, PNG or HEIC from your phone)." });
    if (f.size > MAX_FILE) return setMsg({ ok: false, text: "That photo is over 25 MB. Please choose a smaller one." });
    const objectUrl = URL.createObjectURL(f);
    const img = new Image();
    img.src = objectUrl;
    try {
      await img.decode();
    } catch {
      URL.revokeObjectURL(objectUrl);
      return setMsg({ ok: false, text: "We couldn't open that photo. Please try a JPEG or PNG." });
    }
    const s = VIEW / Math.min(img.naturalWidth, img.naturalHeight);
    setCrop(clamp({ img, url: objectUrl, zoom: 1, x: (VIEW - img.naturalWidth * s) / 2, y: (VIEW - img.naturalHeight * s) / 2 }));
  };

  const zoomTo = (z: number) =>
    setCrop((c) => {
      if (!c) return c;
      const zoom = Math.min(MAX_ZOOM, Math.max(1, z));
      // Zoom around the middle of the square.
      const k = zoom / c.zoom;
      return clamp({ ...c, zoom, x: VIEW / 2 - (VIEW / 2 - c.x) * k, y: VIEW / 2 - (VIEW / 2 - c.y) * k });
    });
  const nudge = (dx: number, dy: number) => setCrop((c) => (c ? clamp({ ...c, x: c.x + dx, y: c.y + dy }) : c));

  const save = () =>
    start(async () => {
      if (!crop) return;
      const blob = await exportCrop(crop);
      if (!blob) return setMsg({ ok: false, text: "Your browser couldn't prepare the photo. Please try another browser." });
      const fd = new FormData();
      fd.append("photo", new File([blob], blob.type === "image/webp" ? "photo.webp" : "photo.jpg", { type: blob.type }));
      const r = await saveAvatar(null, fd);
      if (r?.ok) {
        setPreview(URL.createObjectURL(blob));
        setCrop(null);
      }
      setMsg({ ok: Boolean(r?.ok), text: r?.ok ? "Photo saved. It's on your Delegate Card now." : (r?.error ?? "Something went wrong. Please try again.") });
    });

  const remove = () =>
    start(async () => {
      if (viewingAs()) return setMsg({ ok: false, text: "You're viewing as someone else, so photo changes are switched off." });
      const r = await removeAvatar(null);
      if (r?.ok) setPreview(null);
      setMsg({ ok: Boolean(r?.ok), text: r?.ok ? "Photo removed." : (r?.error ?? "Something went wrong. Please try again.") });
    });

  const btn = "inline-flex min-h-11 items-center justify-center gap-2 rounded-[3px] px-4 text-sm font-semibold transition-colors disabled:opacity-60";

  return (
    <div>
      <input ref={file} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => (choose(e.target.files?.[0]), (e.target.value = ""))} />

      {!crop ? (
        <div className="flex flex-wrap items-center gap-5">
          <Avatar url={preview} name={name} className="size-24 ring-4 ring-paper" fallbackClassName="bg-navy text-2xl text-cyan" />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => file.current?.click()} disabled={pending} className={cn(btn, "bg-navy text-paper hover:bg-navy-700")}>
              <Camera aria-hidden className="size-4" /> {preview ? "Change photo" : "Add a photo"}
            </button>
            {preview && (
              <button type="button" onClick={remove} disabled={pending} className={cn(btn, "border border-navy/15 bg-white text-ink hover:border-danger/50 hover:text-danger")}>
                {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Trash2 aria-hidden className="size-4" />} Remove
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p id={hint} className="text-sm text-slate-700">
            Drag the photo, or use the arrow keys, to fit your face in the circle. Use the slider or the plus and minus keys to zoom.
          </p>
          <div
            role="group"
            aria-label="Photo position"
            aria-describedby={hint}
            tabIndex={0}
            onKeyDown={(e) => {
              const step = e.shiftKey ? 24 : 8;
              const map: Record<string, () => void> = {
                ArrowLeft: () => nudge(step, 0),
                ArrowRight: () => nudge(-step, 0),
                ArrowUp: () => nudge(0, step),
                ArrowDown: () => nudge(0, -step),
                "+": () => zoomTo(crop.zoom + 0.1),
                "=": () => zoomTo(crop.zoom + 0.1),
                "-": () => zoomTo(crop.zoom - 0.1),
              };
              if (map[e.key]) {
                e.preventDefault();
                map[e.key]();
              }
            }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, ox: crop.x, oy: crop.y };
            }}
            onPointerMove={(e) => {
              const d = drag.current;
              if (!d || d.id !== e.pointerId) return;
              setCrop((c) => (c ? clamp({ ...c, x: d.ox + e.clientX - d.x, y: d.oy + e.clientY - d.y }) : c));
            }}
            onPointerUp={() => (drag.current = null)}
            onPointerCancel={() => (drag.current = null)}
            onWheel={(e) => zoomTo(crop.zoom - e.deltaY / 500)}
            className="relative size-64 cursor-grab touch-none select-none overflow-hidden rounded-xl bg-midnight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric-600 active:cursor-grabbing"
          >
            <canvas ref={canvas} className="size-64" />
            {/* The circle shows how it will look; the corners outside it are dimmed. */}
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_closest-side,transparent_99.4%,rgba(12,24,44,0.6)_100%)]" />
            <div aria-hidden className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-white/80" />
          </div>
          <div className="flex max-w-64 items-center gap-3">
            <button type="button" onClick={() => zoomTo(crop.zoom - 0.25)} className="grid size-10 shrink-0 place-items-center rounded-full border border-navy/15 text-ink hover:border-navy/40" aria-label="Zoom out">
              <Minus aria-hidden className="size-4" />
            </button>
            <label htmlFor={zoomId} className="sr-only">Zoom</label>
            <input id={zoomId} type="range" min={1} max={MAX_ZOOM} step={0.01} value={crop.zoom} onChange={(e) => zoomTo(Number(e.target.value))} className="min-w-0 flex-1 accent-navy" />
            <button type="button" onClick={() => zoomTo(crop.zoom + 0.25)} className="grid size-10 shrink-0 place-items-center rounded-full border border-navy/15 text-ink hover:border-navy/40" aria-label="Zoom in">
              <Plus aria-hidden className="size-4" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={save} disabled={pending} className={cn(btn, "bg-navy text-paper hover:bg-navy-700")}>
              {pending && <Loader2 aria-hidden className="size-4 animate-spin" />} Save photo
            </button>
            <button type="button" onClick={() => file.current?.click()} disabled={pending} className={cn(btn, "border border-navy/15 bg-white text-ink hover:border-navy/40")}>
              Choose another
            </button>
            <button type="button" onClick={() => setCrop(null)} disabled={pending} className={cn(btn, "text-slate-700 hover:text-ink")}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <p role={msg && !msg.ok ? "alert" : "status"} className={cn("mt-3 text-sm", msg?.ok ? "text-success" : "text-danger")}>
        {msg?.text}
      </p>
    </div>
  );
}
