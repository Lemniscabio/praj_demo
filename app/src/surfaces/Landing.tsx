import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useApp } from "../lib/store";
import { loadWhatIfGrid, type WhatIfGrid } from "../lib/whatif";
import { loadCSV } from "../lib/csv";

type GoldenRow = Record<string, number | string>;
type ScenRow = Record<string, number | string>;

export function LandingSurface() {
  const setSurface = useApp((s) => s.setSurface);

  return (
    <div className="min-h-full bg-canvas text-ink">
      <TopBar />

      <div className="mx-auto max-w-[1240px] px-10 pt-24 pb-28">
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <motion.header
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
          className="flex flex-col gap-7"
        >
          <h1 className="serif text-[clamp(42px,6.2vw,78px)] leading-[1.02] text-ink tracking-[-0.01em]">
            Lactic Acid Bioprocess
            <br />
            Simulator
          </h1>

          <p className="text-[18px] text-ink-soft leading-[1.6] max-w-[64ch]">
            The lactic acid bioprocess simulator (LABS) demonstrates how we build a hybrid model from process data and use it for what-if simulations and real-time monitoring
          </p>
        </motion.header>

        {/* ── Figure 1 — Triptych ──────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.23, 1, 0.32, 1] }}
          className="mt-20"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <SubfigureFrame
              title="Model development"
              blurb="LABS turns process data into a clean dataset. It then fits hybrid models to predict biomass, titre, substrate use, and batch trajectory."
              hint="Model development"
              onOpen={() => setSurface("fit")}
            >
              <FigureExtract />
            </SubfigureFrame>
            <SubfigureFrame
              title="What-if simulations"
              blurb="LABS predicts process KPIs across 4 different scales when a user changes dilution rate and feed composition."
              hint="What-if simulations"
              onOpen={() => setSurface("scenario1")}
            >
              <FigureGrid />
            </SubfigureFrame>
            <SubfigureFrame
              title="Real-time monitoring"
              blurb="Track a live batch against the golden trajectory. When it drifts, LABS forecasts the likely outcome and recommends feed-flow corrections with ±2σ uncertainty envelopes."
              hint="Real-time monitoring"
              onOpen={() => setSurface("scenario2")}
            >
              <FigureGhost />
            </SubfigureFrame>
          </div>
        </motion.section>

        {/* ── Methodology ──────────────────────────────────────────────── */}
        <section id="methodology" className="mt-24">
          <h2 className="serif text-[32px] text-ink leading-tight tracking-[-0.01em]">
            Methodology
          </h2>

          {/* 01 — Model formulation */}
          <div className="mt-10 grid grid-cols-12 gap-6">
            <div className="col-span-12 md:col-span-3 pt-[3px] flex gap-3">
              <div className="hidden md:flex flex-col items-center pt-[5px] shrink-0">
                <div className="w-[7px] h-[7px] rounded-full bg-hairline-strong shrink-0" />
                <div className="w-px bg-hairline flex-1 mt-1" />
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-[0.14em] text-muted tabular">01</span>
                <div className="serif text-[17px] text-ink mt-0.5">Model formulation</div>
              </div>
            </div>
            <div className="col-span-12 md:col-span-9 self-start space-y-5 text-[15px] text-ink-soft leading-[1.7] serif">
              <p>
                Process data for lactic acid production using{" "}
                <em>Lactobacillus coryniformis</em> subsp.{" "}
                <em>torquens</em> DSM 20004 was sourced from Gonzalez&nbsp;[1].
                The mixed feed consists of maltose and glucose; maltose is
                converted extracellularly to glucose, which drives microbial
                growth. Product formation (lactic acid) follows a mixed
                growth-associated pathway with product inhibition. Growth rate
                is modelled via Monod kinetics with a product-inhibition term.
              </p>

              {/* Reaction flow chart */}
              <div className="rounded-xl bg-canvas border border-hairline px-6 py-5">
                <div className="text-[10.5px] uppercase tracking-[0.14em] text-muted mb-4">Reaction system</div>
                <svg viewBox="0 0 520 56" className="w-full max-w-[480px] h-auto" preserveAspectRatio="xMidYMid meet">
                  {/* Nodes */}
                  {[
                    { x: 10,  label: "M", sub: "Maltose"  },
                    { x: 150, label: "S", sub: "Glucose"  },
                    { x: 290, label: "X", sub: "Biomass"  },
                    { x: 430, label: "P", sub: "Product"  },
                  ].map(({ x, label, sub }) => (
                    <g key={label}>
                      <rect x={x} y={4} width={68} height={32} rx={6}
                        fill="#F5F3EF" stroke="#C2BEB4" strokeWidth={1.1} />
                      <text x={x + 24} y={24} fontSize={13} fontWeight={600}
                        fill="#1C1E22" fontFamily="JetBrains Mono, monospace" textAnchor="middle">{label}</text>
                      <text x={x + 24} y={50} fontSize={9} fill="#9AA0A6"
                        fontFamily="Inter, sans-serif" textAnchor="middle">{sub}</text>
                    </g>
                  ))}
                  {/* Arrows */}
                  {[78, 218, 358].map((ax) => (
                    <g key={ax}>
                      <line x1={ax} y1={20} x2={ax + 56} y2={20} stroke="#C2BEB4" strokeWidth={1.4} />
                      <polygon points={`${ax + 56},16 ${ax + 68},20 ${ax + 56},24`} fill="#C2BEB4" />
                    </g>
                  ))}
                </svg>
              </div>

              {/* Equations */}
              <div className="rounded-xl bg-canvas border border-hairline px-6 py-5">
                <div className="text-[10.5px] uppercase tracking-[0.14em] text-muted mb-4">Model equations</div>
                <div className="space-y-3 font-mono text-[13.5px] text-ink">
                  <MathRow lhs={<><MF t="dX" b="dt" /> = μX</>} />
                  <MathRow lhs={<><MF t="dS" b="dt" /> = −<MF t="1" b="Y" />(αμX + βX) + k<sub>M</sub>M</>} />
                  <MathRow lhs={<><MF t="dP" b="dt" /> = αμX + βX</>} />
                  <MathRow lhs={<><MF t="dM" b="dt" /> = −k<sub>M</sub>M</>} />
                  <div className="border-t border-hairline/60 pt-3">
                    <MathRow lhs={<>μ = <MF t={<>μ<sub>max</sub>S</>} b={<>K<sub>s</sub> + S</>} />·<span className="align-middle">(1 − <MF t="P" b={<>P<sub>max</sub></>} />)<sup>3</sup></span></>} />
                  </div>
                </div>
              </div>

              <p>
                The system has 4 ODEs and 7 fitting parameters. The process
                was fitted to this mechanistic model to recover a consistent
                nominal trajectory before scale-up.
              </p>
            </div>
          </div>

          {/* 02 — Synthetic data generation */}
          <div className="mt-0 grid grid-cols-12 gap-6">
            <div className="col-span-12 md:col-span-3 pt-[3px] flex gap-3">
              <div className="hidden md:flex flex-col items-center pt-[5px] shrink-0">
                <div className="w-[7px] h-[7px] rounded-full bg-hairline-strong shrink-0" />
                <div className="w-px bg-hairline flex-1 mt-1" />
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-[0.14em] text-muted tabular">02</span>
                <div className="serif text-[17px] text-ink mt-0.5">Synthetic data generation</div>
              </div>
            </div>
            <div className="col-span-12 md:col-span-9 self-start pt-12 space-y-4 text-[15px] text-ink-soft leading-[1.7] serif">
              <p>
                Three
                scale-relevant effects were then incorporated:
              </p>
              <ul className="space-y-2 pl-5 list-disc marker:text-muted-soft">
                <li>
                  <strong className="text-ink font-medium">Oxygen dependence.</strong>{" "}
                  Microbial growth was coupled to dissolved oxygen; gas–liquid
                  mass transfer was modelled via a k<sub className="text-[11px]">L</sub>a
                  correlation (Linek et al.&nbsp;[2]).
                </li>
                <li>
                  <strong className="text-ink font-medium">pH dependence.</strong>{" "}
                  A pH penalty below 5 was applied to the growth term.
                </li>
                <li>
                  <strong className="text-ink font-medium">Two-zone mixing model.</strong>{" "}
                  Each reactor was partitioned into active and dead zones
                  (both modelled as CSTRs). The dead zone occupies a
                  scale-dependent fraction of total volume:{" "}
                  <span className="tabular">1%</span> at 10 L,{" "}
                  <span className="tabular">5%</span> at 1 000 L, and{" "}
                  <span className="tabular">15%</span> at 10 000 L. pH is
                  controlled at 5 in the active zone but drifts in the dead
                  zone based on lactic acid concentration; k<sub className="text-[11px]">L</sub>a
                  is also diminished there.
                </li>
              </ul>
              <p>
                This multi-zone model generated{" "}
                <span className="tabular font-medium text-ink">100 synthetic batches</span>:
                50 at 10 L, 40 at 1 000 L, and 10 at 10 000 L — reflecting the
                decreasing ease of sampling at larger scale. Each batch was
                initialised with differing values of initial biomass, initial feed
                concentration, glucose-to-maltose ratio, and feed rate. Gaussian
                noise was added to all predicted states to mimic experimental
                uncertainty. Conversion from raw data to structured records was
                accomplished with an LLM-based ingestion workflow.
              </p>
            </div>
          </div>

          {/* 03 — Data splitting */}
          <div className="mt-0 grid grid-cols-12 gap-6">
            <div className="col-span-12 md:col-span-3 pt-[3px] flex gap-3">
              <div className="hidden md:flex flex-col items-center pt-[5px] shrink-0">
                <div className="w-[7px] h-[7px] rounded-full bg-hairline-strong shrink-0" />
                <div className="w-px bg-hairline flex-1 mt-1" />
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-[0.14em] text-muted tabular">03</span>
                <div className="serif text-[17px] text-ink mt-0.5">Data splitting</div>
              </div>
            </div>
            <div className="col-span-12 md:col-span-9 self-start pt-12 space-y-4 text-[15px] text-ink-soft leading-[1.7] serif">
              <p>
                The structured data was divided into training and test sets
                batch-wise: each batch is either entirely in the training set or
                entirely in the test set, so the model is never evaluated on
                interpolated data it has partially seen. The training fraction is
                set to <span className="tabular">70%</span> in this demo.
              </p>
            </div>
          </div>

          {/* 04 — Model training */}
          <div className="mt-0 grid grid-cols-12 gap-6">
            <div className="col-span-12 md:col-span-3 pt-[3px] flex gap-3">
              <div className="hidden md:flex flex-col items-center pt-[5px] shrink-0">
                <div className="w-[7px] h-[7px] rounded-full bg-hairline-strong shrink-0" />
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-[0.14em] text-muted tabular">04</span>
                <div className="serif text-[17px] text-ink mt-0.5">Model training</div>
              </div>
            </div>
            <div className="col-span-12 md:col-span-9 self-start pt-12 space-y-4 text-[15px] text-ink-soft leading-[1.7] serif">
              <p>
                LABS supports RNN, Neural ODE, and PINN architectures. For this
                demo an <strong className="text-ink font-medium">RNN</strong> was
                selected for its simplicity and strong suitability for time-series
                data. A mass-balance constraint was added to the loss function to
                preserve physical consistency. Uncertainty envelopes are produced
                via <strong className="text-ink font-medium">Monte Carlo dropout</strong>,
                giving ±2σ prediction bands without a separate ensemble.
              </p>
              <p>
                After training, the model was validated on the held-out test set
                using MAE, RMSE, and R². The validated model is used in the
                what-if simulations and real-time monitoring workflows above.
              </p>
            </div>
          </div>

          {/* References */}
          <div className="mt-12 pt-8 border-t border-hairline">
            <div className="text-[10.5px] uppercase tracking-[0.14em] text-muted mb-3">References</div>
            <ol className="space-y-2 text-[13px] text-ink-soft leading-relaxed list-decimal pl-4">
              <li>
                Gonzalez, K. V. "Modeling and robust control of biological systems:
                example of lactic acid production in industrial fermenter."
                PhD diss., Ecole Centrale Paris, 2015.
              </li>
              <li>
                Linek, V., Kordač, M., Fujasová, M., &amp; Moucha, T. "Gas–liquid
                mass transfer coefficient in stirred tanks interpreted through
                models of idealized eddy structure of turbulence in the bubble
                vicinity." <em>Chemical Engineering and Processing</em> 43, no. 12 (2004): 1511–1517.
              </li>
            </ol>
          </div>
        </section>

      </div>
    </div>
  );
}

