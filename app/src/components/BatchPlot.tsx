import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";

export type Point = { t: number; p: number; lo?: number; hi?: number };

const PAD = { l: 44, r: 20, t: 20, b: 32 };
const W = 760;
const H = 380;

function niceMax(raw: number): number {
  if (raw <= 1) return 1;
  if (raw <= 10) return Math.ceil(raw);
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = pow / 2;
  return Math.ceil(raw / step) * step;
}

function niceTicks(max: number): number[] {
  const step = max <= 20 ? 5 : max <= 50 ? 10 : max <= 100 ? 20 : max <= 200 ? 50 : 25;
  const ticks: number[] = [];
  for (let v = 0; v <= max; v += step) ticks.push(v);
  return ticks;
}

function makePath(points: Point[], xs: (t: number) => number, ys: (p: number) => number) {
  if (!points.length) return "";
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${xs(p.t).toFixed(2)} ${ys(p.p).toFixed(2)}`).join(" ");
}

function makeEnvelope(points: Point[], xs: (t: number) => number, ys: (p: number) => number): string {
  if (!points.length) return "";
  if (points.some((p) => p.lo == null || p.hi == null)) return "";
  const top = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xs(p.t).toFixed(2)} ${ys(p.hi as number).toFixed(2)}`);
  const bot = points.slice().reverse().map((p) => `L ${xs(p.t).toFixed(2)} ${ys(p.lo as number).toFixed(2)}`);
  return [...top, ...bot, "Z"].join(" ");
}

function interp(points: Point[], t: number): number | null {
  if (!points.length) return null;
  if (t <= points[0].t) return points[0].p;
  if (t >= points[points.length - 1].t) return points[points.length - 1].p;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    if (t <= b.t) {
      const r = (t - a.t) / (b.t - a.t);
      return a.p + r * (b.p - a.p);
    }
  }
  return null;
}

