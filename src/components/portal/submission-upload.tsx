"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileUp, Loader2, QrCode, UploadCloud } from "lucide-react";
import { recordSubmission } from "@/app/portal/actions";
import { getBrowserClient } from "@/lib/supabase/client";
import { viewingAs } from "@/lib/view-as-client";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import { resolveFileType, SUBMISSION_FILES, SUBMISSION_LABEL } from "@/lib/accounts";
import type { SubmissionKind } from "@/lib/types";
import { Field, inputClass } from "@/components/forms/field";
import { cn } from "@/lib/cn";

const mb = (b: number) => `${(b / 1024 / 1024).toFixed(1)} MB`;

/**
 * Uploads straight from the browser to private storage, with progress, so
 * large decks work on a phone. The server then records and checks it.
 */
export function SubmissionUpload({ kind, userId, defaultTitle, isUpdate }: { kind: SubmissionKind; userId: string; defaultTitle: string; isUpdate: boolean }) {
  const rules = SUBMISSION_FILES[kind];
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [qr, setQr] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const qrBox = useRef<HTMLInputElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const choose = (f: File | null) => {
    setDone(null);
    setError(null);
    if (!f) return setFile(null);
    if (!resolveFileType(kind, f.name, f.type)) {
      setFileError(`That file type isn't accepted. Upload a ${rules.label} file.`);
      return setFile(null);
    }
    if (f.size > rules.maxMb * 1024 * 1024) {
      setFileError(`That file is ${mb(f.size)}. The limit is ${rules.maxMb} MB. Try exporting a compressed PDF.`);
      return setFile(null);
    }
    setFileError(null);
    setFile(f);
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (viewingAs()) return setError("You're viewing as someone else, so uploads are switched off.");
    const form = new FormData(e.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    const note = String(form.get("note") ?? "").trim();
    if (title.length < 3) return setError("Enter the title.");
    if (!file) return setFileError(`Choose your ${SUBMISSION_LABEL[kind].noun} file.`);
    if (!qr) {
      setQrError(`Add your QR code to your ${SUBMISSION_LABEL[kind].noun}, then tick this box.`);
      qrBox.current?.focus();
      return;
    }
    const type = resolveFileType(kind, file.name, file.type)!;
    const db = getBrowserClient();
    const { data } = (await db?.auth.getSession()) ?? { data: { session: null } };
    const token = data.session?.access_token;
    if (!token) return setError("Your session has expired. Please sign in again.");

    const path = `${userId}/${kind}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${type.ext}`;
    setError(null);
    setProgress(0);
    const uploaded = await new Promise<boolean>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${SUPABASE_URL}/storage/v1/object/submissions/${path}`);
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.setRequestHeader("apikey", SUPABASE_ANON_KEY);
      xhr.setRequestHeader("Content-Type", type.mime);
      xhr.setRequestHeader("x-upsert", "false");
      xhr.upload.onprogress = (ev) => ev.lengthComputable && setProgress(Math.round((ev.loaded / ev.total) * 100));
      xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
      xhr.onerror = () => resolve(false);
      xhr.send(file);
    });
    if (!uploaded) {
      setProgress(null);
      return setError("The upload didn't finish. Check your connection and try again. On campus Wi-Fi, large files can take a minute.");
    }
    const res = await recordSubmission({ kind, title, note, path, name: file.name.slice(0, 200), type: type.mime, size: file.size, qrConfirmed: true });
    setProgress(null);
    if (!res?.ok) return setError(res?.error ?? "Something went wrong.");
    setDone(res.message ?? "Submitted.");
    setFile(null);
    setQr(false);
    if (input.current) input.current.value = "";
    router.refresh();
  };

  const busy = progress !== null;

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {done && (
        <p role="status" className="flex items-start gap-2 rounded-md border border-success/25 bg-success/[0.06] p-4 text-sm font-medium text-success">
          <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0" /> {done}
        </p>
      )}
      {error && <p role="alert" className="rounded-md border border-danger/25 bg-danger/[0.06] p-4 text-sm font-medium text-danger">{error}</p>}

      <Field id="sub-title" label={kind === "slides" ? "Title of your talk" : "Title of your poster"} required>
        <input id="sub-title" name="title" defaultValue={defaultTitle} maxLength={300} className={inputClass} />
      </Field>

      <div>
        <p id="file-label" className="mb-2 text-sm font-semibold text-ink">
          {isUpdate ? "New version" : SUBMISSION_LABEL[kind].title} <span className="text-danger">*</span>
        </p>
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            choose(e.dataTransfer.files?.[0] ?? null);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[3px] border-2 border-dashed px-6 py-8 text-center transition-colors has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-electric/20",
            dragging ? "border-electric-600 bg-electric/5" : fileError ? "border-danger/50" : "border-navy/20 bg-white hover:border-navy/40",
          )}
        >
          {file ? <FileUp aria-hidden className="size-7 text-electric-600" /> : <UploadCloud aria-hidden className="size-7 text-slate" />}
          <span className="font-semibold text-ink">{file ? file.name : "Tap to choose a file"}</span>
          <span className="text-sm text-slate-700">{file ? mb(file.size) : `${rules.label}, up to ${rules.maxMb} MB`}</span>
          <input
            ref={input}
            type="file"
            accept={rules.accept}
            aria-labelledby="file-label"
            aria-invalid={Boolean(fileError)}
            aria-describedby={fileError ? "file-error" : undefined}
            onChange={(e) => choose(e.target.files?.[0] ?? null)}
            className="sr-only"
          />
        </label>
        {fileError && <p id="file-error" className="mt-2 text-sm font-medium text-danger">{fileError}</p>}
      </div>

      <Field id="sub-note" label="Note for the committee" hint={isUpdate ? "For example, what you changed since the last version." : "Anything they should know."}>
        <textarea id="sub-note" name="note" rows={3} maxLength={2000} className={inputClass} />
      </Field>

      <div>
        <label
          htmlFor="sub-qr"
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-[3px] border p-4 transition-colors has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-electric/20",
            qr ? "border-success/40 bg-success/[0.05]" : qrError ? "border-danger/50 bg-danger/[0.03]" : "border-gold/60 bg-gold/[0.06]",
          )}
        >
          <input
            ref={qrBox}
            id="sub-qr"
            type="checkbox"
            checked={qr}
            onChange={(e) => {
              setQr(e.target.checked);
              if (e.target.checked) setQrError(null);
            }}
            aria-invalid={Boolean(qrError)}
            aria-describedby={qrError ? "sub-qr-hint sub-qr-error" : "sub-qr-hint"}
            className="mt-0.5 size-5 shrink-0 accent-navy"
          />
          <span className="min-w-0">
            <span className="flex items-start gap-2 font-semibold text-ink">
              <QrCode aria-hidden className="mt-1 size-4 shrink-0 text-navy" />
              <span>
                I&apos;ve added my QR code to my {kind === "slides" ? "presentation slides" : "poster"} <span className="text-danger">*</span>
              </span>
            </span>
            <span id="sub-qr-hint" className="mt-1 block text-sm text-slate-700">
              {kind === "slides"
                ? "Put it on your title or final slide so the audience can scan it during your talk."
                : "Put it somewhere easy to scan, so people can find out more when you're not at your poster."}
            </span>
          </span>
        </label>
        {qrError && <p id="sub-qr-error" className="mt-2 text-sm font-medium text-danger">{qrError}</p>}
      </div>

      {busy && (
        <div>
          <div className="h-2 overflow-hidden rounded-full bg-navy/10" role="progressbar" aria-label="Upload progress" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-navy transition-[width]" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-sm text-slate-700" aria-live="polite">Uploading… {progress}%</p>
        </div>
      )}

      <button type="submit" disabled={busy} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[3px] bg-navy px-6 font-ui font-semibold text-paper hover:bg-navy-700 disabled:opacity-60 sm:w-auto">
        {busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <UploadCloud aria-hidden className="size-4" />}
        {isUpdate ? "Submit new version" : `Submit ${SUBMISSION_LABEL[kind].noun}`}
      </button>
    </form>
  );
}
