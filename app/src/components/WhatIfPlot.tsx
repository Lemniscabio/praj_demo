import { motion } from "framer-motion";
import { useMemo, useRef, useState } from "react";
import type { GridCell, Species } from "../lib/whatif";

const SPECIES_COLOR: Record<Species, string> = {
  X: "#1F77B4",
  S: "#1C1E22",
  P: "#2CA02C",
  M: "#D62728",
};

const SPECIES_LABEL: Record<Species, string> = {
  X: "Biomass (X)",
  S: "Glucose (S)",
  P: "Product (P)",
  M: "Maltose (M)",
};

const PAD = { l: 40, r: 14, t: 16, b: 26 };
const W = 360;
const H = 210;

function niceMax(raw: number): number {
  if (raw <= 1) return 1;
  if (raw <= 5) return Math.ceil(raw);
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = pow / 2;
  return Math.ceil(raw / step) * step;
}

function interp(arr: number[], time: number[], t: number): number | null {
  if (!arr.length) return null;
  if (t <= time[0]) return arr[0];
  if (t >= time[time.length - 1]) return arr[arr.length - 1];
  for (let i = 1; i < time.length; i++) {
    if (t <= time[i]) {
      const r = (t - time[i - 1]) / (time[i] - time[i - 1]);
      return arr[i - 1] + r * (arr[i] - arr[i - 1]);
    }
  }
  return null;
}

function Panel({
  species,
  time,
  mean,
  std,
  xMax,
  hoverT,
  onHover,
}: {
  species: Species;
  time: number[];
  mean: number[];
  std: number[];
  xMax: number;
  hoverT: number | null;
  onHover: (t: number | null) => void;
}) {
  const color = SPECIES_COLOR[species];
  const upper = mean.map((m, i) => m + 2 * std[i]);
  const lower = mean.map((m, i) => Math.max(0, m - 2 * std[i]));
  const yMax = useMemo(() => niceMax(Math.max(0.5, ...upper) * 1.08), [upper]);

  const xScale = (t: number) => PAD.l + (t / xMax) * (W - PAD.l - PAD.r);
  const yScale = (v: number) => H - PAD.b - (v / yMax) * (H - PAD.t - PAD.b);

  const meanPath = mean
    .map((v, i) => `${i === 0 ? "M" : "L"} ${xScale(time[i]).toFixed(2)} ${yScale(v).toFixed(2)}`)
    .join(" ");

  const envPath = [
    ...upper.map((v, i) => `${i === 0 ? "M" : "L"} ${xScale(time[i]).toFixed(2)} ${yScale(v).toFixed(2)}`),
    ...lower.slice().reverse().map((v, i) => {
      const idx = lower.length - 1 - i;
      return `L ${xScale(time[idx]).toFixed(2)} ${yScale(v).toFixed(2)}`;
    }),
    "Z",
  ].join(" ");

  const yTicks = [0, yMax / 2, yMax];
  const xTicks = [0, xMax / 2, xMax];

  const svgRef = useRef<SVGSVGElement | null>(null);

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const xPx = ((e.clientX - rect.left) / rect.width) * W;
    if (xPx < PAD.l || xPx > W - PAD.r) { onHover(null); return; }
    onHover(Math.max(0, Math.min(xMax, ((xPx - PAD.l) / (W - PAD.l - PAD.r)) * xMax)));
  };

  const hoverX = hoverT != null ? xScale(hoverT) : null;
  const hoverMean = hoverT != null ? interp(mean, time, hoverT) : null;
  const hoverUpper = hoverT != null ? interp(upper, time, hoverT) : null;
  const hoverLower = hoverT != null ? interp(lower, time, hoverT) : null;

  const fmt = (n: number) => (yMax < 10 ? n.toFixed(1) : n.toFixed(0));

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto cursor-crosshair"
        preserveAspectRatio="xMidYMid meet"
        style={{ fontFamily: "JetBrains Mono, monospace" }}
        onMouseMove={handleMove}
        onMouseLeave={() => onHover(null)}
      >
        <text x={PAD.l} y={12} fontSize={11} fill="#1C1E22" fontFamily="Inter, sans-serif" fontWeight={500}>
          {SPECIES_LABEL[species]}
        </text>
        <text x={W - PAD.r} y={12} fontSize={10} fill="#6B7280" textAnchor="end">g/L</text>

        {yTicks.map((y) => (
          <line key={`gy-${y}`} x1={PAD.l} x2={W - PAD.r} y1={yScale(y)} y2={yScale(y)}
            stroke="#E7E5E0" strokeDasharray={y === 0 ? "0" : "2 4"} />
        ))}
        {yTicks.map((y) => (
          <text key={`ty-${y}`} x={PAD.l - 6} y={yScale(y) + 3} textAnchor="end" fontSize={9.5} fill="#6B7280">
            {fmt(y)}
          </text>
        ))}
        {xTicks.map((x) => (
          <text key={`tx-${x}`} x={xScale(x)} y={H - PAD.b + 14} textAnchor="middle" fontSize={9.5} fill="#6B7280">
            {x.toFixed(0)}h
          </text>
        ))}

        <motion.path d={envPath} fill={color} fillOpacity={0.12} stroke="none"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }} />
        <motion.path d={meanPath} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
          transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }} />

        {hoverX != null && (
          <g pointerEvents="none">
            <line x1={hoverX} x2={hoverX} y1={PAD.t} y2={H - PAD.b} stroke="#1C1E22" strokeWidth={1} opacity={0.2} />
            {hoverUpper != null && <circle cx={hoverX} cy={yScale(hoverUpper)} r={2.5} fill={color} opacity={0.35} />}
            {hoverLower != null && <circle cx={hoverX} cy={yScale(hoverLower)} r={2.5} fill={color} opacity={0.35} />}
            {hoverMean != null && <circle cx={hoverX} cy={yScale(hoverMean)} r={3.5} fill="#FBFAF7" stroke={color} strokeWidth={1.6} />}
          </g>
        )}
      </svg>

      {hoverT != null && hoverX != null && hoverMean != null && (
        <div
          className="pointer-events-none absolute top-2 rounded-lg bg-canvas-raised/95 backdrop-blur-sm border border-hairline shadow-[0_4px_14px_rgba(28,30,34,0.08)] px-2.5 py-1.5 text-[11px] tabular"
          style={{
            left: `calc(${(hoverX / W) * 100}% + 8px)`,
            transform: hoverX > W * 0.65 ? "translateX(calc(-100% - 18px))" : undefined,
          }}
        >
          <div className="text-muted text-[10px] uppercase tracking-wide mb-1">{hoverT.toFixed(1)} h</div>
          <div className="flex items-center gap-1.5 text-ink">
            <span className="w-2 h-[2px] rounded-full" style={{ background: color }} />
            {hoverMean.toFixed(2)}
          </div>
          {hoverUpper != null && hoverLower != null && (
            <div className="text-muted-soft text-[10px] mt-0.5">
              ±2σ [{hoverLower.toFixed(1)}, {hoverUpper.toFixed(1)}]
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function WhatIfPlot({ cell, time }: { cell: GridCell; time: number[] }) {
  const xMax = time[time.length - 1];
  const species: Species[] = ["X", "S", "P", "M"];
  const [hoverT, setHoverT] = useState<number | null>(null);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {species.map((s) => (
        <div key={s} className="rounded-xl bg-canvas border border-hairline/60 p-3">
          <Panel
            species={s}
            time={time}
            mean={cell[s].mean}
            std={cell[s].std}
            xMax={xMax}
            hoverT={hoverT}
            onHover={setHoverT}
          />
        </div>
      ))}
    </div>
  );
}
