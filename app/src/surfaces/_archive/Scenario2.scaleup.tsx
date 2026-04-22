// ARCHIVED 2026-04-22 — prior Scenario 2 implementation (pilot → production scale-up
// with animated bioreactor visual). Preserved for future reference. Not wired into
// App.tsx. Superseded by the anomaly-rescue Scenario 2 built on the updated dataset
// in data_updated/ (golden_batch_trajectory.csv + suboptimal_noisy_measurements.csv
// + scenario_rnn_*x_F.csv).
import { useId, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { SectionTitle, Pill } from "../../components/ui";
import { cn } from "../../lib/cn";

/*
 * Scenario 2 — Tech transfer (scale-up).
 *
 * We're taking a validated bioprocess from a pilot reactor (the "current" scale)
 * and moving it to a production reactor (the "target" scale). Same recipe,
 * bigger vessel. The question this screen answers: what operating parameters
 * change when you scale up — and by how much?
 *
 * Geometry numbers below (diameter, impeller speed) are illustrative — they're
 * not in Gaurav's data. The feed flowrate base is taken from the Pune summary
 * mean but rounded for legibility.
 */

// Pilot (current) reference. Numbers are typical-for-a-500L-pilot values.
const PILOT = {
  volume: 500,          // L
  vesselDiameter: 0.82, // m
  impellerDiameter: 0.28, // m (Rushton, ~D/3)
  impellerRpm: 300,
  feedFlowrate: 0.5,    // L/h — scales ~linearly with volume
  aerationVvm: 0.8,     // vessel volumes per minute — kept constant as strategy baseline
};

type Strategy = "pv" | "tip" | "kla";

const STRATEGY_LABEL: Record<Strategy, string> = {
  pv: "Constant P/V",
  tip: "Constant tip speed",
  kla: "Constant kLa",
};

type Derived = {
  volume: number;
  scale: number;
  vesselDiameter: number;
  impellerDiameter: number;
  impellerRpm: number;
  tipSpeed: number;
  powerPerVolume: number;
  feedFlowrate: number;
  aerationSlpm: number;
  klaRelative: number;
};

function derive(volumeTarget: number, strategy: Strategy): Derived {
  const scale = volumeTarget / PILOT.volume; // V ratio
  const linear = Math.cbrt(scale);           // D ∝ V^(1/3) at constant geometry
  const D = PILOT.vesselDiameter * linear;
  const Di = PILOT.impellerDiameter * linear;

  // Scale-up formulas (Di is the impeller diameter; N in rps for formulas, then back to rpm).
  const N_pilot = PILOT.impellerRpm / 60;
  let N_new: number;
  switch (strategy) {
    case "pv":
      // P/V constant → N³·D² = const  →  N_new = N·(Di / Di_new)^(2/3)
      N_new = N_pilot * Math.pow(PILOT.impellerDiameter / Di, 2 / 3);
      break;
    case "tip":
      // Tip speed constant → N·D = const  →  N_new = N·(Di / Di_new)
      N_new = N_pilot * (PILOT.impellerDiameter / Di);
      break;
    case "kla":
      // kLa ∝ (P/V)^0.5 · vs^0.5. Holding vvm constant means vs grows too —
      // the correction pushes N slightly lower than P/V. Use P/V × factor.
      N_new = N_pilot * Math.pow(PILOT.impellerDiameter / Di, 2 / 3) * 0.9;
      break;
  }
  const rpm = N_new * 60;

  const tip = Math.PI * N_new * Di; // m/s
  // P/V arbitrary reference: proportional to N³·Di² — normalize to pilot = 1.
  const pilot_pv = Math.pow(N_pilot, 3) * Math.pow(PILOT.impellerDiameter, 2);
  const new_pv = Math.pow(N_new, 3) * Math.pow(Di, 2);
  const pvRel = new_pv / pilot_pv; // 1.0 = same as pilot

  return {
    volume: volumeTarget,
    scale,
    vesselDiameter: D,
    impellerDiameter: Di,
    impellerRpm: rpm,
    tipSpeed: tip,
    powerPerVolume: pvRel,
    feedFlowrate: PILOT.feedFlowrate * scale,
    aerationSlpm: (PILOT.aerationVvm * volumeTarget) / 1000, // to m³/min equivalent-ish; display as "slpm*"
    klaRelative: Math.pow(pvRel, 0.5), // illustrative
  };
}

export function Scenario2Surface() {
  const [target, setTarget] = useState(5000);
  const [strategy, setStrategy] = useState<Strategy>("pv");

  const pilotDerived = useMemo(() => derive(PILOT.volume, "pv"), []);
  const targetDerived = useMemo(() => derive(target, strategy), [target, strategy]);

  return (
    <div className="px-10 py-10 max-w-[1360px] mx-auto">
      <div className="flex items-start justify-between gap-6">
        <SectionTitle
          eyebrow="Scenario 02"
          title="Scale-up to production"
          sub="Moving a validated lactic-acid fermentation from the Pune pilot reactor to the Vapi production line. Same recipe — see how the operating parameters change with vessel size."
        />
        <Pill tone="accent">
          <span className="w-1.5 h-1.5 rounded-full bg-accent" />
          {target.toLocaleString()} L target
        </Pill>
      </div>

      {/* Two reactors */}
      <div className="mt-8 rounded-2xl bg-canvas-raised border border-hairline p-8">
        <div className="relative grid grid-cols-12 gap-6 items-end">
          <ReactorPanel
            align="left"
            tag="Current · Pilot"
            subtitle="Pune"
            volume={pilotDerived.volume}
            rpm={pilotDerived.impellerRpm}
            scale={1}
            height={260}
            tone="muted"
          />
          <div className="col-span-12 md:col-span-4 relative flex items-center justify-center pb-2">
            <Arrow scale={targetDerived.scale} />
          </div>
          <ReactorPanel
            align="right"
            tag="Target · Production"
            subtitle="Vapi"
            volume={targetDerived.volume}
            rpm={targetDerived.impellerRpm}
            scale={targetDerived.scale}
            height={260}
            tone="accent"
          />
        </div>
      </div>

      {/* Controls */}
      <div className="mt-6 grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-7 rounded-2xl bg-canvas-raised border border-hairline p-6">
          <div className="flex items-baseline justify-between mb-2">
            <div className="text-[11px] uppercase tracking-[0.12em] text-muted">Target working volume</div>
            <div className="tabular serif text-[22px] text-ink">
              {target.toLocaleString()}
              <span className="text-[13px] ml-1 text-muted-soft">L</span>
            </div>
          </div>
          <input
            type="range"
            min={1000}
            max={20000}
            step={500}
            value={target}
            onChange={(e) => setTarget(Number(e.target.value))}
            className="w-full accent-[color:var(--color-ink)]"
          />
          <div className="flex justify-between tabular text-[10.5px] text-muted-soft mt-1">
            <span>1 000 L</span>
            <span>5 000 L</span>
            <span>10 000 L</span>
            <span>15 000 L</span>
            <span>20 000 L</span>
          </div>
          <div className="mt-4 text-[11.5px] text-muted leading-relaxed">
            Linear scale factor <span className="tabular text-ink">{targetDerived.scale.toFixed(1)}×</span> ·
            vessel diameter grows by <span className="tabular text-ink">{Math.cbrt(targetDerived.scale).toFixed(2)}×</span>
            {" "}(volume ∝ diameter³).
          </div>
        </div>

        <div className="col-span-12 lg:col-span-5 rounded-2xl bg-canvas-raised border border-hairline p-6">
          <div className="text-[11px] uppercase tracking-[0.12em] text-muted mb-3">Scale-up strategy</div>
          <div className="flex flex-col gap-2">
            {(["pv", "tip", "kla"] as Strategy[]).map((s) => (
              <StrategyRow key={s} id={s} active={strategy === s} onSelect={() => setStrategy(s)} />
            ))}
          </div>
        </div>
      </div>

      {/* Parameter translation */}
      <div className="mt-6 rounded-2xl bg-canvas-raised border border-hairline overflow-hidden">
        <div className="grid grid-cols-[1.4fr_1fr_1fr_0.8fr] bg-canvas border-b border-hairline px-6 py-3 text-[10.5px] uppercase tracking-[0.12em] text-muted">
          <div>Parameter</div>
          <div className="text-right">Pilot (Pune)</div>
          <div className="text-right">Target (Vapi)</div>
          <div className="text-right">Ratio</div>
        </div>
        <ParamRow label="Working volume" unit="L" pilot={pilotDerived.volume} target={targetDerived.volume} fractionDigits={0} />
        <ParamRow label="Vessel diameter" unit="m" pilot={pilotDerived.vesselDiameter} target={targetDerived.vesselDiameter} fractionDigits={2} />
        <ParamRow label="Impeller diameter" unit="m" pilot={pilotDerived.impellerDiameter} target={targetDerived.impellerDiameter} fractionDigits={3} />
        <ParamRow label="Impeller speed" unit="rpm" pilot={pilotDerived.impellerRpm} target={targetDerived.impellerRpm} fractionDigits={0} />
        <ParamRow label="Tip speed" unit="m/s" pilot={pilotDerived.tipSpeed} target={targetDerived.tipSpeed} fractionDigits={2} />
        <ParamRow label="Power / volume" unit="(relative)" pilot={pilotDerived.powerPerVolume} target={targetDerived.powerPerVolume} fractionDigits={2} />
        <ParamRow label="kLa (relative)" unit="" pilot={pilotDerived.klaRelative} target={targetDerived.klaRelative} fractionDigits={2} />
        <ParamRow label="Feed flowrate" unit="L/h" pilot={pilotDerived.feedFlowrate} target={targetDerived.feedFlowrate} fractionDigits={1} />
      </div>

      <div className="mt-6 text-[11px] text-muted-soft leading-relaxed max-w-[80ch]">
        Vessel geometry (diameters, impeller size, pilot rpm) are illustrative reference values for a 500 L Rushton-impeller bioreactor — they are not in <span className="tabular">structured_data.xlsx</span>. The feed flowrate baseline comes from the Pune mean and scales linearly with working volume. Scale-up formulas follow standard practice: constant P/V uses N³·D² = constant; constant tip speed uses N·D = constant; constant kLa is a simplified derivation from P/V.
      </div>
    </div>
  );
}

/* ---------- Reactor visual ---------- */

function ReactorPanel({
  align,
  tag,
  subtitle,
  volume,
  rpm,
  scale,
  height,
  tone,
}: {
  align: "left" | "right";
  tag: string;
  subtitle: string;
  volume: number;
  rpm: number;
  scale: number;
  height: number;
  tone: "muted" | "accent";
}) {
  // Visual size: pilot gets a floor of 62% of card height; target grows with cube-root(scale).
  const visualLinear = Math.min(1, Math.cbrt(scale) / Math.cbrt(20000 / PILOT.volume)); // target caps at 20 000 L
  const reactorHeight = Math.max(170, Math.round(height * (scale === 1 ? 0.62 : 0.62 + visualLinear * 0.38)));
  const reactorWidth = Math.max(110, Math.round(reactorHeight * 0.65));
  const liquidColor = tone === "accent" ? "#3F7D62" : "#8FA2B5";
  const liquidWash = tone === "accent" ? "#C5DBCE" : "#D4DCE4";

  return (
    <div className={cn("col-span-12 md:col-span-4 flex flex-col gap-3", align === "right" ? "items-end" : "items-start")}>
      <Pill tone={tone === "accent" ? "accent" : "muted"}>
        <span className={cn("w-1.5 h-1.5 rounded-full", tone === "accent" ? "bg-accent" : "bg-muted-soft")} />
        {tag}
      </Pill>
      <div className="relative flex flex-col items-center">
        <Reactor width={reactorWidth} height={reactorHeight} liquidColor={liquidColor} liquidWash={liquidWash} rpm={rpm} />
        {/* Floor line */}
        <div className="absolute bottom-0 left-[-20px] right-[-20px] h-px bg-hairline-strong/50" />
      </div>
      <div className={cn("w-full flex items-baseline justify-between gap-3", align === "right" && "flex-row-reverse")}>
        <div>
          <div className="text-[10.5px] uppercase tracking-wide text-muted">{subtitle}</div>
          <div className="serif text-[24px] tabular text-ink leading-none mt-1">
            {volume.toLocaleString()}
            <span className="text-[13px] ml-1 text-muted-soft">L</span>
          </div>
        </div>
        <div className={cn(align === "right" && "text-left", align === "left" && "text-right")}>
          <div className="text-[10.5px] uppercase tracking-wide text-muted">Impeller</div>
          <div className="serif text-[16px] tabular text-ink-soft leading-none mt-1">
            {Math.round(rpm)}
            <span className="text-[11px] ml-1 text-muted-soft">rpm</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Reactor({ width, height, liquidColor, liquidWash, rpm }: { width: number; height: number; liquidColor: string; liquidWash: string; rpm: number }) {
  const uid = useId().replace(/:/g, "");
  const clipId = `r-clip-${uid}`;
  const steelId = `r-steel-${uid}`;

  const W = width;
  const H = height;
  const capH = 14;
  const motorH = 18;
  const bodyTop = motorH + capH;
  const bodyInset = 4;                          // how far the vessel is inset from svg edges
  const bodyLeft = bodyInset;
  const bodyRight = W - bodyInset;
  const cornerR = 8;
  const bottomR = (bodyRight - bodyLeft) / 2;   // hemispherical bottom
  const bodyBottom = H - 2;                     // where the vessel bottom sits
  const straightBottom = bodyBottom - bottomR;  // where the straight side meets the curve

  // One shared vessel path used for both the outline AND the clip.
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

  const liquidTop = bodyTop + (bodyBottom - bodyTop) * 0.26; // ~72% full
  const shaftX = W / 2;
  const bladeW = Math.min((bodyRight - bodyLeft) * 0.46, W * 0.42);
  const bladeY = liquidTop + (bodyBottom - liquidTop) * 0.55;
  const sparY = bodyBottom - 14;

  const rotationDuration = Math.max(0.35, 60 / (rpm * 1.2));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ display: "block" }}>
      <defs>
        <linearGradient id={steelId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#FBFAF7" />
          <stop offset="50%" stopColor="#E7E5E0" />
          <stop offset="100%" stopColor="#CDC9BF" />
        </linearGradient>
        <clipPath id={clipId}>
          <path d={vesselPath} />
        </clipPath>
      </defs>

      {/* Motor + top cap */}
      <rect x={shaftX - 14} y={0} width={28} height={motorH} rx={3} fill="#3A3D42" />
      <rect x={shaftX - 8} y={motorH} width={16} height={capH - 4} rx={1} fill="#3A3D42" />
      <rect x={bodyLeft} y={bodyTop - 6} width={bodyRight - bodyLeft} height={6} rx={2} fill="#D8D5CE" stroke="#C2BEB4" strokeWidth={0.7} />

      {/* Vessel body */}
      <path d={vesselPath} fill={`url(#${steelId})`} stroke="#9AA0A6" strokeWidth={0.9} />

      {/* Everything below is clipped to the inside of the vessel */}
      <g clipPath={`url(#${clipId})`}>
        {/* Liquid fill */}
        <motion.rect
          x={0}
          width={W}
          fill={liquidWash}
          initial={{ y: bodyBottom, height: 0 }}
          animate={{ y: liquidTop, height: bodyBottom - liquidTop }}
          transition={{ duration: 1.2, ease: [0.32, 0.72, 0, 1] }}
        />

        {/* Liquid surface ripple */}
        <motion.path
          fill={liquidColor}
          opacity={0.3}
          initial={false}
          animate={{
            d: [
              `M 0 ${liquidTop} Q ${W / 4} ${liquidTop - 2} ${W / 2} ${liquidTop} T ${W} ${liquidTop} L ${W} ${liquidTop + 4} L 0 ${liquidTop + 4} Z`,
              `M 0 ${liquidTop} Q ${W / 4} ${liquidTop + 2} ${W / 2} ${liquidTop} T ${W} ${liquidTop} L ${W} ${liquidTop + 4} L 0 ${liquidTop + 4} Z`,
              `M 0 ${liquidTop} Q ${W / 4} ${liquidTop - 2} ${W / 2} ${liquidTop} T ${W} ${liquidTop} L ${W} ${liquidTop + 4} L 0 ${liquidTop + 4} Z`,
            ],
          }}
          transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Bubbles — rise from sparger to just under the surface */}
        {[0, 1, 2].map((b) => {
          const lane = (b - 1) * (bladeW / 3.2); // -1, 0, +1 lanes
          const x = W / 2 + lane;
          const delay = b * 0.75;
          const size = b === 1 ? 2.4 : 2;
          return (
            <motion.circle
              key={b}
              cx={x}
              r={size}
              fill={liquidColor}
              initial={{ cy: sparY - 2, opacity: 0 }}
              animate={{ cy: [sparY - 2, liquidTop + 3], opacity: [0, 0.55, 0] }}
              transition={{ duration: 2.4, delay, repeat: Infinity, ease: "easeOut" }}
            />
          );
        })}

        {/* Shaft inside vessel */}
        <rect x={shaftX - 1.5} y={bodyTop} width={3} height={bladeY - bodyTop} fill="#3A3D42" />

        {/* Rotating impeller blade — translate to pivot, then rotate in local space */}
        <g transform={`translate(${shaftX} ${bladeY})`}>
          <motion.g
            animate={{ rotate: 360 }}
            transition={{ duration: rotationDuration, repeat: Infinity, ease: "linear" }}
          >
            <rect x={-bladeW / 2} y={-1.5} width={bladeW} height={3} rx={1} fill="#3A3D42" />
            <rect x={-1.5} y={-bladeW / 2} width={3} height={bladeW} rx={1} fill="#3A3D42" />
          </motion.g>
        </g>

        {/* Sparger bar + its hash */}
        <rect x={W / 2 - bladeW / 3} y={sparY} width={(bladeW / 3) * 2} height={2.2} rx={1} fill="#6B7280" />
        <line
          x1={W / 2 - bladeW / 3}
          x2={W / 2 + bladeW / 3}
          y1={sparY + 2.8}
          y2={sparY + 2.8}
          stroke="#6B7280"
          strokeWidth={0.6}
          strokeDasharray="1 1"
          opacity={0.5}
        />
      </g>

      {/* Ports on side (outside the clip — they attach to the outer wall) */}
      <rect x={bodyRight - 1} y={bodyTop + 10} width={6} height={3} fill="#6B7280" />
      <rect x={bodyRight - 1} y={bodyTop + 22} width={6} height={3} fill="#6B7280" />
    </svg>
  );
}

