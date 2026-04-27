import { useMemo, useRef, useState } from "react";

type Row = Record<string, number | string>;
type SpeciesKey = "X" | "S" | "P" | "M" | "V" | "DO";

const SPECIES_COLOR: Record<SpeciesKey, string> = {
  X: "#1F77B4",
  S: "#1C1E22",
  P: "#2CA02C",
  M: "#D62728",
  V: "#9467BD",
  DO: "#17BECF",
};

const PAD = { l: 48, r: 24, t: 20, b: 34 };
const W = 760;
const H = 360;

function niceDomain(max: number): number {
  if (max <= 1) return 1;
  if (max <= 10) return Math.ceil(max);
  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  return Math.ceil(max / pow) * pow;
}

function interp(arr: { t: number; v: number }[], t: number): number | null {
  if (!arr.length) return null;
  if (t <= arr[0].t) return arr[0].v;
  if (t >= arr[arr.length - 1].t) return arr[arr.length - 1].v;
  for (let i = 1; i < arr.length; i++) {
    const a = arr[i - 1], b = arr[i];
    if (t <= b.t) {
      const r = (t - a.t) / (b.t - a.t);
      return a.v + r * (b.v - a.v);
    }
  }
  return null;
}

export function TrajectoryPlot({
  rows,
  species,
  batch,
}: {
  rows: Row[];
  species: SpeciesKey;
  batch: number;
}) {
  const unit = species === "V" ? "L" : species === "DO" ? "mg/L" : "g/L";
  const PREFIX: Record<SpeciesKey, string> = {
    X: "Biomass_X",
    S: "Glucose_S",
    P: "Lactic_Acid_P",
    M: "Maltose_M",
    V: "Volume_V",
    DO: "Dissolved_O2",
  };
  const prefix = PREFIX[species];
  const expKey = `${prefix}_experiment`;
  const predKey = species === "V" ? `${prefix}_analytical` : `${prefix}_pred_mean`;
  const scale = species === "DO" ? 1000 : 1;

  const data = useMemo(
    () =>
      rows
        .filter((r) => Number(r.Batch) === batch)
        .map((r) => ({
          t: Number(r["Time (h)"]),
          exp: Number(r[expKey]) * scale,
          pred: Number(r[predKey]) * scale,
        }))
        .filter((d) => Number.isFinite(d.t) && Number.isFinite(d.exp) && Number.isFinite(d.pred))
        .sort((a, b) => a.t - b.t),
    [rows, batch, expKey, predKey, scale]
  );

  const xMax = useMemo(() => niceDomain(Math.max(1, ...data.map((d) => d.t))), [data]);
  const yMax = useMemo(() => niceDomain(Math.max(0.5, ...data.flatMap((d) => [d.exp, d.pred])) * 1.1), [data]);

  const xScale = (t: number) => PAD.l + (t / xMax) * (W - PAD.l - PAD.r);
  const yScale = (v: number) => H - PAD.b - (v / yMax) * (H - PAD.t - PAD.b);

  const xTicks = Array.from({ length: 6 }, (_, i) => (xMax * i) / 5);
  const yTicks = Array.from({ length: 5 }, (_, i) => (yMax * i) / 4);

  const linePath = data.length
    ? data.map((d, i) => `${i === 0 ? "M" : "L"} ${xScale(d.t).toFixed(2)} ${yScale(d.pred).toFixed(2)}`).join(" ")
    : "";

  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverT, setHoverT] = useState<number | null>(null);

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const xPx = ((e.clientX - rect.left) / rect.width) * W;
    if (xPx < PAD.l || xPx > W - PAD.r) { setHoverT(null); return; }
    setHoverT(Math.max(0, Math.min(xMax, ((xPx - PAD.l) / (W - PAD.l - PAD.r)) * xMax)));
  };

  const expArr = useMemo(() => data.map((d) => ({ t: d.t, v: d.exp })), [data]);
  const predArr = useMemo(() => data.map((d) => ({ t: d.t, v: d.pred })), [data]);

  const hoverX = hoverT != null ? xScale(hoverT) : null;
  const hoverExp = hoverT != null ? interp(expArr, hoverT) : null;
  const hoverPred = hoverT != null ? interp(predArr, hoverT) : null;
  const color = SPECIES_COLOR[species];

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto cursor-crosshair"
        preserveAspectRatio="xMidYMid meet"
        style={{ fontFamily: "JetBrains Mono, monospace" }}
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverT(null)}
      >
        {yTicks.map((y) => (
          <line key={`gy-${y}`} x1={PAD.l} x2={W - PAD.r} y1={yScale(y)} y2={yScale(y)} stroke="#E7E5E0" strokeDasharray={y === 0 ? "0" : "2 4"} />
        ))}
        {xTicks.map((x) => (
          <line key={`gx-${x}`} x1={xScale(x)} x2={xScale(x)} y1={PAD.t} y2={H - PAD.b} stroke="#E7E5E0" strokeDasharray="2 4" opacity={x === 0 ? 0 : 0.6} />
        ))}
        {yTicks.map((y) => (
          <text key={`ty-${y}`} x={PAD.l - 10} y={yScale(y) + 3} textAnchor="end" fontSize={10} fill="#6B7280">
            {y % 1 === 0 ? y.toFixed(0) : y.toFixed(1)}
          </text>
        ))}
        {xTicks.map((x) => (
          <text key={`tx-${x}`} x={xScale(x)} y={H - PAD.b + 16} textAnchor="middle" fontSize={10} fill="#6B7280">
            {x % 1 === 0 ? x.toFixed(0) : x.toFixed(1)}
          </text>
        ))}
        <text
          x={0} y={0}
          transform={`translate(12, ${(PAD.t + H - PAD.b) / 2}) rotate(-90)`}
          fontSize={10} fill="#6B7280" textAnchor="middle"
        >{unit}</text>
        <text x={(W + PAD.l) / 2} y={H - 6} fontSize={10} fill="#6B7280" textAnchor="middle">Time (h)</text>

        {linePath && (
          <path d={linePath} fill="none" stroke={color} strokeWidth={2} />
        )}
        {data.map((d, i) => (
          <circle key={`pt-${i}`} cx={xScale(d.t)} cy={yScale(d.exp)} r={3}
            fill={color} fillOpacity={0.25} stroke={color} strokeWidth={1.2} />
        ))}

        {hoverX != null && (
          <g pointerEvents="none">
            <line x1={hoverX} x2={hoverX} y1={PAD.t} y2={H - PAD.b} stroke="#1C1E22" strokeWidth={1} opacity={0.2} />
            {hoverPred != null && (
              <circle cx={hoverX} cy={yScale(hoverPred)} r={3.5} fill="#FBFAF7" stroke={color} strokeWidth={1.6} />
            )}
            {hoverExp != null && (
              <circle cx={hoverX} cy={yScale(hoverExp)} r={3.5} fill={color} fillOpacity={0.35} stroke={color} strokeWidth={1.2} />
            )}
          </g>
        )}
      </svg>

      {hoverT != null && hoverX != null && (
        <div
          className="pointer-events-none absolute top-2 rounded-xl bg-canvas-raised/95 backdrop-blur-sm border border-hairline shadow-[0_4px_18px_rgba(28,30,34,0.08)] px-3 py-2 text-[11.5px] tabular"
          style={{
            left: `calc(${(hoverX / W) * 100}% + 10px)`,
            transform: hoverX > W * 0.7 ? "translateX(calc(-100% - 22px))" : undefined,
          }}
        >
          <div className="text-muted text-[10.5px] uppercase tracking-wide mb-1">t = {hoverT.toFixed(1)} h</div>
          <div className="space-y-1">
            {hoverPred != null && (
              <TooltipRow color={color} label="Predicted" value={hoverPred} unit={unit} />
            )}
            {hoverExp != null && (
              <TooltipRow color={color} label="Experiment" value={hoverExp} unit={unit} dot />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TooltipRow({ color, label, value, unit, dot }: { color: string; label: string; value: number; unit: string; dot?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="inline-flex items-center gap-1.5 text-ink-soft">
        {dot
          ? <span className="w-2 h-2 rounded-full border-[1.5px]" style={{ borderColor: color }} />
          : <span className="w-2 h-[2px] rounded-full" style={{ background: color }} />
        }
        {label}
      </span>
      <span className="text-ink">{value.toFixed(2)} <span className="text-muted-soft">{unit}</span></span>
    </div>
  );
}
