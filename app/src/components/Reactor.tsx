import { useEffect, useId, useState } from "react";
import { motion } from "framer-motion";

type Props = {
  scaleL: number; // reactor working volume in litres — label only
  D: number;      // dilution rate, h⁻¹ — displayed
  GF: number;     // glucose fraction 0..1 — tints feed color
  F: number;      // feed flowrate L/h — displayed
  compact?: boolean; // drop side/inline labels for the fleet strip
  showReadout?: boolean; // show the D · GF · F readout under the SVG (default true)
  /**
   * Scale tier, 0..3. Controls the number of impellers, baffle presence,
   * port count, and vessel body height — mapping to lab → industrial.
   * If omitted, derived from scaleL.
   */
  tier?: 0 | 1 | 2 | 3;
};

function tierFromScale(scaleL: number): 0 | 1 | 2 | 3 {
  if (scaleL <= 100) return 0;        // lab
  if (scaleL <= 5_000) return 1;      // pilot
  if (scaleL <= 50_000) return 2;     // plant
  return 3;                           // industrial
}

/**
 * Schematic bioreactor. Not drawn to real proportions across scales —
 * the scale badge carries the real dimension; vessel body height, impeller
 * count, baffles and ports shift with `tier` to read as lab → industrial.
 */
export function Reactor({ scaleL, D, GF, F, compact = false, showReadout = true, tier }: Props) {
  const uid = useId().replace(/:/g, "");
  const steelId = `rx-steel-${uid}`;
  const clipId = `rx-clip-${uid}`;
  const feedClipId = `rx-feed-${uid}`;

  // Resolve tier
  const t = tier ?? tierFromScale(scaleL);
  const impellerCount: 1 | 2 | 3 = t === 0 ? 1 : t === 3 ? 3 : 2;
  const baffleCount = t >= 2 ? (t === 3 ? 4 : 2) : 0;
  const portCount = Math.max(2, 2 + Math.max(0, t - 1));  // 2, 2, 3, 4
  // Body height grows with tier: shorter at lab, tallest at industrial.
  const bodyHeight = 200 + t * 24;             // 200 / 224 / 248 / 272
  const bodyWidth = 200 - t * 4;               // 200 / 196 / 192 / 188 (slight slimming)

  // Canvas
  const W = 280;
  const H = 120 + bodyHeight + 60;             // top margin + body + outlet margin

  // Layout
  const capH = 14;
  const motorH = 20;
  const feedInletY = motorH + capH + 8;
  const bodyTop = motorH + capH + 26;
  const bodyInset = (W - bodyWidth) / 2;
  const bodyLeft = bodyInset;
  const bodyRight = W - bodyInset;
  const cornerR = 10;
  const bottomR = bodyWidth / 2;
  const bodyBottom = bodyTop + bodyHeight;
  const straightBottom = bodyBottom - bottomR;
  const shaftX = W / 2;

  const vesselPath = [
    `M ${bodyLeft} ${bodyTop + cornerR}`,
    `Q ${bodyLeft} ${bodyTop} ${bodyLeft + cornerR} ${bodyTop}`,
    `L ${bodyRight - cornerR} ${bodyTop}`,
    `Q ${bodyRight} ${bodyTop} ${bodyRight} ${bodyTop + cornerR}`,
    `L ${bodyRight} ${straightBottom}`,
    `Q ${bodyRight} ${bodyBottom} ${(bodyLeft + bodyRight) / 2} ${bodyBottom}`,
    `Q ${bodyLeft} ${bodyBottom} ${bodyLeft} ${straightBottom}`,
    `Z`,
  ].join(" ");

  const liquidTop = bodyTop + (bodyBottom - bodyTop) * 0.28; // ~72% full
  const bladeW = Math.min((bodyRight - bodyLeft) * 0.46, W * 0.42);
  // Evenly space the impellers along the liquid column, with margins so the
  // top one sits below the liquid surface and the bottom above the sparger.
  const impellerTopY = liquidTop + (bodyBottom - liquidTop) * 0.3;
  const impellerBotY = liquidTop + (bodyBottom - liquidTop) * 0.78;
  const impellerYs: number[] =
    impellerCount === 1
      ? [liquidTop + (bodyBottom - liquidTop) * 0.55]
      : impellerCount === 2
        ? [impellerTopY, impellerBotY]
        : [
            impellerTopY,
            (impellerTopY + impellerBotY) / 2,
            impellerBotY,
          ];
  const sparY = bodyBottom - 14;

  // Feed color: interpolate from amber (maltose-heavy, GF=0) → pale green (glucose-heavy, GF=1).
  const feedColor = gfToColor(GF);

  // Rotation period: slower for bigger vessels, purely visual (not real RPM).
  const rotationPeriod = Math.min(22, 6 + Math.log10(Math.max(1, scaleL)) * 3.6);

  // Drop cadence increases with D (more dilution = faster feed).
  // Clamp so it stays visually readable (0.8s → 2.2s per drop).
  const dropPeriod = Math.max(0.8, Math.min(2.2, 1.1 / Math.max(D, 0.002)));

  return (
    <div className="relative w-full flex flex-col items-center">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W }}>
        <defs>
          <linearGradient id={steelId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#FBFAF7" />
            <stop offset="50%" stopColor="#E7E5E0" />
            <stop offset="100%" stopColor="#CDC9BF" />
          </linearGradient>
          <clipPath id={clipId}>
            <path d={vesselPath} />
          </clipPath>
          <clipPath id={feedClipId}>
            <rect x={shaftX - 4} y={feedInletY} width={8} height={bodyTop - feedInletY + 2} />
          </clipPath>
        </defs>

        {/* ── Feed inlet pipe (above vessel) ───────────────────────────── */}
        <g>
          {/* Pipe wall */}
          <rect x={shaftX - 5} y={feedInletY - 20} width={10} height={bodyTop - feedInletY + 22}
            fill="#D8D5CE" stroke="#9AA0A6" strokeWidth={0.8} rx={1} />
          {/* Feed label — only in the full (non-compact) view */}
          {!compact && (
            <>
              <text x={shaftX + 14} y={feedInletY - 8} fontSize={10} fill="#3A3D42"
                fontFamily="Inter, sans-serif" fontWeight={500}>
                feed
              </text>
              <text x={shaftX + 14} y={feedInletY + 4} fontSize={9.5} fill="#6B7280"
                fontFamily="JetBrains Mono, monospace">
                F = {F.toFixed(2)} L/h
              </text>
            </>
          )}

          {/* Drops travelling inside pipe */}
          <g clipPath={`url(#${feedClipId})`}>
            {[0, 1, 2].map((i) => (
              <motion.rect
                key={i}
                x={shaftX - 2} width={4} height={6} rx={1.5}
                fill={feedColor}
                initial={{ y: feedInletY - 14 }}
                animate={{ y: [feedInletY - 14, bodyTop + 2] }}
                transition={{
                  duration: dropPeriod,
                  delay: (i * dropPeriod) / 3,
                  repeat: Infinity,
                  ease: "easeIn",
                }}
              />
            ))}
          </g>
        </g>

        {/* ── Motor & top cap ──────────────────────────────────────────── */}
        <rect x={shaftX - 26} y={0} width={52} height={motorH} rx={3} fill="#2A2C30" />
        <rect x={shaftX - 3} y={0} width={6} height={motorH} fill="#1C1E22" />
        <rect x={bodyLeft - 4} y={bodyTop - 10} width={bodyRight - bodyLeft + 8} height={10} rx={2}
          fill="#D8D5CE" stroke="#9AA0A6" strokeWidth={0.8} />

        {/* ── Vessel body ──────────────────────────────────────────────── */}
        <path d={vesselPath} fill={`url(#${steelId})`} stroke="#9AA0A6" strokeWidth={1} />

        {/* Vessel internals (clipped) */}
        <g clipPath={`url(#${clipId})`}>
          {/* Liquid fill with smooth color tween from GF */}
          <motion.rect
            x={0}
            width={W}
            initial={false}
            animate={{ fill: liquidWash(GF) }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            y={liquidTop}
            height={bodyBottom - liquidTop}
          />

          {/* Liquid surface ripple */}
          <motion.path
            fill={feedColor}
            opacity={0.22}
            initial={false}
            animate={{
              d: [
                `M 0 ${liquidTop} Q ${W / 4} ${liquidTop - 2} ${W / 2} ${liquidTop} T ${W} ${liquidTop} L ${W} ${liquidTop + 4} L 0 ${liquidTop + 4} Z`,
                `M 0 ${liquidTop} Q ${W / 4} ${liquidTop + 2} ${W / 2} ${liquidTop} T ${W} ${liquidTop} L ${W} ${liquidTop + 4} L 0 ${liquidTop + 4} Z`,
                `M 0 ${liquidTop} Q ${W / 4} ${liquidTop - 2} ${W / 2} ${liquidTop} T ${W} ${liquidTop} L ${W} ${liquidTop + 4} L 0 ${liquidTop + 4} Z`,
              ],
            }}
            transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Bubbles — rise from sparger to just under the surface */}
          {[0, 1, 2, 3].map((b) => {
            const lane = ((b - 1.5) * bladeW) / 3.2;
            const x = W / 2 + lane;
            const delay = b * 0.6;
            const size = b === 1 || b === 2 ? 2.8 : 2.1;
            return (
              <motion.circle
                key={b}
                cx={x}
                r={size}
                fill="#FBFAF7"
                stroke="#9AA0A6"
                strokeWidth={0.5}
                initial={{ cy: sparY - 2, opacity: 0 }}
                animate={{ cy: [sparY - 2, liquidTop + 4], opacity: [0, 0.85, 0] }}
                transition={{ duration: 3.2, delay, repeat: Infinity, ease: "easeOut" }}
              />
            );
          })}

          {/* Baffles (vertical strips on the inside walls — only at plant/industrial scale) */}
          {baffleCount > 0 && <Baffles
            bodyLeft={bodyLeft} bodyRight={bodyRight}
            liquidTop={liquidTop} bodyBottom={bodyBottom}
            count={baffleCount} />}

          {/* Shaft — runs from top down to just past the lowest impeller */}
          <rect
            x={shaftX - 1.8}
            y={bodyTop}
            width={3.6}
            height={impellerYs[impellerYs.length - 1] - bodyTop + 6}
            fill="#3A3D42"
          />

          {/* Impeller stack (1 / 2 / 3 discs depending on tier) */}
          {impellerYs.map((y, idx) => (
            <RushtonDisc
              key={idx}
              cx={shaftX}
              cy={y}
              bladeW={bladeW}
              period={rotationPeriod * (1 + idx * 0.1)}
            />
          ))}

          {/* Sparger + hash */}
          <rect x={W / 2 - bladeW / 3} y={sparY} width={(bladeW / 3) * 2} height={2.4} rx={1} fill="#6B7280" />
          <line
            x1={W / 2 - bladeW / 3}
            x2={W / 2 + bladeW / 3}
            y1={sparY + 3}
            y2={sparY + 3}
            stroke="#6B7280"
            strokeWidth={0.6}
            strokeDasharray="1 1.5"
            opacity={0.5}
          />
        </g>

        {/* ── Side ports (probes) ──────────────────────────────────────── */}
        <g>
          {Array.from({ length: portCount }).map((_, i) => (
            <rect
              key={i}
              x={bodyRight - 1}
              y={bodyTop + 18 + i * 18}
              width={7}
              height={3}
              fill="#6B7280"
            />
          ))}
          {!compact && (
            <>
              {["pH", "DO₂", "T", "foam"].slice(0, portCount).map((lbl, i) => (
                <text
                  key={lbl}
                  x={bodyRight + 11}
                  y={bodyTop + 22 + i * 18}
                  fontSize={8.5}
                  fill="#9AA0A6"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {lbl}
                </text>
              ))}
            </>
          )}
        </g>

        {/* ── Product outlet ───────────────────────────────────────────── */}
        <g>
          <rect x={shaftX - 4} y={bodyBottom - 2} width={8} height={18} fill="#D8D5CE" stroke="#9AA0A6" strokeWidth={0.8} rx={1} />
          {/* Accumulating product drop */}
          <motion.circle
            cx={shaftX} r={2.6}
            fill="#4E8B73" opacity={0.75}
            initial={{ cy: bodyBottom + 16, opacity: 0 }}
            animate={{ cy: [bodyBottom + 16, bodyBottom + 38], opacity: [0, 0.9, 0] }}
            transition={{ duration: 2.6, delay: 0.4, repeat: Infinity, ease: "easeIn" }}
          />
          {!compact && (
            <>
              <path d={`M ${shaftX} ${bodyBottom + 22} l 0 16 l 30 0`}
                stroke="#9AA0A6" strokeWidth={0.9} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <text x={shaftX + 36} y={bodyBottom + 40} fontSize={10} fill="#3A3D42"
                fontFamily="Inter, sans-serif" fontWeight={500}>
                product
              </text>
            </>
          )}
          {compact && (
            <path d={`M ${shaftX} ${bodyBottom + 16} l 0 10`}
              stroke="#9AA0A6" strokeWidth={0.9} fill="none" strokeLinecap="round" />
          )}
        </g>
      </svg>

      {showReadout && (
        <div className="mt-4 flex items-center justify-center gap-5 text-[11.5px] tabular">
          <span className="text-muted">
            D <span className="text-ink">{D.toFixed(4)}</span> <span className="text-muted-soft">h⁻¹</span>
          </span>
          <span className="h-3 w-px bg-hairline" />
          <span className="text-muted">
            GF <span className="text-ink">{GF.toFixed(2)}</span>
          </span>
          <span className="h-3 w-px bg-hairline" />
          <span className="text-muted">
            F <span className="text-ink">{F.toFixed(2)}</span> <span className="text-muted-soft">L/h</span>
          </span>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */

function Baffles({
  bodyLeft, bodyRight, liquidTop, bodyBottom, count,
}: { bodyLeft: number; bodyRight: number; liquidTop: number; bodyBottom: number; count: number }) {
  // Vertical full-height baffle strips hugging the inner walls. Real Rushton
  // bioreactors at plant+ scale use 4 symmetrically-placed baffles; we render
  // the ones that would be visible in this orthographic view.
  const yTop = liquidTop + 2;
  const yBot = bodyBottom - 8;
  const w = 3.5;
  const gap = 2;
  // Distribute visible baffles symmetrically near each inner wall.
  const sides = count >= 4 ? ["outL", "inL", "inR", "outR"] : ["L", "R"];
  return (
    <g>
      {sides.map((s) => {
        let x: number;
        if (s === "outL") x = bodyLeft + gap;
        else if (s === "inL") x = bodyLeft + gap + 14;
        else if (s === "inR") x = bodyRight - gap - w - 14;
        else if (s === "outR") x = bodyRight - gap - w;
        else if (s === "L") x = bodyLeft + gap;
        else x = bodyRight - gap - w;
        return (
          <rect
            key={s}
            x={x}
            y={yTop}
            width={w}
            height={yBot - yTop}
            fill="#B8B3A6"
            opacity={0.55}
          />
        );
      })}
    </g>
  );
}

function RushtonDisc({
  cx, cy, bladeW, period,
}: { cx: number; cy: number; bladeW: number; period: number }) {
  // A Rushton disc turbine is a flat disc with six flat rectangular blades
  // mounted vertically on its outer rim (perpendicular to the disc plane).
  // In a slight 3/4 view the disc reads as a flat ellipse; each blade stands
  // upright and sweeps along the ellipse perimeter as the disc turns.
  const rx = bladeW / 2;
  const tiltY = 0.34;           // how flat the ellipse reads
  const ry = rx * tiltY;
  const bladeH = 11;
  const bladeCount = 6;

  const [angle, setAngle] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = ((now - start) / 1000) % period;
      setAngle((t / period) * 360);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [period]);

  const blades = Array.from({ length: bladeCount }).map((_, i) => {
    const a = ((angle + i * (360 / bladeCount)) * Math.PI) / 180;
    const bx = cx + rx * Math.cos(a);
    const by = cy + ry * Math.sin(a);
    // sin(a) > 0 means the blade is on the front (lower half of ellipse).
    const inFront = Math.sin(a) > 0;
    return { bx, by, inFront, key: i, depth: Math.sin(a) };
  });

  // Sort by depth so back blades paint first, front blades on top.
  const ordered = blades.slice().sort((a, b) => a.depth - b.depth);

  const bladeBoxW = 8.5;
  const bladeBoxH = bladeH;

  // Short radial connector from each blade back to the hub — reads as the
  // rim/arm of the Rushton turbine without drawing a full disc.
  const connectors = blades.map((b) => {
    const dx = b.bx - cx;
    const dy = b.by - cy;
    const len = Math.hypot(dx, dy);
    // Start at the edge of the hub, end just before the blade.
    const startX = cx + (dx / len) * 2.6;
    const startY = cy + (dy / len) * 2.6;
    const endX = b.bx - (dx / len) * (bladeBoxW / 2 + 0.5);
    const endY = b.by - (dy / len) * (bladeBoxH / 2 + 0.5);
    return { startX, startY, endX, endY, behind: !b.inFront, key: b.key };
  });

  return (
    <g>
      {/* Back connectors + back blades (draw first so disc-rim ellipse
          and front pieces paint on top) */}
      {connectors
        .filter((c) => c.behind)
        .map((c) => (
          <line
            key={`bc-${c.key}`}
            x1={c.startX} y1={c.startY} x2={c.endX} y2={c.endY}
            stroke="#9AA0A6" strokeWidth={0.9} opacity={0.65}
          />
        ))}
      {ordered
        .filter((b) => !b.inFront)
        .map((b) => (
          <rect
            key={`bb-${b.key}`}
            x={b.bx - bladeBoxW / 2} y={b.by - bladeBoxH / 2}
            width={bladeBoxW} height={bladeBoxH} rx={1.6}
            fill="#FBFAF7" stroke="#9AA0A6" strokeWidth={1.1} opacity={0.75}
          />
        ))}

      {/* Disc-rim ellipse — a dashed ghost ring, suggests the disc without
          drawing a filled plate */}
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry}
        fill="none" stroke="#9AA0A6" strokeWidth={0.9}
        strokeDasharray="1.4 2" opacity={0.55} />

      {/* Hub */}
      <circle cx={cx} cy={cy} r={2.4} fill="#1C1E22" />

      {/* Front connectors + front blades */}
      {connectors
        .filter((c) => !c.behind)
        .map((c) => (
          <line
            key={`fc-${c.key}`}
            x1={c.startX} y1={c.startY} x2={c.endX} y2={c.endY}
            stroke="#1C1E22" strokeWidth={1.1}
          />
        ))}
      {ordered
        .filter((b) => b.inFront)
        .map((b) => (
          <rect
            key={`fb-${b.key}`}
            x={b.bx - bladeBoxW / 2} y={b.by - bladeBoxH / 2}
            width={bladeBoxW} height={bladeBoxH} rx={1.6}
            fill="#FBFAF7" stroke="#1C1E22" strokeWidth={1.4}
          />
        ))}
    </g>
  );
}

function gfToColor(gf: number): string {
  // Amber (#D4A15A) at GF=0 → pale green (#8FB79F) at GF=1.
  const t = Math.max(0, Math.min(1, gf));
  const r = Math.round(0xD4 + (0x8F - 0xD4) * t);
  const g = Math.round(0xA1 + (0xB7 - 0xA1) * t);
  const b = Math.round(0x5A + (0x9F - 0x5A) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

function liquidWash(gf: number): string {
  // A much paler wash of the feed color for the bulk liquid.
  const t = Math.max(0, Math.min(1, gf));
  const r = Math.round(0xF1 + (0xE8 - 0xF1) * t);
  const g = Math.round(0xE6 + (0xF0 - 0xE6) * t);
  const b = Math.round(0xCE + (0xDD - 0xCE) * t);
  return `rgb(${r}, ${g}, ${b})`;
}
