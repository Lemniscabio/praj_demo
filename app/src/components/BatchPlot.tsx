import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";

export type Point = { t: number; p: number; lo?: number; hi?: number };

const PAD = { l: 44, r: 20, t: 20, b: 32 };
const W = 760;
const H = 380;
const X_MAX = 50;
const Y_MAX = 85;

const xScale = (t: number) => PAD.l + (t / X_MAX) * (W - PAD.l - PAD.r);
const yScale = (p: number) => H - PAD.b - (p / Y_MAX) * (H - PAD.t - PAD.b);

const xInv = (px: number) => ((px - PAD.l) / (W - PAD.l - PAD.r)) * X_MAX;

function path(points: Point[]) {
  if (!points.length) return "";
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(p.t).toFixed(2)} ${yScale(p.p).toFixed(2)}`).join(" ");
}

/** Build a filled polygon between lower and upper bounds; returns "" if any point is missing bounds. */
function envelopePath(points: Point[]): string {
  if (!points.length) return "";
  if (points.some((p) => p.lo == null || p.hi == null)) return "";
  const top = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(p.t).toFixed(2)} ${yScale(p.hi as number).toFixed(2)}`);
  const bottom = points
    .slice()
    .reverse()
    .map((p) => `L ${xScale(p.t).toFixed(2)} ${yScale(p.lo as number).toFixed(2)}`);
  return [...top, ...bottom, "Z"].join(" ");
}

