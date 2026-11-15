"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Camera, CameraOff, Keyboard, Loader2, ScanLine, TriangleAlert } from "lucide-react";
import { lookupPresenter } from "@/app/judge/actions";
import { KIND_LABEL, type JudgingKind } from "@/lib/judging";
import { cn } from "@/lib/cn";

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type Found = { presenterId: string; name: string | null; kinds: JudgingKind[] };

/**
 * Scan a presenter's Delegate Card to jump straight to marking them. Uses the
 * browser's own QR reader where there is one (Android), and jsQR otherwise
 * (iPhone). The code can also be typed.
 */
export function JudgeScanner() {
  const router = useRouter();
  const [scanning, setScanning] = useState(true);
  const [camError, setCamError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [choose, setChoose] = useState<Found | null>(null);
  const [code, setCode] = useState("");
  const [pending, start] = useTransition();
  const video = useRef<HTMLVideoElement>(null);
  const busy = useRef(false);
  const last = useRef<{ v: string; t: number }>({ v: "", t: 0 });

  const look = useCallback(
    (raw: string) =>
      start(async () => {
        busy.current = true;
        setError(null);
        const res = await lookupPresenter(raw).catch(() => ({ ok: false as const, error: "That didn't go through. Check your connection and try again." }));
        if (res.ok) {
          try {
            navigator.vibrate?.(60);
          } catch {}
          if (res.kinds.length === 1) {
            setScanning(false);
            router.push(`/judge/${res.presenterId}/${res.kinds[0]}`);
            return;
          }
          setScanning(false);
          setChoose(res);
        } else {
          try {
            navigator.vibrate?.([80, 60, 80]);
          } catch {}
          setError(res.error);
          // Let them try again after a moment.
          setTimeout(() => (busy.current = false), 1800);
        }
      }),
    [router],
  );

  useEffect(() => {
    if (!scanning) return;
    let stream: MediaStream | null = null;
    let timer = 0;
    let stopped = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        if (stopped || !video.current) return stream?.getTracks().forEach((t) => t.stop());
        video.current.srcObject = stream;
        await video.current.play();
        const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
        let detector: Detector | null = null;
        if (BD) {
          try {
            detector = new BD({ formats: ["qr_code"] });
          } catch {}
        }
        const jsQR = detector ? null : (await import("jsqr")).default;
        const tick = async () => {
          if (stopped) return;
          const v = video.current;
          if (v && v.readyState >= 2 && !busy.current) {
            let value: string | undefined;
            try {
              if (detector) value = (await detector.detect(v))[0]?.rawValue;
              else if (jsQR && ctx) {
                const s = Math.min(v.videoWidth, v.videoHeight);
                const size = Math.min(s, 640);
                canvas.width = size;
                canvas.height = size;
                ctx.drawImage(v, (v.videoWidth - s) / 2, (v.videoHeight - s) / 2, s, s, 0, 0, size, size);
                value = jsQR(ctx.getImageData(0, 0, size, size).data, size, size, { inversionAttempts: "dontInvert" })?.data;
              }
            } catch {}
            const now = Date.now();
            if (value && (value !== last.current.v || now - last.current.t > 4000)) {
              last.current = { v: value, t: now };
              busy.current = true;
              look(value);
            }
          }
          timer = window.setTimeout(tick, detector ? 200 : 120);
        };
        tick();
      } catch (e) {
        const name = (e as { name?: string })?.name;
        setCamError(
          name === "NotAllowedError"
            ? "Camera access was blocked. Allow the camera for this site in your browser settings, or type the code below."
            : name === "NotFoundError"
              ? "No camera was found on this device. Type the code from the card below."
              : "The camera couldn't start. Type the code from the card below.",
        );
        setScanning(false);
      }
    })();
    const hide = () => document.visibilityState === "hidden" && setScanning(false);
    document.addEventListener("visibilitychange", hide);
    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
      document.removeEventListener("visibilitychange", hide);
    };
  }, [scanning, look]);

  if (choose)
    return (
      <section className="enter-pop rounded-2xl border border-navy/10 bg-white p-5">
        <p className="eyebrow text-electric-600">Found</p>
        <h1 className="mt-1 font-display text-2xl text-ink">{choose.name ?? "This presenter"}</h1>
        <p className="mt-1 text-slate-700">They&apos;re giving more than one presentation. Which are you marking?</p>
        <div className="mt-4 grid gap-2">
          {choose.kinds.map((k) => (
            <Link key={k} href={`/judge/${choose.presenterId}/${k}`} className="inline-flex min-h-14 items-center justify-center rounded-xl bg-navy text-base font-semibold text-paper">
              {KIND_LABEL[k].one}
            </Link>
          ))}
          <button type="button" onClick={() => { setChoose(null); busy.current = false; setScanning(true); }} className="min-h-12 rounded-xl border border-navy/15 text-sm font-semibold text-ink">
            Scan someone else
          </button>
        </div>
      </section>
    );

  return (
    <div className="space-y-4">
      <header>
        <p className="eyebrow text-electric-600">Scan a presenter</p>
        <h1 className="mt-1 font-display text-2xl text-ink sm:text-3xl">Point at the QR code on their Delegate Card</h1>
        <p className="mt-1 text-sm text-slate-700">It opens their marking page straight away.</p>
      </header>

      <div className="relative aspect-square w-full overflow-hidden rounded-3xl bg-midnight sm:aspect-video">
        {scanning ? (
          <>
            <video ref={video} playsInline muted className="absolute inset-0 size-full object-cover" />
            <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="relative size-[62%] max-w-72">
                {["left-0 top-0 border-l-4 border-t-4 rounded-tl-2xl", "right-0 top-0 border-r-4 border-t-4 rounded-tr-2xl", "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-2xl", "bottom-0 right-0 border-b-4 border-r-4 rounded-br-2xl"].map((c) => (
                  <span key={c} className={cn("absolute size-10 border-gold", c)} />
                ))}
                <span className="absolute inset-x-3 top-1/2 h-0.5 animate-pulse rounded-full bg-gold/80 shadow-[0_0_12px_2px_rgba(212,175,90,0.6)]" />
              </div>
            </div>
            {pending && (
              <div className="absolute inset-0 grid place-items-center bg-midnight/60">
                <Loader2 aria-hidden className="size-10 animate-spin text-gold" />
                <span className="sr-only">Looking up the card</span>
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 grid place-items-center p-6 text-center text-paper/80">
            <div>
              <CameraOff aria-hidden className="mx-auto size-10 text-paper/50" />
              <p className="mt-3 text-sm">{camError ?? "The camera is off."}</p>
              <button type="button" onClick={() => { setCamError(null); busy.current = false; setScanning(true); }} className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-xl bg-gold px-5 text-sm font-semibold text-midnight">
                <Camera aria-hidden className="size-4" /> Turn the camera on
              </button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-danger/25 bg-danger/[0.06] p-3 text-sm font-medium text-danger">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" /> {error}
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim()) look(code);
        }}
        className="rounded-2xl border border-navy/10 bg-white p-4"
      >
        <label htmlFor="judge-code" className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Keyboard aria-hidden className="size-4 text-slate" /> Or type the code under the QR
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="judge-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder="ABCD EFGH JKMN PQRS"
            className="min-h-12 min-w-0 flex-1 rounded-xl border border-navy/15 bg-paper px-3 font-mono text-base uppercase tracking-wider text-ink placeholder:text-slate/60"
          />
          <button type="submit" disabled={pending || !code.trim()} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-navy px-4 text-sm font-semibold text-paper disabled:opacity-50">
            <ScanLine aria-hidden className="size-4" /> Find
          </button>
        </div>
      </form>
    </div>
  );
}
