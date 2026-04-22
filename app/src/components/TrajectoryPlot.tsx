import { useMemo } from "react";

type Row = Record<string, number | string>;
type SpeciesKey = "X" | "S" | "P" | "M" | "V";

// Bold, distinct species colors matching the README (matplotlib Tab10-ish)
// (blue, black, green, red, purple)
const SPECIES_COLOR: Record<SpeciesKey, string> = {
  X: "#1F77B4",
  S: "#1C1E22",
  P: "#2CA02C",
  M: "#D62728",
  V: "#9467BD",
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

export function TrajectoryPlot({
  rows,
  species,
  batch,
}: {
  rows: Row[];
  species: SpeciesKey;
  batch: number;
}) {
  const unit = species === "V" ? "L" : "g/L";
  const expKey = `${species}_experiment (${unit})`;
  const predKey = `${species}_predicted (${unit})`;

  const data = useMemo(
    () =>
      rows
        .filter((r) => Number(r.Batch) === batch)
        .map((r) => ({
          t: Number(r["Time (h)"]),
          exp: Number(r[expKey]),
          pred: Number(r[predKey]),
        }))
        .filter((d) => Number.isFinite(d.t) && Number.isFinite(d.exp) && Number.isFinite(d.pred))
        .sort((a, b) => a.t - b.t),
    [rows, batch, expKey, predKey]
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

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet" style={{ fontFamily: "JetBrains Mono, monospace" }}>
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
      <text x={PAD.l - 36} y={PAD.t + 2} fontSize={10} fill="#6B7280">{unit}</text>
      <text x={(W + PAD.l) / 2} y={H - 6} fontSize={10} fill="#6B7280" textAnchor="middle">Time (h)</text>

      {/* Prediction line */}
      {linePath && (
        <path d={linePath} fill="none" stroke={SPECIES_COLOR[species]} strokeWidth={2} />
      )}

      {/* Experiment points */}
      {data.map((d, i) => (
        <circle
          key={`pt-${i}`}
          cx={xScale(d.t)}
          cy={yScale(d.exp)}
          r={3}
          fill={SPECIES_COLOR[species]}
          fillOpacity={0.25}
          stroke={SPECIES_COLOR[species]}
          strokeWidth={1.2}
        />
      ))}
    </svg>
  );
}