/* ---------- Arrow between reactors ---------- */

function Arrow({ scale }: { scale: number }) {
  return (
    <div className="w-full flex flex-col items-center gap-2 opacity-90">
      <svg viewBox="0 0 200 40" className="w-full max-w-[220px]">
        <line
          x1={8}
          y1={20}
          x2={168}
          y2={20}
          stroke="#8FA2B5"
          strokeWidth={1.5}
          strokeDasharray="3 4"
          strokeLinecap="round"
          opacity={0.75}
        />
        <path d="M 168 14 L 184 20 L 168 26 Z" fill="#8FA2B5" />
        <motion.circle
          r={4}
          cy={20}
          fill="#6B9E88"
          initial={{ cx: 10 }}
          animate={{ cx: 166 }}
          transition={{ duration: 2.6, ease: [0.45, 0, 0.55, 1], repeat: Infinity, repeatType: "loop" }}
        />
      </svg>
      <div className="text-[10.5px] uppercase tracking-[0.12em] text-muted">
        Scale up · <span className="tabular text-ink-soft">{scale.toFixed(1)}×</span>
      </div>
    </div>
  );
}

/* ---------- Strategy row ---------- */

function StrategyRow({ id, active, onSelect }: { id: Strategy; active: boolean; onSelect: () => void }) {
  const description: Record<Strategy, string> = {
    pv: "Keeps power per unit volume the same — the industry default for aerobic fermentation.",
    tip: "Keeps impeller tip speed the same — useful when shear sensitivity matters.",
    kla: "Preserves oxygen transfer — derived from P/V with a small correction for gas flow.",
  };
  return (
    <button
      onClick={onSelect}
      className={cn(
        "press w-full rounded-xl border text-left px-3.5 py-3 transition-colors flex items-start gap-3",
        active ? "bg-accent-wash border-accent-soft" : "bg-canvas border-hairline hover:border-hairline-strong"
      )}
    >
      <span className={cn("mt-0.5 w-3.5 h-3.5 rounded-full border shrink-0 grid place-items-center transition-colors",
        active ? "bg-accent border-accent" : "border-hairline-strong"
      )}>
        {active && <span className="w-1.5 h-1.5 rounded-full bg-canvas" />}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block serif text-[14px] text-ink leading-tight">{STRATEGY_LABEL[id]}</span>
        <span className="block text-[11.5px] text-muted mt-1 leading-snug">{description[id]}</span>
      </span>
    </button>
  );
}

