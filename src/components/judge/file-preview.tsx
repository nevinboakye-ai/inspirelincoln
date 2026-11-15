"use client";
import { useEffect, useRef, useState } from "react";
import { Download, FileWarning, Loader2, Maximize2, Minus, Plus, X } from "lucide-react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { lockScroll } from "@/lib/scroll-lock";
import type { PreviewKind } from "@/lib/judging";

/*
 * Shows a presenter's slides or poster inside the judging page, so judges
 * never have to download anything. PDFs are drawn page by page in the browser
 * (phones can't show a PDF inside a page on their own), images are shown as
 * they are, and PowerPoint goes through Microsoft's viewer. All of them open
 * full screen and PDFs and images zoom.
 */

type Lib = typeof import("pdfjs-dist");
let lib: Promise<Lib> | null = null;
/** PDF.js loads only when a PDF is opened. The older-browser build keeps it working on older phones. */
function loadPdfjs() {
  return (lib ??= import("pdfjs-dist/legacy/build/pdf.mjs").then((m) => {
    m.GlobalWorkerOptions.workerPort = new Worker(new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url), { type: "module" });
    return m as Lib;
  }));
}

const MAX_PAGES = 120;
/** Phones refuse canvases much bigger than this, so huge posters are drawn a little softer instead. */
const MAX_PIXELS = 12_000_000;
const ZOOMS = [1, 1.5, 2, 3, 4];

