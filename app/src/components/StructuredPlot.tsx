import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";

type Row = Record<string, number | string>;

const CHANNELS = [
  { key: "Biomass X (g/L)",   label: "Biomass X",  color: "#1F77B4", unit: "g/L"  },
  { key: "Glucose S (g/L)",   label: "Glucose S",  color: "#1C1E22", unit: "g/L"  },
  { key: "Lactic Acid P (g/L)", label: "Lactic P", color: "#2CA02C", unit: "g/L"  },
  { key: "Maltose M (g/L)",   label: "Maltose M",  color: "#D62728", unit: "g/L"  },
  { key: "Dissolved O2 (g/L)", label: "DO₂",       color: "#17BECF", unit: "mg/L", scale: 1000 },
  { key: "Volume V (L)",      label: "Volume V",   color: "#9467BD", unit: "L"    },
] as const;

const PAD = { l: 34, r: 10, t: 14, b: 22 };
const W = 260;
const H = 130;

function niceMax(raw: number): number {
  if (raw <= 0) return 1;
  if (raw <= 1) return 1;
  if (raw <= 10) return Math.ceil(raw);
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = pow / 2;
  return Math.ceil(raw / step) * step;
}

function nearest(pts: { t: number; v: number }[], t: number): { t: number; v: number } | null {
  if (!pts.length) return null;
  let best = pts[0];
  let bestD = Math.abs(best.t - t);
  for (let i = 1; i < pts.length; i++) {
    const d = Math.abs(pts[i].t - t);
    if (d < bestD) { best = pts[i]; bestD = d; }
  }
  return best;
}

function Panel({
  ch,
  data,
  tMax,
  hoverT,
  onHover,
  animDelay,
}: {
  ch: (typeof CHANNELS)[number];
  data: { t: number; vals: Record<string, number> }[];
  tMax: number;
  hoverT: number | null;
  onHover: (t: number | null) => void;
  animDelay: number;
}) {
  const scale = (ch as { scale?: number }).scale ?? 1;
  const channelMax = Math.max(0, ...data.map((d) => d.vals[ch.key] * scale).filter((n) => Number.isFinite(n)));
  const yMax = niceMax(channelMax * 1.08);

  const xScale = (t: number) => PAD.l + (t / tMax) * (W - PAD.l - PAD.r);
  const yScale = (v: number) => H - PAD.b - (v / yMax) * (H - PAD.t - PAD.b);
  const yTicks = [0, yMax / 2, yMax];
  const xTicks = [0, tMax];
  const fmt = (n: number) => (yMax < 10 ? n.toFixed(1) : n.toFixed(0));

  const pts2 = data.filter((d) => Number.isFinite(d.vals[ch.key]));

  const pts = useMemo(() => data.map((d) => ({ t: d.t, v: d.vals[ch.key] * scale })).filter((p) => Number.isFinite(p.v)), [data, ch.key, scale]);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const xPx = ((e.clientX - rect.left) / rect.width) * W;
    if (xPx < PAD.l || xPx > W - PAD.r) { onHover(null); return; }
    onHover(Math.max(0, Math.min(tMax, ((xPx - PAD.l) / (W - PAD.l - PAD.r)) * tMax)));
  };

  const snapped = hoverT != null ? nearest(pts, hoverT) : null;
  const hoverX = snapped != null ? xScale(snapped.t) : null;
  const hoverVal = snapped != null ? snapped.v : null;

  return (
    <div className="rounded-lg bg-canvas-raised/60 border border-hairline/60 p-2 relative">
      <div className="flex items-center justify-between mb-1 px-0.5">
        <span className="inline-flex items-center gap-1.5 text-[10.5px] text-ink">
          <span className="inline-block w-2.5 h-[2px] rounded-full" style={{ background: ch.color }} />
          {ch.label}
        </span>
        <span className="text-[10px] text-muted-soft tabular">{ch.unit}</span>
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
        {yTicks.map((y) => (
          <line key={`gy-${y}`} x1={PAD.l} x2={W - PAD.r} y1={yScale(y)} y2={yScale(y)}
            stroke="#E7E5E0" strokeDasharray={y === 0 ? "0" : "2 4"} />
        ))}
        {yTicks.map((y) => (
          <text key={`ty-${y}`} x={PAD.l - 5} y={yScale(y) + 3} textAnchor="end" fontSize={9} fill="#6B7280">
            {fmt(y)}
          </text>
        ))}
        {xTicks.map((x) => (
          <text key={`tx-${x}`} x={xScale(x)} y={H - PAD.b + 12} textAnchor="middle" fontSize={9} fill="#6B7280">
            {x.toFixed(0)}h
          </text>
        ))}
        {pts2.map((d, j) => (
          <motion.circle
            key={j}
            cx={xScale(d.t)}
            cy={yScale(d.vals[ch.key] * scale)}
            r={1.8}
            fill={ch.color}
            opacity={0.75}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 0.75, scale: 1 }}
            transition={{ duration: 0.18, delay: animDelay + j * 0.004, ease: [0.23, 1, 0.32, 1] }}
          />
        ))}

        {hoverX != null && hoverVal != null && (
          <g pointerEvents="none">
            <line x1={hoverX} x2={hoverX} y1={PAD.t} y2={H - PAD.b} stroke="#1C1E22" strokeWidth={1} opacity={0.18} />
            <circle cx={hoverX} cy={yScale(hoverVal)} r={3} fill="#FBFAF7" stroke={ch.color} strokeWidth={1.4} />
          </g>
        )}
      </svg>

      {snapped != null && hoverX != null && hoverVal != null && (
        <div
          className="pointer-events-none absolute rounded-md bg-canvas-raised/95 backdrop-blur-sm border border-hairline shadow-[0_2px_10px_rgba(28,30,34,0.07)] px-2 py-1 text-[10.5px] tabular"
          style={{
            top: "28px",
            left: `calc(${(hoverX / W) * 100}% + 6px)`,
            transform: hoverX > W * 0.65 ? "translateX(calc(-100% - 14px))" : undefined,
          }}
        >
          <span className="text-muted">{String(Number(snapped.t.toFixed(5)))}h · </span>
          <span className="text-ink">{String(Number(hoverVal.toFixed(5)))}</span>
          <span className="text-muted-soft"> {ch.unit}</span>
        </div>
      )}
    </div>
  );
}

export function StructuredPlot({ rows, batchName }: { rows: Row[]; batchName: string }) {
  const data = useMemo(() => {
    return rows
      .map((r) => {
        const t = Number(r["Time (h)"]);
        if (!Number.isFinite(t)) return null;
        const vals: Record<string, number> = {};
        for (const ch of CHANNELS) vals[ch.key] = Number(r[ch.key]);
        return { t, vals };
      })
      .filter((x): x is { t: number; vals: Record<string, number> } => x != null)
      .sort((a, b) => a.t - b.t);
  }, [rows]);

  const tMax = useMemo(() => niceMax(Math.max(1, ...data.map((d) => d.t))), [data]);
  const [hoverT, setHoverT] = useState<number | null>(null);

  return (
    <div className="rounded-xl bg-canvas border border-hairline/70 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] uppercase tracking-[0.12em] text-muted">Trajectory · {batchName}</div>
        <div className="text-[10.5px] text-muted-soft tabular">per-channel scales</div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
        {CHANNELS.map((ch, i) => (
          <Panel
            key={ch.key}
            ch={ch}
            data={data}
            tMax={tMax}
            hoverT={hoverT}
            onHover={setHoverT}
            animDelay={i * 0.05}
          />
        ))}
      </div>
    </div>
  );
}