/* ---------- Parameter table row ---------- */

function ParamRow({
  label,
  unit,
  pilot,
  target,
  fractionDigits,
}: {
  label: string;
  unit: string;
  pilot: number;
  target: number;
  fractionDigits: number;
}) {
  const ratio = pilot !== 0 ? target / pilot : 1;
  return (
    <div className="grid grid-cols-[1.4fr_1fr_1fr_0.8fr] px-6 py-3 items-center border-b border-hairline/60 last:border-0 hover:bg-canvas/60 transition-colors">
      <div className="text-[13px] text-ink">
        {label}{unit && <span className="text-muted-soft"> · {unit}</span>}
      </div>
      <div className="tabular text-[13px] text-muted text-right">
        {pilot.toLocaleString(undefined, { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })}
      </div>
      <div className="tabular text-[13px] text-ink text-right">
        <motion.span
          key={target.toFixed(fractionDigits)}
          initial={{ opacity: 0.4, y: -2 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
          className="inline-block"
        >
          {target.toLocaleString(undefined, { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })}
        </motion.span>
      </div>
      <div className="tabular text-[11.5px] text-right">
        <span
          className={cn(
            "inline-flex items-center h-5 px-2 rounded-full",
            ratio > 1.05 && "bg-accent-wash text-accent",
            ratio < 0.95 && "bg-signal-wash text-signal",
            ratio >= 0.95 && ratio <= 1.05 && "bg-canvas text-muted border border-hairline"
          )}
        >
          {ratio.toFixed(2)}×
        </span>
      </div>
    </div>
  );
}