// Linear interpolation: value at time t given a sorted series
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
}: {
  golden: Point[];
  noisy: Point[];
  noisyVisibleCount: number;
  predictions: { id: string; label: string; color: string; dash?: string; points: Point[]; recommended?: boolean }[];
  selectedScenario: string | null;
  showNowLine: boolean;
  nowLineAt: number;
  anomaly: boolean;
}) {
  const xTicks = [0, 10, 20, 30, 40, 50];
  const yTicks = [0, 20, 40, 60, 80];

  const visibleNoisy = useMemo(() => noisy.slice(0, noisyVisibleCount), [noisy, noisyVisibleCount]);
  const lastNoisy = visibleNoisy[visibleNoisy.length - 1];

  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverT, setHoverT] = useState<number | null>(null);

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const xPx = ((e.clientX - rect.left) / rect.width) * W;
    if (xPx < PAD.l || xPx > W - PAD.r) { setHoverT(null); return; }
    const t = Math.max(0, Math.min(X_MAX, xInv(xPx)));
    setHoverT(t);
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

  // Tooltip x/y in SVG coords for positioning an HTML overlay (via percentages)
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
        <text x={PAD.l - 32} y={PAD.t + 2} fontSize={10} fill="#6B7280" textAnchor="start">g/L</text>

        {/* Golden envelope (behind everything) */}
        {golden.length > 0 && envelopePath(golden) && (
          <motion.path
            d={envelopePath(golden)}
            fill="#4E8B73"
            fillOpacity={0.1}
            stroke="none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
          />
        )}

        {/* Prediction envelopes — clip-revealed in sync with line draw */}
        {predictions.map((pr) => {
          const isSelected = selectedScenario === pr.id;
          const compare = selectedScenario === null;
          if (selectedScenario !== null && !isSelected) return null;
          const env = envelopePath(pr.points);
          if (!env) return null;
          const fillOpacity = isSelected ? 0.18 : compare ? 0.09 : 0;
          const duration = isSelected ? 3.8 : 2.4;
          const clipId = `clip-env-${pr.id.replace(".", "_")}`;
          const startX = pr.points.length ? xScale(pr.points[0].t) : PAD.l;
          const endX = pr.points.length ? xScale(pr.points[pr.points.length - 1].t) : W - PAD.r;
          return (
            <g key={`env-${pr.id}`}>
              <defs>
                <clipPath id={clipId}>
                  <motion.rect
                    x={startX} y={PAD.t - 10}
                    height={H - PAD.t + 10}
                    initial={{ width: 0 }}
                    animate={{ width: endX - startX }}
                    transition={{ duration, ease: "linear" }}
                  />
                </clipPath>
              </defs>
              <path
                d={env}
                fill={pr.color}
                fillOpacity={fillOpacity}
                stroke="none"
                clipPath={`url(#${clipId})`}
              />
            </g>
          );
        })}

        {/* Golden batch */}
        {golden.length > 0 && (
          <motion.path
            d={path(golden)}
            fill="none"
            stroke="#4E8B73"
            strokeWidth={2.2}
            opacity={0.9}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.6, ease: [0.23, 1, 0.32, 1] }}
          />
        )}

        {/* Predictions */}
        {predictions.map((pr) => {
          const isSelected = selectedScenario === pr.id;
          const compare = selectedScenario === null;
          if (selectedScenario !== null && !isSelected) return null; // hide non-selected
          const opacity = isSelected ? 1 : compare ? 0.9 : 0;
          return (
            <motion.path
              key={pr.id}
              d={path(pr.points)}
              fill="none"
              stroke={pr.color}
              strokeWidth={isSelected ? 2.8 : 2}
              strokeLinecap="round"
              style={{ opacity }}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: isSelected ? 3.8 : 2.4, ease: "linear" }}
            />
          );
        })}

        {/* Endpoint labels in compare view — staggered to avoid overlap */}
        {selectedScenario === null && (() => {
          const MIN_GAP = 20;
          const CLEARANCE = 20; // distance from outermost curve before stacking labels
          const endpoints = predictions
            .map((pr) => {
              const last = pr.points[pr.points.length - 1];
              if (!last) return null;
              return { pr, x: xScale(last.t), ey: yScale(last.p) };
            })
            .filter((x): x is NonNullable<typeof x> => x != null)
            .sort((a, b) => a.ey - b.ey); // ascending y = top of plot first

          // Split: top half goes ABOVE the topmost curve, bottom half goes BELOW the bottommost.
          const mid = Math.ceil(endpoints.length / 2);
          const topHalf = endpoints.slice(0, mid);       // higher on screen (smaller ey)
          const bottomHalf = endpoints.slice(mid);        // lower on screen (larger ey)

          const topRef = endpoints[0].ey - CLEARANCE;
          const bottomRef = endpoints[endpoints.length - 1].ey + CLEARANCE;

          const labels: { pr: (typeof endpoints)[number]["pr"]; x: number; ey: number; ly: number }[] = [];
          // Top half: index 0 (highest curve) gets topmost label, stacking upward as index grows
          // Actually: we want the nearest label to each curve — so topHalf[last] sits at topRef,
          // and earlier indexes stack further up.
          topHalf.forEach((e, i) => {
            const distanceFromRef = (topHalf.length - 1 - i) * MIN_GAP;
            labels.push({ ...e, ly: topRef - distanceFromRef });
          });
          // Bottom half: index 0 (closest to mid) sits at bottomRef, later indexes stack further down
          bottomHalf.forEach((e, i) => {
            labels.push({ ...e, ly: bottomRef + i * MIN_GAP });
          });

          const LEADER_LEN = 64; // how far to push labels left of the endpoint
          const LABEL_W = 32;
          return labels.map(({ pr, ey, ly, x }) => {
            const labelRightX = x - LEADER_LEN;
            return (
              <motion.g
                key={`lbl-${pr.id}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.35, delay: 2.4, ease: [0.23, 1, 0.32, 1] }}
              >
                <circle cx={x} cy={ey} r={3.5} fill={pr.color} />
                {/* Leader from endpoint to label */}
                <line
                  x1={x - 3}
                  y1={ey}
                  x2={labelRightX}
                  y2={ly}
                  stroke={pr.color}
                  strokeWidth={1.2}
                  opacity={0.6}
                />
                <rect
                  x={labelRightX - LABEL_W}
                  y={ly - 8}
                  width={LABEL_W}
                  height={16}
                  rx={8}
                  fill="#FBFAF7"
                  stroke={pr.color}
                  strokeOpacity={0.45}
                />
                <text
                  x={labelRightX - LABEL_W / 2}
                  y={ly + 3.5}
                  fontSize={10.5}
                  fill={pr.color}
                  fontFamily="Inter, sans-serif"
                  fontWeight={600}
                  textAnchor="middle"
                >
                  {pr.id}×
                </text>
              </motion.g>
            );
          });
        })()}

        {/* Noisy dots */}
        {visibleNoisy.map((p, i) => (
          <motion.circle
            key={`n-${i}`}
            cx={xScale(p.t)}
            cy={yScale(p.p)}
            r={3}
            fill="#3A3D42"
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 0.85, scale: 1 }}
            transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
          />
        ))}
        {visibleNoisy.length > 1 && (
          <path d={path(visibleNoisy)} fill="none" stroke="#3A3D42" strokeWidth={1.2} opacity={0.35} />
        )}

        {/* Anomaly glow */}
        {anomaly && lastNoisy && (
          <g>
            <motion.circle
              cx={xScale(lastNoisy.t)}
              cy={yScale(lastNoisy.p)}
              r={10}
              fill="#C8863A"
              opacity={0.18}
              animate={{ r: [10, 18, 10], opacity: [0.18, 0.06, 0.18] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
            <circle cx={xScale(lastNoisy.t)} cy={yScale(lastNoisy.p)} r={4} fill="#C8863A" />
            <line x1={xScale(15)} x2={xScale(15)} y1={PAD.t} y2={H - PAD.b} stroke="#C8863A" strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />
            <text x={xScale(15) + 6} y={PAD.t + 12} fontSize={10} fill="#C8863A" fontFamily="Inter, sans-serif" fontWeight={500}>
              anomaly · t=15h
            </text>
          </g>
        )}

        {showNowLine && !anomaly && (
          <line x1={xScale(nowLineAt)} x2={xScale(nowLineAt)} y1={PAD.t} y2={H - PAD.b} stroke="#3A3D42" strokeDasharray="2 4" opacity={0.3} />
        )}

        {/* Hover tracker */}
        {hoverX != null && hoverData && (
          <g pointerEvents="none">
            <line x1={hoverX} x2={hoverX} y1={PAD.t} y2={H - PAD.b} stroke="#1C1E22" strokeWidth={1} opacity={0.25} />
            {hoverData.goldenAt != null && (
              <circle cx={hoverX} cy={yScale(hoverData.goldenAt)} r={3.5} fill="#FBFAF7" stroke="#4E8B73" strokeWidth={1.6} />
            )}
            {hoverData.measuredAt != null && (
              <circle cx={hoverX} cy={yScale(hoverData.measuredAt)} r={3.5} fill="#FBFAF7" stroke="#1C1E22" strokeWidth={1.6} />
            )}
            {hoverData.predVals.map((v) =>
              v.value == null ? null : (
                <circle key={`h-${v.id}`} cx={hoverX} cy={yScale(v.value)} r={3.5} fill="#FBFAF7" stroke={v.color} strokeWidth={1.6} />
              )
            )}
          </g>
        )}
      </svg>

      {/* HTML tooltip */}
      {hoverT != null && hoverX != null && hoverData && (
        <div
          className="pointer-events-none absolute top-2 rounded-xl bg-canvas-raised/95 backdrop-blur-sm border border-hairline shadow-[0_4px_18px_rgba(28,30,34,0.08)] px-3 py-2 text-[11.5px] tabular"
          style={{
            left: `calc(${(hoverX / W) * 100}% + 10px)`,
            transform: hoverX > W * 0.7 ? `translateX(calc(-100% - 22px))` : undefined,
          }}
        >
          <div className="text-muted text-[10.5px] uppercase tracking-wide mb-1">t = {hoverT.toFixed(1)} h</div>
          <div className="space-y-1">
            {hoverData.goldenAt != null && (
              <Row color="#4E8B73" label="Golden" value={hoverData.goldenAt} />
            )}
            {hoverData.measuredAt != null && (
              <Row color="#1C1E22" label="Measured" value={hoverData.measuredAt} />
            )}
            {hoverData.predVals.map((v) =>
              v.value == null ? null : (
                <Row key={v.id} color={v.color} label={`Feed ${v.id}×`} value={v.value} />
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="inline-flex items-center gap-1.5 text-ink-soft">
        <span className="w-2 h-2 rounded-full" style={{ background: color }} />
        {label}
      </span>
      <span className="text-ink">{value.toFixed(2)} <span className="text-muted-soft">g/L</span></span>
    </div>
  );
}