/** The width of an element's content area, kept up to date as it resizes. */
function useWidth(el: HTMLElement | null) {
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.floor(el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return w;
}

function PdfPage({ doc, n, size, width, root }: { doc: PDFDocumentProxy; n: number; size: { w: number; h: number }; width: number; root: HTMLElement | null }) {
  const holder = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [drawn, setDrawn] = useState(false);

  // Only draw pages close to being seen, so a long deck opens quickly.
  useEffect(() => {
    const el = holder.current;
    if (!el || near) return;
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && setNear(true), { root, rootMargin: "800px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [near, root]);

  useEffect(() => {
    if (!near || width < 10) return;
    let task: RenderTask | null = null;
    let gone = false;
    doc
      .getPage(n)
      .then((page) => {
        if (gone) return;
        const base = page.getViewport({ scale: 1 });
        let scale = (width / base.width) * Math.min(window.devicePixelRatio || 1, 2);
        const px = base.width * base.height * scale * scale;
        if (px > MAX_PIXELS) scale *= Math.sqrt(MAX_PIXELS / px);
        const viewport = page.getViewport({ scale });
        // A fresh canvas each time, swapped in when it's ready, so zooming never flashes blank.
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.className = "block h-full w-full";
        canvas.setAttribute("aria-hidden", "true");
        task = page.render({ canvas, viewport });
        return task.promise.then(() => {
          if (gone) return;
          holder.current?.replaceChildren(canvas);
          setDrawn(true);
        });
      })
      .catch(() => {});
    return () => {
      gone = true;
      task?.cancel();
    };
  }, [doc, n, near, width]);

  return (
    <div
      ref={holder}
      role="img"
      aria-label={`Page ${n}`}
      className={`mx-auto shrink-0 bg-white shadow-sm ring-1 ring-navy/10 ${drawn ? "" : "animate-pulse"}`}
      style={{ width, aspectRatio: `${size.w} / ${size.h}` }}
    />
  );
}

function PdfView({ url, zoom, fit, scroller, onPages, onFail }: { url: string; zoom: number; fit: number; scroller: HTMLDivElement | null; onPages: (n: number) => void; onFail: (v: boolean) => void }) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [sizes, setSizes] = useState<{ w: number; h: number }[]>([]);

  useEffect(() => {
    let gone = false;
    let task: PDFDocumentLoadingTask | null = null;
    loadPdfjs()
      .then((pdfjs) => {
        if (gone) throw new Error("gone");
        task = pdfjs.getDocument({ url });
        return task.promise;
      })
      .then(async (d) => {
        const count = Math.min(d.numPages, MAX_PAGES);
        const out: { w: number; h: number }[] = [];
        for (let i = 1; i <= count; i++) {
          const v = (await d.getPage(i)).getViewport({ scale: 1 });
          out.push({ w: v.width, h: v.height });
        }
        if (gone) return;
        setSizes(out);
        setDoc(d);
        onPages(d.numPages);
      })
      .catch(() => !gone && onFail(true));
    return () => {
      gone = true;
      void (task as PDFDocumentLoadingTask | null)?.destroy();
    };
  }, [url, onPages, onFail]);

  if (!doc || !sizes.length || !fit) return <Loading />;
  const width = Math.floor((fit - 24) * zoom);
  return (
    <div className="flex w-max min-w-full flex-col gap-3 p-3">
      {sizes.map((s, i) => (
        <PdfPage key={i} doc={doc} n={i + 1} size={s} width={width} root={scroller} />
      ))}
    </div>
  );
}

function Loading() {
  return (
    <div className="grid h-full min-h-60 place-items-center text-sm text-slate-700">
      <span className="inline-flex items-center gap-2">
        <Loader2 aria-hidden className="size-4 animate-spin" /> Loading the preview…
      </span>
    </div>
  );
}

export function FilePreview({
  kind,
  url,
  downloadUrl,
  name,
  noun,
  who,
}: {
  kind: PreviewKind;
  /** A signed link that shows the file rather than downloading it. */
  url: string;
  downloadUrl: string;
  name: string;
  noun: string;
  who: string;
}) {
  const [full, setFull] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pages, setPages] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  const fit = useWidth(scroller);
  const close = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!full) return;
    const release = lockScroll();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFull(false);
    document.addEventListener("keydown", onKey);
    close.current?.focus();
    return () => {
      release();
      document.removeEventListener("keydown", onKey);
    };
  }, [full]);

  const download = (
    <a
      href={downloadUrl}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-slate-700 underline-offset-2 hover:text-ink hover:underline"
    >
      <Download aria-hidden className="size-4" /> Download
      <span className="sr-only"> {name}</span>
    </a>
  );

  if (!kind || failed) {
    return (
      <div className="space-y-2">
        <p className="flex items-start gap-2 rounded-xl bg-paper px-3 py-2.5 text-sm text-slate-700">
          <FileWarning aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
          {failed
            ? `The ${noun} couldn't be shown here. Download it to look at it.`
            : `${noun === "slides" ? "These slides are" : `This ${noun} is`} a Keynote file, which browsers can't show. Download it, or ask ${who} for a PDF.`}
        </p>
        <a
          href={downloadUrl}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-navy/15 bg-paper px-4 text-sm font-semibold text-ink transition-colors hover:border-navy/40"
        >
          <Download aria-hidden className="size-4" /> Download the {noun}
          <span className="truncate font-normal text-slate">({name})</span>
        </a>
      </div>
    );
  }

  const zoomable = kind === "pdf" || kind === "image";
  const zi = ZOOMS.indexOf(zoom);
  const btn = "grid size-11 place-items-center rounded-lg transition-colors disabled:opacity-35";
  const tone = full ? "text-paper hover:bg-white/10" : "text-ink hover:bg-paper-200";

  return (
    <div
      className={
        full
          ? "fixed inset-0 z-[90] flex flex-col bg-midnight pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]"
          : "overflow-hidden rounded-xl border border-navy/10 bg-paper"
      }
      role={full ? "dialog" : undefined}
      aria-modal={full || undefined}
      aria-label={full ? `${who}'s ${noun}` : undefined}
    >
      <div className={`flex items-center gap-1 px-1.5 py-1 ${full ? "text-paper" : "border-b border-navy/10 bg-white"}`}>
        <p className={`min-w-0 flex-1 truncate px-1.5 text-sm ${full ? "text-paper/80" : "text-slate-700"}`}>
          <span className="font-medium">{name}</span>
          {pages ? ` · ${pages} page${pages === 1 ? "" : "s"}` : ""}
        </p>
        {zoomable && (
          <>
            <button type="button" className={`${btn} ${tone}`} disabled={zi <= 0} onClick={() => setZoom(ZOOMS[zi - 1]!)} aria-label="Zoom out">
              <Minus aria-hidden className="size-4" />
            </button>
            <span className={`w-11 text-center text-xs tabular-nums ${full ? "text-paper/80" : "text-slate-700"}`}>{Math.round(zoom * 100)}%</span>
            <button type="button" className={`${btn} ${tone}`} disabled={zi >= ZOOMS.length - 1} onClick={() => setZoom(ZOOMS[zi + 1]!)} aria-label="Zoom in">
              <Plus aria-hidden className="size-4" />
            </button>
          </>
        )}
        {full ? (
          <button type="button" className={`${btn} ${tone}`} onClick={() => setFull(false)} aria-label="Close full screen" ref={close}>
            <X aria-hidden className="size-5" />
          </button>
        ) : (
          <button type="button" className={`${btn} ${tone}`} onClick={() => setFull(true)} aria-label="Full screen">
            <Maximize2 aria-hidden className="size-4" />
          </button>
        )}
      </div>

      <div
        ref={setScroller}
        className={`relative overflow-auto overscroll-contain ${full ? "min-h-0 flex-1" : kind === "office" ? "h-[min(70dvh,34rem)]" : "max-h-[75dvh] min-h-60"}`}
      >
        {kind === "pdf" && <PdfView url={url} zoom={zoom} fit={fit} scroller={scroller} onPages={setPages} onFail={setFailed} />}
        {kind === "image" && (
          <div className={`flex min-h-full p-3 ${zoom === 1 ? "items-center justify-center" : "w-max"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`${who}'s ${noun}`}
              onError={() => setFailed(true)}
              onClick={() => !full && setFull(true)}
              className={`block ${zoom === 1 ? `max-w-full object-contain ${full ? "max-h-full" : "max-h-[calc(75dvh-1.5rem)] cursor-zoom-in"}` : "max-w-none"}`}
              style={zoom === 1 ? undefined : { width: `${Math.floor((fit - 24) * zoom)}px` }}
            />
          </div>
        )}
        {kind === "office" && (
          <iframe
            title={`${who}'s ${noun}`}
            src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`}
            className="absolute inset-0 size-full border-0 bg-white"
            allowFullScreen
          />
        )}
      </div>

      <div className={`flex flex-wrap items-center justify-between gap-x-3 px-2 ${full ? "text-paper/70 [&_a]:text-paper/80" : "border-t border-navy/10 bg-white"}`}>
        <p className={`px-1 py-2 text-xs ${full ? "" : "text-slate"}`}>
          {kind === "office" ? "Shown with Microsoft's viewer. If the slides don't appear, download them." : "Use + and − to zoom, or open it full screen."}
        </p>
        {download}
      </div>
    </div>
  );
}