/* ─── Top bar ─────────────────────────────────────────────────────────── */

function TopBar() {
  const setSurface = useApp((s) => s.setSurface);
  // A soft, non-linear blur that fades out through the bottom edge. The
  // outer wrapper is a fixed-height strip; inside, a second layer carries
  // the backdrop-blur masked by a vertical gradient so the blur strength
  // tapers toward zero instead of cutting off at a hard line.
  const mask =
    "linear-gradient(to bottom, rgba(0,0,0,1) 55%, rgba(0,0,0,0.72) 78%, rgba(0,0,0,0.32) 92%, rgba(0,0,0,0) 100%)";
  return (
    <div className="sticky top-0 z-10 pointer-events-none">
      <div
        aria-hidden
        className="absolute inset-0 backdrop-blur-sm"
        style={{
          WebkitMaskImage: mask,
          maskImage: mask,
          background:
            "linear-gradient(to bottom, rgba(251,250,247,0.78) 40%, rgba(251,250,247,0.42) 75%, rgba(251,250,247,0) 100%)",
        }}
      />
      <div className="relative mx-auto max-w-[1440px] px-10 h-24 flex items-center justify-between pointer-events-auto">
        <div className="flex items-end gap-2.5">
          <img src="/lemnisca-logo.svg" alt="Lemnisca" className="h-[30px] w-auto" />
        </div>
        <motion.button
          onClick={() => setSurface("fit")}
          initial="rest"
          whileHover="hover"
          whileTap="tap"
          variants={{ tap: { scale: 0.97 } }}
          transition={{ duration: 0.1, ease: [0.23, 1, 0.32, 1] }}
          className="flex items-center justify-center overflow-hidden bg-ink rounded-full px-6 py-2.5 [transition:background-color_180ms_cubic-bezier(0.23,1,0.32,1)] hover:bg-ink/85"
        >
          <motion.span
            className="flex items-center"
            variants={{ rest: { x: 9 }, hover: { x: 0 } }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
          >
            <span className="text-[13px] font-medium text-[#FAFAF8] tracking-[0.02em]">Explore the model</span>
            <motion.span
              className="ml-2 text-[#FAFAF8] text-[13px]"
              variants={{ rest: { x: 16, opacity: 0 }, hover: { x: 0, opacity: 1 } }}
              transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            >
              →
            </motion.span>
          </motion.span>
        </motion.button>
      </div>
    </div>
  );
}

/* ─── Subfigure frame ─────────────────────────────────────────────────── */

function SubfigureFrame({
  title,
  blurb,
  children,
}: {
  title: string;
  blurb: string;
  hint?: string;
  children: React.ReactNode;
  onOpen?: () => void;
}) {
  return (
    <div className="rounded-2xl bg-canvas-raised/60 border border-hairline overflow-hidden flex flex-col transition-all duration-200 hover:border-hairline-strong hover:-translate-y-[1px] hover:shadow-[0_6px_22px_rgba(28,30,34,0.05)]">
      {/* Title + blurb */}
      <div className="px-4 pt-4 pb-3 border-b border-hairline/60">
        <div className="serif text-[16px] text-ink leading-tight">{title}</div>
        <p className="mt-2 text-[12.5px] text-ink-soft leading-[1.55]">{blurb}</p>
      </div>

      {/* Figure body */}
      <div className="aspect-[5/4] relative bg-canvas">
        <div className="absolute inset-0 flex items-center justify-center p-3">
          {children}
        </div>
      </div>
    </div>
  );
}

/* ─── Fig 1a — document extraction ────────────────────────────────────── */

function FigureExtract() {
  const W = 360, H = 260;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-[94%] h-auto" preserveAspectRatio="xMidYMid meet">
      {/* Page (left) */}
      <g>
        <rect x="20" y="24" width="132" height="212" rx="5" fill="#FBFAF7" stroke="#C2BEB4" strokeWidth="1.1" />
        <rect x="20" y="24" width="132" height="22" fill="#EEEBE3" />
        <text x="30" y="39" fontSize="9.5" fill="#6B7280" fontFamily="JetBrains Mono, monospace" fontWeight="600">raw_data.pdf</text>
        {/* corner fold */}
        <path d="M 140 24 L 152 24 L 152 36 Z" fill="#E7E5E0" stroke="#C2BEB4" strokeWidth="0.8" />
        {/* faint text lines */}
        {Array.from({ length: 11 }).map((_, i) => (
          <motion.line
            key={i}
            x1="30" x2={30 + (i % 3 === 2 ? 86 : 108)}
            y1={62 + i * 15} y2={62 + i * 15}
            stroke="#D8D5CE" strokeWidth="2.2" strokeLinecap="round"
            initial={{ opacity: 0.25 }}
            animate={{ opacity: [0.25, 0.9, 0.25] }}
            transition={{ duration: 2.6, delay: i * 0.15, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
      </g>

      {/* Connector */}
      <motion.path
        d="M 152 130 C 180 130, 184 130, 208 130"
        stroke="#4E8B73" strokeWidth="1.6" fill="none" strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.1, ease: "easeInOut" }}
      />
      <motion.circle cx="208" cy="130" r="3" fill="#4E8B73"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        transition={{ duration: 0.25, delay: 1.05 }} />
      <motion.text x="168" y="123" fontSize="8.5" fill="#4E8B73"
        fontFamily="JetBrains Mono, monospace" textAnchor="middle"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        transition={{ duration: 0.25, delay: 0.6 }}
      >
        extract
      </motion.text>

      {/* Table (right) */}
      <g>
        <rect x="212" y="46" width="128" height="168" rx="5" fill="#FBFAF7" stroke="#C2BEB4" strokeWidth="1.1" />
        {/* header */}
        <rect x="212" y="46" width="128" height="22" fill="#1C1E22" />
        {["t", "X", "S", "P"].map((h, i) => (
          <text key={h} x={225 + i * 30} y="61" fontSize="10" fill="#FBFAF7"
            fontFamily="JetBrains Mono, monospace" fontWeight="600">{h}</text>
        ))}
        {/* rows */}
        {Array.from({ length: 9 }).map((_, r) => (
          <g key={r}>
            <line x1="212" x2="340" y1={74 + r * 15} y2={74 + r * 15} stroke="#E7E5E0" strokeWidth="0.7" />
            {[0, 1, 2, 3].map((c) => (
              <motion.text
                key={c}
                x={225 + c * 30} y={85 + r * 15}
                fontSize="8.5" fill="#3A3D42"
                fontFamily="JetBrains Mono, monospace"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.22, delay: 1.15 + r * 0.06 + c * 0.015 }}
              >
                {c === 0 ? (r * 5).toString() : (6 + r * 3.2 + c * 1.1).toFixed(1)}
              </motion.text>
            ))}
          </g>
        ))}
      </g>
    </svg>
  );
}

/* ─── Fig 1b — 5×5 parameter grid ─────────────────────────────────────── */

const SCALE_COLORS = ['#4E9AF0', '#3DBE8A', '#F0924A', '#9B6EC8'];
const SCALE_LABELS = ['10 L', '1 000 L', '10 000 L', '150 m³'];

function FigureGrid() {
  const [grid, setGrid] = useState<WhatIfGrid | null>(null);

  useEffect(() => {
    loadWhatIfGrid().then(setGrid).catch(() => { /* noop */ });
  }, []);

  const traces = useMemo(() => {
    if (!grid) return [];
    const dKey  = grid.dKeys[Math.floor(grid.dKeys.length / 2)];
    const gfKey = grid.gfKeys[Math.floor(grid.gfKeys.length / 2)];
    return grid.scaleKeys.map((sk, i) => {
      const cell = grid.cells[sk]?.[dKey]?.[gfKey];
      return {
        label: SCALE_LABELS[i] ?? sk,
        color: SCALE_COLORS[i],
        mean:  cell ? cell.P.mean : [],
        upper: cell ? cell.P.mean.map((m, j) => m + 2 * cell.P.std[j]) : [],
        lower: cell ? cell.P.mean.map((m, j) => Math.max(0, m - 2 * cell.P.std[j])) : [],
      };
    });
  }, [grid]);

  const W = 340, H = 220;
  const PAD = { l: 36, r: 14, t: 24, b: 28 };
  const time = grid?.time ?? [];
  const xMax = time[time.length - 1] || 75;
  const allVals = traces.flatMap((tr) => tr.upper);
  const yMax = allVals.length ? Math.ceil(Math.max(...allVals) * 1.08) : 80;

  const xs = (t: number) => PAD.l + (t / xMax) * (W - PAD.l - PAD.r);
  const ys = (v: number) => H - PAD.b - (v / yMax) * (H - PAD.t - PAD.b);

  const linePath = (arr: number[]) =>
    arr.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xs(time[i]).toFixed(1)} ${ys(v).toFixed(1)}`).join(' ');

  const bandPath = (upper: number[], lower: number[]) =>
    upper.length ? [
      ...upper.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xs(time[i]).toFixed(1)} ${ys(v).toFixed(1)}`),
      ...[...lower].reverse().map((v, i) => `L ${xs(time[lower.length - 1 - i]).toFixed(1)} ${ys(v).toFixed(1)}`),
      'Z',
    ].join(' ') : '';

  const yTicks = [0, yMax / 2, yMax];
  const xTicks = [0, xMax / 2, xMax];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className='w-[96%] h-auto' preserveAspectRatio='xMidYMid meet'
      style={{ fontFamily: 'JetBrains Mono, monospace' }}>
      {yTicks.map((y) => (
        <line key={y} x1={PAD.l} x2={W - PAD.r} y1={ys(y)} y2={ys(y)}
          stroke='#E7E5E0' strokeDasharray={y === 0 ? '0' : '2 4'} />
      ))}
      {yTicks.map((y) => (
        <text key={`y${y}`} x={PAD.l - 5} y={ys(y) + 3} textAnchor='end' fontSize={8} fill='#9AA0A6'>
          {y.toFixed(0)}
        </text>
      ))}
      {xTicks.map((x) => (
        <text key={`x${x}`} x={xs(x)} y={H - PAD.b + 12} textAnchor='middle' fontSize={8} fill='#9AA0A6'>
          {x.toFixed(0)}h
        </text>
      ))}
      <text x={PAD.l - 5} y={PAD.t - 8} textAnchor='end' fontSize={7.5} fill='#9AA0A6'>g/L</text>
      {traces.map((tr) => {
        const p = bandPath(tr.upper, tr.lower);
        return p ? <path key={`b${tr.label}`} d={p} fill={tr.color} fillOpacity={0.15} stroke='none' /> : null;
      })}
      {traces.map((tr) =>
        tr.mean.length ? (
          <path key={`l${tr.label}`} d={linePath(tr.mean)}
            fill='none' stroke={tr.color} strokeWidth={1.6}
            strokeLinecap='round' strokeLinejoin='round' opacity={0.9} />
        ) : null,
      )}
      {traces.map((tr, i) => (
        <g key={`leg${i}`} transform={`translate(${PAD.l + 4 + i * 74}, 10)`}>
          <line x1={0} x2={10} y1={4} y2={4} stroke={tr.color} strokeWidth={1.8} strokeLinecap='round' />
          <text x={13} y={7} fontSize={7.5} fill='#6B7280'>{tr.label}</text>
        </g>
      ))}
    </svg>
  );
}

