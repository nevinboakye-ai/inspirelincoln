"use client";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  z: number; // depth 0..1 (1 = near)
  hue: 0 | 1 | 2;
  phase: number;
}

const COLOURS = [
  [57, 213, 242], // cyan
  [52, 120, 246], // electric
  [133, 120, 249], // violet
] as const;

/**
 * Lightweight animated network: drifting nodes linked by proximity, with a
 * gentle response to the cursor. Canvas 2D, capped node count and DPR, paused
 * when off-screen or the tab is hidden, and rendered as a single still frame
 * when the visitor prefers reduced motion.
 */
export function NeuralField({ className, density = 1, interactive = true }: { className?: string; density?: number; interactive?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let nodes: Node[] = [];
    let raf = 0;
    let running = false;
    let visible = true;
    const pointer = { x: -9999, y: -9999, tx: -9999, ty: -9999, active: false };

    const seed = () => {
      const area = width * height;
      const target = Math.round(Math.min(coarse ? 55 : 120, Math.max(28, (area / 14000) * density)));
      nodes = Array.from({ length: target }, () => {
        const z = Math.random();
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.18 * (0.4 + z),
          vy: (Math.random() - 0.5) * 0.18 * (0.4 + z),
          z,
          hue: (Math.random() < 0.55 ? 0 : Math.random() < 0.6 ? 1 : 2) as Node["hue"],
          phase: Math.random() * Math.PI * 2,
        };
      });
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
      if (!running) draw(0);
    };

    const linkDist = () => Math.min(170, Math.max(110, width / 10));

    const draw = (t: number) => {
      ctx.clearRect(0, 0, width, height);
      pointer.x += (pointer.tx - pointer.x) * 0.08;
      pointer.y += (pointer.ty - pointer.y) * 0.08;
      const maxD = linkDist();
      const maxD2 = maxD * maxD;

      // Parallax offset from pointer gives subtle depth.
      const px = pointer.active ? (pointer.x / width - 0.5) : 0;
      const py = pointer.active ? (pointer.y / height - 0.5) : 0;

      const pos = nodes.map((n) => ({ x: n.x - px * 24 * n.z, y: n.y - py * 24 * n.z }));

      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        const a = pos[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = pos[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > maxD2) continue;
          let alpha = (1 - d2 / maxD2) * 0.22 * (0.4 + (nodes[i].z + nodes[j].z) / 2);
          if (pointer.active) {
            const mx = (a.x + b.x) / 2 - pointer.x;
            const my = (a.y + b.y) / 2 - pointer.y;
            const md = Math.sqrt(mx * mx + my * my);
            if (md < 180) alpha += (1 - md / 180) * 0.35;
          }
          const c = COLOURS[nodes[i].hue];
          ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${alpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const p = pos[i];
        const pulse = reduced ? 1 : 0.75 + 0.25 * Math.sin(t / 900 + n.phase);
        const r = (0.8 + n.z * 1.9) * pulse;
        const c = COLOURS[n.hue];
        ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${(0.35 + n.z * 0.6).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
        if (n.z > 0.85) {
          ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},0.08)`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r * 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    const step = (t: number) => {
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (pointer.active) {
          const dx = n.x - pointer.x;
          const dy = n.y - pointer.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 140 * 140 && d2 > 1) {
            const f = (1 - Math.sqrt(d2) / 140) * 0.35;
            n.x += (dx / Math.sqrt(d2)) * f;
            n.y += (dy / Math.sqrt(d2)) * f;
          }
        }
        if (n.x < -20) n.x = width + 20;
        else if (n.x > width + 20) n.x = -20;
        if (n.y < -20) n.y = height + 20;
        else if (n.y > height + 20) n.y = -20;
      }
      draw(t);
      raf = requestAnimationFrame(step);
    };

    const start = () => {
      if (running || reduced || !visible || document.hidden) return;
      running = true;
      raf = requestAnimationFrame(step);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    const onMove = (e: PointerEvent) => {
      if (!interactive || e.pointerType === "touch") return;
      const rect = canvas.getBoundingClientRect();
      pointer.tx = e.clientX - rect.left;
      pointer.ty = e.clientY - rect.top;
      if (!pointer.active) {
        pointer.x = pointer.tx;
        pointer.y = pointer.ty;
      }
      pointer.active = pointer.ty > 0 && pointer.ty < height;
    };
    const onLeave = () => {
      pointer.active = false;
    };
    const onVisibility = () => (document.hidden ? stop() : start());

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
      else stop();
    });
    const ro = new ResizeObserver(resize);

    resize();
    ro.observe(canvas);
    io.observe(canvas);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    document.addEventListener("visibilitychange", onVisibility);
    start();

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [density, interactive]);

  return <canvas ref={canvasRef} aria-hidden className={cn("pointer-events-none absolute inset-0 h-full w-full", className)} />;
}
