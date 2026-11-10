import type { Workshop } from "@/lib/types";
import { cn } from "@/lib/cn";

export const ACCENT_HEX: Record<Workshop["accent"], string> = {
  electric: "#3478F6",
  cyan: "#39D5F2",
  violet: "#8578F9",
};

/**
 * Distinct generative mark for each workshop. Pure SVG; group-hover on a parent
 * `.group` animates strokes via CSS transitions only.
 */
export function WorkshopMotif({ motif, accent, className }: { motif: Workshop["motif"]; accent: Workshop["accent"]; className?: string }) {
  const c = ACCENT_HEX[accent];
  const common = "transition-all duration-700 ease-[var(--ease-out-expo)]";
  return (
    <svg viewBox="0 0 240 160" className={cn("h-full w-full", className)} aria-hidden>
      {motif === "manuscript" && (
        <g>
          {[0, 1, 2, 3].map((i) => (
            <rect
              key={i}
              x={60 + i * 10}
              y={24 + i * 8}
              width={96}
              height={120}
              rx={6}
              fill="#071426"
              stroke={c}
              strokeOpacity={0.25 + i * 0.2}
              className={cn(common, "group-hover:translate-x-[var(--dx)]")}
              style={{ ["--dx" as string]: `${i * 8}px` }}
            />
          ))}
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <line key={i} x1={104} x2={i % 3 === 2 ? 160 : 176} y1={60 + i * 12} y2={60 + i * 12} stroke={c} strokeOpacity={0.7} strokeWidth={2} strokeLinecap="round" className={common} />
          ))}
          <circle cx={176} cy={140} r={10} fill={c} className={cn(common, "origin-[176px_140px] group-hover:scale-125")} />
        </g>
      )}
      {motif === "pulse" && (
        <g>
          <path d="M10 90 H70 L82 90 L92 50 L106 128 L120 30 L134 104 L144 90 H230" fill="none" stroke={c} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" pathLength={1} strokeDasharray="1" className={cn(common, "[stroke-dashoffset:0.35] group-hover:[stroke-dashoffset:0]")} />
          {[40, 180, 210].map((x, i) => (
            <rect key={i} x={x - 10} y={110 + (i % 2) * 8} width={20} height={20 + i * 6} rx={3} fill={c} fillOpacity={0.25} />
          ))}
          <circle cx={120} cy={30} r={5} fill={c} />
        </g>
      )}
      {motif === "evidence" && (
        <g>
          {[0, 1, 2, 3, 4].map((i) => (
            <path key={i} d={`M120 ${140 - i * 26} L${120 - (5 - i) * 22} 140 H${120 + (5 - i) * 22} Z`} fill={c} fillOpacity={0.08 + i * 0.07} stroke={c} strokeOpacity={0.5} className={cn(common, "group-hover:-translate-y-1")} />
          ))}
          <circle cx={120} cy={22} r={6} fill={c} className={cn(common, "group-hover:-translate-y-2")} />
        </g>
      )}
      {motif === "portfolio" && (
        <g>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => {
            const col = i % 3;
            const row = Math.floor(i / 3);
            const filled = [0, 4, 5, 7].includes(i);
            return (
              <rect key={i} x={66 + col * 38} y={22 + row * 40} width={30} height={30} rx={6} fill={filled ? c : "#071426"} fillOpacity={filled ? 0.85 : 1} stroke={c} strokeOpacity={0.45} className={cn(common, !filled && "group-hover:fill-[var(--c)]")} style={{ ["--c" as string]: `${c}55` }} />
            );
          })}
        </g>
      )}
      {motif === "simulation" && (
        <g>
          <ellipse cx={120} cy={80} rx={90} ry={34} fill="none" stroke={c} strokeOpacity={0.4} />
          <ellipse cx={120} cy={80} rx={60} ry={58} fill="none" stroke={c} strokeOpacity={0.25} className={cn(common, "origin-[120px_80px] group-hover:rotate-45")} />
          <ellipse cx={120} cy={80} rx={34} ry={70} fill="none" stroke={c} strokeOpacity={0.25} className={cn(common, "origin-[120px_80px] group-hover:-rotate-45")} />
          <circle cx={120} cy={80} r={12} fill={c} />
          <path d="M40 140 L200 20" stroke={c} strokeOpacity={0.5} strokeDasharray="4 6" />
        </g>
      )}
      {motif === "globe" && (
        <g>
          <circle cx={120} cy={80} r={62} fill="none" stroke={c} strokeOpacity={0.5} />
          {[-40, -15, 15, 40].map((y) => (
            <ellipse key={y} cx={120} cy={80 + y * 0.9} rx={Math.sqrt(62 * 62 - (y * 0.9) ** 2)} ry={4} fill="none" stroke={c} strokeOpacity={0.2} />
          ))}
          <ellipse cx={120} cy={80} rx={26} ry={62} fill="none" stroke={c} strokeOpacity={0.3} className={cn(common, "origin-[120px_80px] group-hover:[transform:scaleX(1.8)]")} />
          {[[92, 56], [150, 70], [110, 112], [138, 40]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={i === 0 ? 6 : 3.5} fill={c} fillOpacity={i === 0 ? 1 : 0.4} />
          ))}
        </g>
      )}
    </svg>
  );
}
