"use client";
import { useEffect, useRef, type RefObject } from "react";

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };

/** Why the camera couldn't start, in words for the person holding the phone. */
export function cameraErrorText(e: unknown) {
  const name = (e as { name?: string })?.name;
  return name === "NotAllowedError"
    ? "Camera access was blocked. Allow the camera for this site in your browser settings, or type the code below."
    : name === "NotFoundError"
      ? "No camera was found on this device. Type the code or search by name below."
      : "The camera couldn't start. Type the code or search by name below.";
}

/**
 * Reads QR codes from the back camera while `active`. Uses the browser's own
 * reader where there is one (Chrome, Android), otherwise jsQR (iPhone),
 * loaded only when needed. The same code is ignored for five seconds so one
 * card isn't read twice. While `paused.current` is true, frames are skipped.
 * The camera is let go when the tab is hidden, so it doesn't drain the battery.
 */
export function useQrScanner({
  active,
  paused,
  onValue,
  onError,
  onStop,
}: {
  active: boolean;
  paused: RefObject<boolean>;
  onValue: (value: string) => void;
  onError: (message: string) => void;
  onStop: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const last = useRef<{ v: string; t: number }>({ v: "", t: 0 });
  const handlers = useRef({ onValue, onError, onStop });
  useEffect(() => {
    handlers.current = { onValue, onError, onStop };
  });

  useEffect(() => {
    if (!active) return;
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
          if (v && v.readyState >= 2 && !paused.current) {
            let value: string | undefined;
            try {
              if (detector) {
                value = (await detector.detect(v))[0]?.rawValue;
              } else if (jsQR && ctx) {
                // Read the middle of the frame at a modest size: fast, and where people hold the code.
                const s = Math.min(v.videoWidth, v.videoHeight);
                const size = Math.min(s, 640);
                canvas.width = size;
                canvas.height = size;
                ctx.drawImage(v, (v.videoWidth - s) / 2, (v.videoHeight - s) / 2, s, s, 0, 0, size, size);
                value = jsQR(ctx.getImageData(0, 0, size, size).data, size, size, { inversionAttempts: "dontInvert" })?.data;
              }
            } catch {}
            const now = Date.now();
            if (value && (value !== last.current.v || now - last.current.t > 5000)) {
              last.current = { v: value, t: now };
              paused.current = true;
              handlers.current.onValue(value);
            }
          }
          timer = window.setTimeout(tick, detector ? 200 : 120);
        };
        tick();
      } catch (e) {
        handlers.current.onError(cameraErrorText(e));
        handlers.current.onStop();
      }
    })();

    const hide = () => document.visibilityState === "hidden" && handlers.current.onStop();
    document.addEventListener("visibilitychange", hide);
    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
      document.removeEventListener("visibilitychange", hide);
    };
  }, [active, paused]);

  return video;
}

/** A short tone: higher for a good scan, lower for anything that needs a look. A buzz on phones. */
export function beep(good: boolean) {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = good ? 880 : 300;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (good ? 0.18 : 0.4));
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.45);
    o.onended = () => ctx.close();
  } catch {}
  navigator.vibrate?.(good ? 60 : [80, 60, 80]);
}
