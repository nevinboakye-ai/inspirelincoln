"use client";
import { useState } from "react";
import { Eye, FileDown, ExternalLink } from "lucide-react";

type Kind = "image" | "pdf" | "office" | "other";

function kindOf(name: string, mime?: string | null): Kind {
  const m = (mime ?? "").toLowerCase();
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (m.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) return "image";
  if (m === "application/pdf" || ext === "pdf") return "pdf";
  if (["ppt", "pptx", "doc", "docx", "xls", "xlsx"].includes(ext) || m.includes("presentation") || m.includes("powerpoint") || m.includes("word")) return "office";
  return "other";
}

/**
 * Shows an uploaded file on the page. Images and PDFs open straight away
 * using the browser's own viewer. PowerPoint and Word files are shown with
 * Microsoft's online viewer, only after someone presses the button, because
 * that sends a short-lived private link to Microsoft.
 */
export function FilePreview({ url, downloadUrl, name, mime, title, open = true }: { url: string; downloadUrl?: string | null; name: string; mime?: string | null; title: string; open?: boolean }) {
  const kind = kindOf(name, mime);
  const [shown, setShown] = useState(open && kind !== "office");
  const office = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {kind !== "other" && (
          <button
            type="button"
            onClick={() => setShown((v) => !v)}
            aria-expanded={shown}
            className="inline-flex min-h-11 items-center gap-2 rounded-[3px] bg-navy px-5 text-sm font-semibold text-paper hover:bg-navy-700"
          >
            <Eye aria-hidden className="size-4" /> {shown ? "Hide preview" : "Preview"}
          </button>
        )}
        {downloadUrl && (
          <a href={downloadUrl} className="inline-flex min-h-11 items-center gap-2 rounded-[3px] border border-navy/15 px-5 text-sm font-semibold text-ink hover:border-navy/40">
            <FileDown aria-hidden className="size-4" /> Download
          </a>
        )}
        {(kind === "pdf" || kind === "image") && (
          <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-[3px] border border-navy/15 px-5 text-sm font-semibold text-ink hover:border-navy/40">
            <ExternalLink aria-hidden className="size-4" /> Full screen<span className="sr-only"> (opens in a new tab)</span>
          </a>
        )}
      </div>
      {shown && kind === "image" && <img src={url} alt={title} className="mt-4 w-full rounded-md border border-navy/10 bg-white" />}
      {shown && kind === "pdf" && (
        <iframe src={`${url}#view=FitH`} title={title} className="mt-4 h-[75svh] w-full rounded-md border border-navy/10 bg-white" />
      )}
      {shown && kind === "office" && (
        <>
          <iframe src={office} title={title} className="mt-4 aspect-[4/3] max-h-[75svh] w-full rounded-md border border-navy/10 bg-white" />
          <p className="mt-2 text-xs text-slate">Shown with Microsoft&apos;s online viewer. If it doesn&apos;t load, download the file instead.</p>
        </>
      )}
      {kind === "other" && <p className="mt-3 text-sm text-slate">This file type can&apos;t be previewed in the browser. Download it to view.</p>}
    </div>
  );
}