export function BatchPlot({
  golden,
  noisy,
  noisyVisibleCount,
  predictions,
  selectedScenario,
  showNowLine,
  nowLineAt,
  anomaly,
  anomalyT,
  unit = "g/L",
}: {
  golden: Point[];
  noisy: Point[];
  noisyVisibleCount: number;
  predictions: { id: string; label: string; color: string; dash?: string; points: Point[]; recommended?: boolean }[];
  selectedScenario: string | null;
  showNowLine: boolean;
  nowLineAt: number;
  anomaly: boolean;
  anomalyT?: number | null;
  unit?: string;
}) {
  const visibleNoisy = useMemo(() => noisy.slice(0, noisyVisibleCount), [noisy, noisyVisibleCount]);
  const lastNoisy = visibleNoisy[visibleNoisy.length - 1];

  // Dynamic domain — derived from all data in view
  const xMax = useMemo(() => {
    const allT = [
      ...golden.map((p) => p.t),
      ...noisy.map((p) => p.t),
      ...predictions.flatMap((pr) => pr.points.map((p) => p.t)),
    ];
    return niceMax(Math.max(1, ...allT));
  }, [golden, noisy, predictions]);

  const yMax = useMemo(() => {
    const allP = [
      ...golden.flatMap((p) => [p.p, p.hi ?? p.p]),
      ...noisy.map((p) => p.p),
      ...predictions.flatMap((pr) => pr.points.flatMap((p) => [p.p, p.hi ?? p.p])),
    ].filter(Number.isFinite);
    return niceMax(Math.max(1, ...allP) * 1.05);
  }, [golden, noisy, predictions]);

  const xScale = (t: number) => PAD.l + (t / xMax) * (W - PAD.l - PAD.r);
  const yScale = (v: number) => H - PAD.b - (v / yMax) * (H - PAD.t - PAD.b);
  const xInv   = (px: number) => ((px - PAD.l) / (W - PAD.l - PAD.r)) * xMax;

  const xTicks = useMemo(() => niceTicks(xMax), [xMax]);
  const yTicks = useMemo(() => niceTicks(yMax), [yMax]);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverT, setHoverT] = useState<number | null>(null);

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const xPx = ((e.clientX - rect.left) / rect.width) * W;
    if (xPx < PAD.l || xPx > W - PAD.r) { setHoverT(null); return; }
    setHoverT(Math.max(0, Math.min(xMax, xInv(xPx))));
  };

  const hoverData = useMemo(() => {
    if (hoverT == null) return null;
    const goldenAt = interp(golden, hoverT);
    const measuredAt = hoverT <= (visibleNoisy[visibleNoisy.length - 1]?.t ?? -1) ? interp(visibleNoisy, hoverT) : null;
    const predVals = predictions
      .filter((pr) => {
        const isSelected = selectedScenario === pr.id;
        const compare = selectedScenario === null;
        return (isSelected || compare) && pr.points.length > 0 && hoverT >= pr.points[0].t;
      })
      .map((pr) => ({ id: pr.id, color: pr.color, value: interp(pr.points, hoverT) }));
    return { goldenAt, measuredAt, predVals };
  }, [hoverT, golden, visibleNoisy, predictions, selectedScenario]);

  const hoverX = hoverT != null ? xScale(hoverT) : null;

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
        {/* Grid */}
        {yTicks.map((y) => (
          <line key={`gy-${y}`} x1={PAD.l} x2={W - PAD.r} y1={yScale(y)} y2={yScale(y)} stroke="#E7E5E0" strokeDasharray={y === 0 ? "0" : "2 4"} />
        ))}
        {xTicks.map((x) => (
          <line key={`gx-${x}`} x1={xScale(x)} x2={xScale(x)} y1={PAD.t} y2={H - PAD.b} stroke="#E7E5E0" strokeDasharray="2 4" opacity={x === 0 ? 0 : 0.6} />
        ))}
        {yTicks.map((y) => (
          <text key={`ty-${y}`} x={PAD.l - 10} y={yScale(y) + 3} textAnchor="end" fontSize={10} fill="#6B7280">{y}</text>
        ))}
        {xTicks.map((x) => (
          <text key={`tx-${x}`} x={xScale(x)} y={H - PAD.b + 16} textAnchor="middle" fontSize={10} fill="#6B7280">{x}h</text>
        ))}
        <text x={PAD.l - 32} y={PAD.t + 2} fontSize={10} fill="#6B7280" textAnchor="start">{unit}</text>

        {/* Golden envelope */}
        {golden.length > 0 && makeEnvelope(golden, xScale, yScale) && (
          <motion.path
            d={makeEnvelope(golden, xScale, yScale)}
            fill="#4E8B73" fillOpacity={0.1} stroke="none"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
          />
        )}

        {/* Prediction envelopes — clip-revealed in sync with line */}
        {predictions.map((pr) => {
          const isSelected = selectedScenario === pr.id;
          const compare = selectedScenario === null;
          if (selectedScenario !== null && !isSelected) return null;
          const env = makeEnvelope(pr.points, xScale, yScale);
          if (!env) return null;
          const fillOpacity = isSelected ? 0.18 : compare ? 0.09 : 0;
          const duration = isSelected ? 3.8 : 2.4;
          const clipId = `clip-env-${pr.id.replace(".", "_")}`;
          const startX = pr.points.length ? xScale(pr.points[0].t) : PAD.l;
          const endX   = pr.points.length ? xScale(pr.points[pr.points.length - 1].t) : W - PAD.r;
          return (
            <g key={`env-${pr.id}`}>
              <defs>
                <clipPath id={clipId}>
                  <motion.rect x={startX} y={PAD.t - 10} height={H - PAD.t + 10}
                    initial={{ width: 0 }} animate={{ width: endX - startX }}
                    transition={{ duration, ease: "linear" }} />
                </clipPath>
              </defs>
              <path d={env} fill={pr.color} fillOpacity={fillOpacity} stroke="none" clipPath={`url(#${clipId})`} />
            </g>
          );
        })}

        {/* Golden batch line */}
        {golden.length > 0 && (
          <motion.path d={makePath(golden, xScale, yScale)} fill="none" stroke="#4E8B73" strokeWidth={2.2} opacity={0.9}
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 1.6, ease: [0.23, 1, 0.32, 1] }} />
        )}

        {/* Prediction lines */}
        {predictions.map((pr) => {
          const isSelected = selectedScenario === pr.id;
          const compare = selectedScenario === null;
          if (selectedScenario !== null && !isSelected) return null;
          const opacity = isSelected ? 1 : compare ? 0.9 : 0;
          return (
            <motion.path key={pr.id} d={makePath(pr.points, xScale, yScale)}
              fill="none" stroke={pr.color} strokeWidth={isSelected ? 2.8 : 2} strokeLinecap="round"
              style={{ opacity }}
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
              transition={{ duration: isSelected ? 3.8 : 2.4, ease: "linear" }} />
          );
        })}

        {/* Endpoint labels in compare view */}
        {selectedScenario === null && (() => {
          const endpoints = predictions
            .map((pr) => {
              const last = pr.points[pr.points.length - 1];
              if (!last) return null;
              return { pr, x: xScale(last.t), ey: yScale(last.p) };
            })
            .filter((x): x is NonNullable<typeof x> => x != null)
            .sort((a, b) => a.ey - b.ey);

          if (!endpoints.length) return null;

          const LABEL_W = 34;
          const LABEL_H = 16;
          const MIN_GAP = LABEL_H + 3;
          const TOP = PAD.t + LABEL_H / 2 + 2;
          const BOTTOM = H - PAD.b - LABEL_H / 2 - 2;
          const n = endpoints.length;

          // Initial placement: anchor each label at its endpoint's y, clamped to chart bounds.
          const ly: number[] = endpoints.map((e) => Math.max(TOP, Math.min(BOTTOM, e.ey)));

          // Forward pass: enforce min-gap going down.
          for (let i = 1; i < n; i++) {
            if (ly[i] < ly[i - 1] + MIN_GAP) ly[i] = ly[i - 1] + MIN_GAP;
          }
          // If the column overflows the bottom, shift the whole block up, then re-resolve.
          if (ly[n - 1] > BOTTOM) {
            const shift = ly[n - 1] - BOTTOM;
            for (let i = 0; i < n; i++) ly[i] -= shift;
            for (let i = 1; i < n; i++) {
              if (ly[i] < ly[i - 1] + MIN_GAP) ly[i] = ly[i - 1] + MIN_GAP;
            }
          }
          // Final clamp to top.
          if (ly[0] < TOP) {
            const shift = TOP - ly[0];
            for (let i = 0; i < n; i++) ly[i] += shift;
            for (let i = 1; i < n; i++) {
              if (ly[i] < ly[i - 1] + MIN_GAP) ly[i] = ly[i - 1] + MIN_GAP;
            }
          }

          // Place the label column tightly to the left of the rightmost endpoint.
          const rightmost = Math.max(...endpoints.map((e) => e.x));
          const LEADER_GAP = 10;
          const labelRightX = Math.max(PAD.l + LABEL_W + 8, rightmost - LEADER_GAP - 40);

          return endpoints.map(({ pr, ey, x }, i) => (
            <motion.g key={`lbl-${pr.id}`}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ duration: 0.35, delay: 2.4, ease: [0.23, 1, 0.32, 1] }}>
              <circle cx={x} cy={ey} r={3.5} fill={pr.color} />
              <line x1={x - 3} y1={ey} x2={labelRightX} y2={ly[i]} stroke={pr.color} strokeWidth={1.2} opacity={0.55} />
              <rect x={labelRightX - LABEL_W} y={ly[i] - LABEL_H / 2} width={LABEL_W} height={LABEL_H} rx={8}
                fill="#FBFAF7" stroke={pr.color} strokeOpacity={0.5} />
              <text x={labelRightX - LABEL_W / 2} y={ly[i] + 3.5} fontSize={10.5} fill={pr.color}
                fontFamily="Inter, sans-serif" fontWeight={600} textAnchor="middle">
                {pr.id}×
              </text>
            </motion.g>
          ));
        })()}

        {/* Noisy dots */}
        {visibleNoisy.map((p, i) => (
          <motion.circle key={`n-${i}`} cx={xScale(p.t)} cy={yScale(p.p)} r={3} fill="#3A3D42"
            initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 0.85, scale: 1 }}
            transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }} />
        ))}
        {visibleNoisy.length > 1 && (
          <path d={makePath(visibleNoisy, xScale, yScale)} fill="none" stroke="#3A3D42" strokeWidth={1.2} opacity={0.35} />
        )}

        {/* Anomaly glow */}
        {anomaly && lastNoisy && (
          <g>
            <motion.circle cx={xScale(lastNoisy.t)} cy={yScale(lastNoisy.p)} r={10} fill="#C8863A" opacity={0.18}
              animate={{ r: [10, 18, 10], opacity: [0.18, 0.06, 0.18] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} />
            <circle cx={xScale(lastNoisy.t)} cy={yScale(lastNoisy.p)} r={4} fill="#C8863A" />
            {anomalyT != null && (
              <>
                <line x1={xScale(anomalyT)} x2={xScale(anomalyT)} y1={PAD.t} y2={H - PAD.b}
                  stroke="#C8863A" strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />
                <text x={xScale(anomalyT) + 6} y={PAD.t + 12} fontSize={10} fill="#C8863A"
                  fontFamily="Inter, sans-serif" fontWeight={500}>
                  anomaly · t={anomalyT}h
                </text>
              </>
            )}
          </g>
        )}

        {showNowLine && !anomaly && (
          <line x1={xScale(nowLineAt)} x2={xScale(nowLineAt)} y1={PAD.t} y2={H - PAD.b} stroke="#3A3D42" strokeDasharray="2 4" opacity={0.3} />
        )}

        {/* Hover crosshair */}
        {hoverX != null && hoverData && (
          <g pointerEvents="none">
            <line x1={hoverX} x2={hoverX} y1={PAD.t} y2={H - PAD.b} stroke="#1C1E22" strokeWidth={1} opacity={0.25} />
            {hoverData.goldenAt != null && <circle cx={hoverX} cy={yScale(hoverData.goldenAt)} r={3.5} fill="#FBFAF7" stroke="#4E8B73" strokeWidth={1.6} />}
            {hoverData.measuredAt != null && <circle cx={hoverX} cy={yScale(hoverData.measuredAt)} r={3.5} fill="#FBFAF7" stroke="#1C1E22" strokeWidth={1.6} />}
            {hoverData.predVals.map((v) =>
              v.value == null ? null : <circle key={`h-${v.id}`} cx={hoverX} cy={yScale(v.value)} r={3.5} fill="#FBFAF7" stroke={v.color} strokeWidth={1.6} />
            )}
          </g>
        )}
      </svg>

      {/* HTML tooltip */}
      {hoverT != null && hoverX != null && hoverData && (
        <div className="pointer-events-none absolute top-2 rounded-xl bg-canvas-raised/95 backdrop-blur-sm border border-hairline shadow-[0_4px_18px_rgba(28,30,34,0.08)] px-3 py-2 text-[11.5px] tabular"
          style={{
            left: `calc(${(hoverX / W) * 100}% + 10px)`,
            transform: hoverX > W * 0.7 ? "translateX(calc(-100% - 22px))" : undefined,
          }}>
          <div className="text-muted text-[10.5px] uppercase tracking-wide mb-1">t = {hoverT.toFixed(1)} h</div>
          <div className="space-y-1">
            {hoverData.goldenAt != null && <TooltipRow color="#4E8B73" label="Golden" value={hoverData.goldenAt} unit={unit} />}
            {hoverData.measuredAt != null && <TooltipRow color="#1C1E22" label="Measured" value={hoverData.measuredAt} unit={unit} />}
            {hoverData.predVals.map((v) =>
              v.value == null ? null : <TooltipRow key={v.id} color={v.color} label={`Feed ${v.id}×`} value={v.value} unit={unit} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TooltipRow({ color, label, value, unit }: { color: string; label: string; value: number; unit: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="inline-flex items-center gap-1.5 text-ink-soft">
        <span className="w-2 h-2 rounded-full" style={{ background: color }} />
        {label}
      </span>
      <span className="text-ink">{value.toFixed(2)} <span className="text-muted-soft">{unit}</span></span>
    </div>
  );
}