/* ─── Fig 1c — golden-batch ghost + live playhead ─────────────────────── */

function FigureGhost() {
  const [golden, setGolden] = useState<{ t: number; p: number; lo: number; hi: number }[]>([]);
  const [rescue, setRescue] = useState<{ t: number; p: number; lo: number; hi: number }[]>([]);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    loadCSV<GoldenRow>("/data/golden_batch_trajectory.csv").then((rows) => {
      const pts = rows
        .map((r) => ({
          t: Number(r["Time (h)"]),
          p: Number(r["P (g/L)"]),
          lo: Number(r["P_lower (g/L)"]),
          hi: Number(r["P_upper (g/L)"]),
        }))
        .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.p))
        .sort((a, b) => a.t - b.t);
      setGolden(pts);
    });
    loadCSV<ScenRow>("/data/rnn_scenario_1.6x_F.csv").then((rows) => {
      const pts = rows
        .map((r) => ({
          t: Number(r["Time (h)"]),
          p: Number(r["P_mean (g/L)"]),
          lo: Number(r["P_lower95 (g/L)"]),
          hi: Number(r["P_upper95 (g/L)"]),
        }))
        .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.p))
        .sort((a, b) => a.t - b.t);
      setRescue(pts);
    });
  }, []);

  // Playhead: advance one rescue-frame every ~320ms (slower, easier to track),
  // then a 2.4s pause at the end before restarting from the top.
  useEffect(() => {
    if (!rescue.length) return;
    let raf = 0, last = performance.now(), pause = 0;
    const step = (now: number) => {
      const dt = now - last;
      if (pause > 0) {
        pause -= dt;
        if (pause <= 0) setFrame(0);
      } else if (dt >= 150) {
        last = now;
        setFrame((f) => {
          const next = f + 1;
          if (next >= rescue.length) { pause = 1200; return rescue.length; }
          return next;
        });
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [rescue.length]);

  const W = 380, H = 260;
  const PAD = { l: 14, r: 12, t: 22, b: 22 };

  const xMax = 75;
  const yMax = Math.max(
    ...golden.map((p) => p.hi),
    ...rescue.map((p) => p.hi),
    1,
  );

  const xs = (t: number) => PAD.l + (t / xMax) * (W - PAD.l - PAD.r);
  const ys = (v: number) => H - PAD.b - (v / yMax) * (H - PAD.t - PAD.b);

  const goldenPath = golden
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xs(p.t).toFixed(1)} ${ys(p.p).toFixed(1)}`)
    .join(" ");

  const shown = rescue.slice(0, Math.min(frame, rescue.length));
  const livePath = shown
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xs(p.t).toFixed(1)} ${ys(p.p).toFixed(1)}`)
    .join(" ");
  const liveEnv = shown.length
    ? [
        ...shown.map((p, i) => `${i === 0 ? "M" : "L"} ${xs(p.t).toFixed(1)} ${ys(p.hi).toFixed(1)}`),
        ...shown.slice().reverse().map((p) => `L ${xs(p.t).toFixed(1)} ${ys(p.lo).toFixed(1)}`),
        "Z",
      ].join(" ")
    : "";

  const head = shown[shown.length - 1];
  const goldenStart = rescue[0] ? golden.find((g) => Math.abs(g.t - rescue[0].t) < 0.5) : null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-[96%] h-auto" preserveAspectRatio="xMidYMid meet">
      {/* Y axis label */}
      <text x={PAD.l - 4} y={PAD.t - 8} fontSize="8.5" fill="#6B7280"
        fontFamily="JetBrains Mono, monospace">Lactic P · g/L</text>

      {/* axes */}
      <line x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} stroke="#E7E5E0" strokeWidth="0.9" />
      <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={H - PAD.b} stroke="#E7E5E0" strokeWidth="0.9" />

      {/* x ticks */}
      {[0, xMax / 2, xMax].map((t) => (
        <g key={t}>
          <line x1={xs(t)} x2={xs(t)} y1={H - PAD.b} y2={H - PAD.b + 3} stroke="#9AA0A6" strokeWidth="0.8" />
          <text x={xs(t)} y={H - 6} fontSize="8.5" fill="#9AA0A6"
            fontFamily="JetBrains Mono, monospace" textAnchor="middle">{t}h</text>
        </g>
      ))}

      {/* golden ghost (static, pale signal) */}
      {golden.length > 0 && (
        <path d={goldenPath} fill="none" stroke="#C8863A" strokeWidth="1.9" opacity="0.55" strokeLinecap="round" />
      )}

      {/* live envelope */}
      {liveEnv && (
        <path d={liveEnv} fill="#4E8B73" fillOpacity="0.16" stroke="none" />
      )}

      {/* live path */}
      {livePath && (
        <path d={livePath} fill="none" stroke="#4E8B73" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
      )}

      {/* divergence marker */}
      {goldenStart && (
        <g>
          <line x1={xs(goldenStart.t)} x2={xs(goldenStart.t)} y1={PAD.t} y2={H - PAD.b}
            stroke="#C8863A" strokeWidth="0.9" strokeDasharray="2 3" opacity="0.6" />
          <text x={xs(goldenStart.t) + 4} y={PAD.t + 9} fontSize="9" fill="#C8863A"
            fontFamily="JetBrains Mono, monospace" fontWeight="600">drift · t={goldenStart.t}h</text>
        </g>
      )}

      {/* playhead */}
      {head && (
        <g>
          <circle cx={xs(head.t)} cy={ys(head.p)} r="8" fill="#4E8B73" fillOpacity="0.12" />
          <circle cx={xs(head.t)} cy={ys(head.p)} r="4" fill="#FBFAF7" stroke="#4E8B73" strokeWidth="1.8" />
        </g>
      )}

      {/* legend */}
      <g transform={`translate(${W - PAD.r - 118}, ${PAD.t - 10})`}>
        <line x1="0" x2="16" y1="4" y2="4" stroke="#C8863A" strokeWidth="1.9" opacity="0.6" />
        <text x="20" y="7" fontSize="9" fill="#6B7280" fontFamily="Inter, sans-serif">golden</text>
        <line x1="60" x2="76" y1="4" y2="4" stroke="#4E8B73" strokeWidth="1.9" />
        <text x="80" y="7" fontSize="9" fill="#6B7280" fontFamily="Inter, sans-serif">live · ±2σ</text>
      </g>
    </svg>
  );
}

/* ─── Math helpers (methodology equations) ───────────────────────────── */

function MF({ t, b }: { t: React.ReactNode; b: React.ReactNode }) {
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", verticalAlign: "middle", margin: "0 2px", lineHeight: 1.15 }}>
      <span style={{ borderBottom: "1px solid #3A3D42", paddingBottom: 1, paddingLeft: 2, paddingRight: 2, whiteSpace: "nowrap" }}>{t}</span>
      <span style={{ paddingTop: 1, paddingLeft: 2, paddingRight: 2, whiteSpace: "nowrap" }}>{b}</span>
    </span>
  );
}

function MathRow({ lhs }: { lhs: React.ReactNode }) {
  return (
    <div className="flex items-center leading-none py-1 text-ink" style={{ fontFamily: "JetBrains Mono, monospace" }}>
      {lhs}
    </div>
  );
}

