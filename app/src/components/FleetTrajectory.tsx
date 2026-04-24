import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { WhatIfGrid, Species } from "../lib/whatif";

/**
 * One row of four species panels (X, S, P, M). Each panel overlays the
 * mean trajectory for all four reactor scales at the selected D × GF cell.
 * The production scale (last entry in scaleKeys) carries the ±2σ band;
 * the smaller scales are drawn as thin mean lines for comparison.
 * Hover is synced across panels via a shared crosshair time.
 */
export function FleetTrajectory({
  grid,
  dKey,
  gfKey,
}: {
  grid: WhatIfGrid;
  dKey: string;
  gfKey: string;
}) {
  const species: Species[] = ["X", "S", "P", "M"];
  const labels: Record<Species, string> = {
    X: "Biomass (X)",
    S: "Glucose (S)",
    P: "Lactic acid (P)",
    M: "Maltose (M)",
    O2: "Dissolved O₂",
  };

  const [hoverT, setHoverT] = useState<number | null>(null);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {species.map((sp) => (
        <SpeciesPanel
          key={sp}
          grid={grid}
          dKey={dKey}
          gfKey={gfKey}
          species={sp}
          label={labels[sp]}
          hoverT={hoverT}
          onHover={setHoverT}
        />
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */

function SpeciesPanel({
  grid,
  dKey,
  gfKey,
  species,
  label,
  hoverT,
  onHover,
}: {
  grid: WhatIfGrid;
  dKey: string;
  gfKey: string;
  species: Species;
  label: string;
  hoverT: number | null;
  onHover: (t: number | null) => void;
}) {
  const time = grid.time;
  const W = 420;
  const H = 240;
  const PAD = { l: 44, r: 18, t: 18, b: 30 };

  const traces = useMemo(
    () =>
      grid.scaleKeys.map((scaleKey, i) => {
        const cell = grid.cells[scaleKey]?.[dKey]?.[gfKey];
        const mean = cell ? cell[species].mean : [];
        const std  = cell ? cell[species].std  : [];
        return {
          scaleKey,
          scaleL: Number(scaleKey),
          color: scaleColor(i, grid.scaleKeys.length),
          mean,
          std,
          upper: mean.map((m, j) => m + 2 * std[j]),
          lower: mean.map((m, j) => Math.max(0, m - 2 * std[j])),
          isProd: i === grid.scaleKeys.length - 1,
          bandOpacity: [0.18, 0.20, 0.22, 0.26][i] ?? 0.20,
        };
      }),
    [grid, dKey, gfKey, species],
  );

  const allUppers = traces.flatMap((t) => t.upper);
  const allMeans  = traces.flatMap((t) => t.mean);
  const yMax = niceMax(Math.max(0.5, ...allMeans, ...allUppers) * 1.06);
  const xMax = time[time.length - 1] || 75;

  const xs = (t: number) => PAD.l + (t / xMax) * (W - PAD.l - PAD.r);
  const ys = (v: number) => H - PAD.b - (v / yMax) * (H - PAD.t - PAD.b);

  const fmt = (n: number) => (yMax < 10 ? n.toFixed(1) : n.toFixed(0));
  const yTicks = [0, yMax / 4, yMax / 2, (3 * yMax) / 4, yMax];
  const xTicks = [0, xMax / 4, xMax / 2, (3 * xMax) / 4, xMax];

  const envPath = (upper: number[], lower: number[]) =>
    upper.length
      ? [
          ...upper.map((v, i) => `${i === 0 ? "M" : "L"} ${xs(time[i]).toFixed(1)} ${ys(v).toFixed(1)}`),
          ...[...lower].reverse().map((v, i) => {
            const idx = lower.length - 1 - i;
            return `L ${xs(time[idx]).toFixed(1)} ${ys(v).toFixed(1)}`;
          }),
          "Z",
        ].join(" ")
      : "";

  const svgRef = useRef<SVGSVGElement | null>(null);
  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const xPx = ((e.clientX - rect.left) / rect.width) * W;
    if (xPx < PAD.l || xPx > W - PAD.r) {
      onHover(null);
      return;
    }
    onHover(Math.max(0, Math.min(xMax, ((xPx - PAD.l) / (W - PAD.l - PAD.r)) * xMax)));
  };

  const hoverX = hoverT != null ? xs(hoverT) : null;
  const hoverValues = useMemo(() => {
    if (hoverT == null) return null;
    return traces.map((tr) => ({
      scaleKey: tr.scaleKey,
      scaleL: tr.scaleL,
      color: tr.color,
      isProd: tr.isProd,
      mean:  tr.mean.length  ? interp(tr.mean,  time, hoverT) : null,
      upper: tr.upper.length ? interp(tr.upper, time, hoverT) : null,
      lower: tr.lower.length ? interp(tr.lower, time, hoverT) : null,
    }));
  }, [hoverT, traces, time]);

  return (
    <div className="rounded-xl bg-canvas border border-hairline/70 p-3 relative">
      <div className="flex items-baseline justify-between px-1 mb-1.5">
        <span className="text-[12.5px] text-ink">{label}</span>
        <span className="text-[10.5px] text-muted-soft tabular">g/L</span>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto cursor-crosshair"
        preserveAspectRatio="xMidYMid meet"
        style={{ fontFamily: "JetBrains Mono, monospace" }}
        onMouseMove={handleMove}
        onMouseLeave={() => onHover(null)}
      >
        {/* Grid */}
        {yTicks.map((y) => (
          <line
            key={`gy-${y}`}
            x1={PAD.l}
            x2={W - PAD.r}
            y1={ys(y)}
            y2={ys(y)}
            stroke="#E7E5E0"
            strokeDasharray={y === 0 ? "0" : "2 4"}
          />
        ))}
        {xTicks.map((x) => (
          <line
            key={`gx-${x}`}
            x1={xs(x)}
            x2={xs(x)}
            y1={PAD.t}
            y2={H - PAD.b}
            stroke="#E7E5E0"
            strokeDasharray="2 4"
            opacity={x === 0 ? 0 : 0.55}
          />
        ))}
        {yTicks.map((y) => (
          <text key={`ty-${y}`} x={PAD.l - 6} y={ys(y) + 3} textAnchor="end" fontSize={9.5} fill="#6B7280">
            {fmt(y)}
          </text>
        ))}
        {xTicks.map((x) => (
          <text key={`tx-${x}`} x={xs(x)} y={H - PAD.b + 14} textAnchor="middle" fontSize={9.5} fill="#6B7280">
            {x.toFixed(0)}h
          </text>
        ))}

        {/* Per-scale ±2σ envelopes */}
        {traces.map((tr) => {
          const p = envPath(tr.upper, tr.lower);
          return p ? (
            <motion.path
              key={`env-${tr.scaleKey}`}
              d={p}
              fill={tr.color}
              fillOpacity={tr.bandOpacity}
              stroke="none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            />
          ) : null;
        })}

        {/* Per-scale mean lines */}
        {traces.map((tr) =>
          tr.mean.length ? (
            <motion.path
              key={tr.scaleKey}
              d={tr.mean
                .map((v, i) => `${i === 0 ? "M" : "L"} ${xs(time[i]).toFixed(1)} ${ys(v).toFixed(1)}`)
                .join(" ")}
              fill="none"
              stroke={tr.color}
              strokeWidth={tr.isProd ? 2.2 : 1.3}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={tr.isProd ? "4 4" : undefined}
              opacity={tr.isProd ? 0.6 : 0.85}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.75, ease: [0.23, 1, 0.32, 1] }}
            />
          ) : null,
        )}

        {/* Hover crosshair + per-scale dots */}
        {hoverX != null && hoverValues && (
          <g pointerEvents="none">
            <line
              x1={hoverX}
              x2={hoverX}
              y1={PAD.t}
              y2={H - PAD.b}
              stroke="#1C1E22"
              strokeWidth={1}
              opacity={0.22}
            />
            {hoverValues.map((v) =>
              v.mean == null ? null : (
                <circle
                  key={v.scaleKey}
                  cx={hoverX}
                  cy={ys(v.mean)}
                  r={v.isProd ? 3.5 : 2.8}
                  fill="#FBFAF7"
                  stroke={v.color}
                  strokeWidth={v.isProd ? 1.7 : 1.3}
                />
              ),
            )}
          </g>
        )}
      </svg>

      {/* HTML tooltip */}
      {hoverT != null && hoverX != null && hoverValues && (
        <div
          className="pointer-events-none absolute top-7 rounded-lg bg-canvas-raised/95 backdrop-blur-sm border border-hairline shadow-[0_4px_14px_rgba(28,30,34,0.08)] px-2.5 py-2 text-[11px] tabular min-w-[150px]"
          style={{
            left: `calc(${(hoverX / W) * 100}% + 10px)`,
            transform: hoverX > W * 0.62 ? "translateX(calc(-100% - 20px))" : undefined,
          }}
        >
          <div className="text-muted text-[10px] uppercase tracking-wide mb-1">
            t = {hoverT.toFixed(1)} h
          </div>
          <div className="space-y-0.5">
            {hoverValues.map((v) =>
              v.mean == null ? null : (
                <div key={v.scaleKey} className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 text-ink-soft">
                    <span className="inline-block w-2 h-[2px] rounded-full" style={{ background: v.color }} />
                    {formatScale(v.scaleL)}
                  </span>
                  <span className="text-ink">{v.mean.toFixed(2)}</span>
                </div>
              ),
            )}
            {hoverValues.map((v) =>
              v.upper != null && v.lower != null ? (
                <div key={`band-${v.scaleKey}`} className="text-[10px] text-muted-soft">
                  ±2σ [{v.lower.toFixed(1)}, {v.upper.toFixed(1)}]
                </div>
              ) : null,
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── helpers ─────────────────────────────────────────────────────────── */

export function scaleColor(i: number, _n: number): string {
  const palette = ["#4E9AF0", "#3DBE8A", "#F0924A", "#9B6EC8"];
  return palette[i % palette.length];
}

function niceMax(raw: number): number {
  if (raw <= 1) return 1;
  if (raw <= 10) return Math.ceil(raw);
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

function formatScale(l: number): string {
  if (l >= 1000) return `${(l / 1000).toLocaleString()} m³`;
  return `${l} L`;
}
