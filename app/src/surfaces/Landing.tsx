import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useApp } from "../lib/store";
import { loadWhatIfGrid, type WhatIfGrid } from "../lib/whatif";
import { loadCSV } from "../lib/csv";
import { cn } from "../lib/cn";

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
          <div className="flex items-baseline gap-3">
            <span className="text-[11px] uppercase tracking-[0.14em] text-muted tabular">
              Lemnisca · demo build · 2026
            </span>
            <span className="h-px flex-1 bg-hairline/70" />
          </div>

          <h1 className="serif text-[clamp(42px,6.2vw,78px)] leading-[1.02] text-ink tracking-[-0.01em]">
            Lactic Acid Bioprocess
            <br />
            Simulation
          </h1>

          <p className="text-[18px] text-ink-soft leading-[1.6] max-w-[64ch]">
            A hybrid-modelling demo for fermentation data. LABS fits mechanistic
            and machine-learning models together, runs what-if scenarios across
            reactor scale, and suggests rescue actions when a live batch drifts
            from its golden trajectory — each prediction carried with its own ±2σ
            uncertainty envelope.
          </p>

          <p className="text-[14.5px] text-muted leading-relaxed max-w-[64ch]">
            Three linked workflows, shown as Figure 1 below — click any panel to
            open it.
          </p>

          <div className="flex items-center gap-5 pt-1">
            <button
              onClick={() => setSurface("fit")}
              className="press inline-flex items-center gap-2 h-12 px-6 rounded-full bg-ink text-canvas text-[14px] font-medium hover:bg-ink-soft transition-colors"
            >
              Open the demo
              <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 8h10m-4-4 4 4-4 4" />
              </svg>
            </button>
            <a
              href="#method"
              className="inline-flex items-center gap-1.5 text-[13.5px] text-muted hover:text-ink transition-colors"
            >
              Read the method
              <svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 6l4 4 4-4" />
              </svg>
            </a>
          </div>
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
              letter="a"
              title="Data extraction"
              subtitle="raw PDF → structured table"
              hint="Process data"
              onOpen={() => setSurface("fit")}
            >
              <FigureExtract />
            </SubfigureFrame>
            <SubfigureFrame
              letter="b"
              title="Parameter grid"
              subtitle="scale × dilution × GF"
              hint="What-if simulator"
              onOpen={() => setSurface("scenario1")}
            >
              <FigureGrid />
            </SubfigureFrame>
            <SubfigureFrame
              letter="c"
              title="Anomaly rescue"
              subtitle="golden ghost vs. live trajectory"
              hint="Anomaly rescue"
              onOpen={() => setSurface("scenario2")}
            >
              <FigureGhost />
            </SubfigureFrame>
          </div>

          <p className="mt-6 text-[14px] text-ink-soft leading-[1.7] serif italic">
            <span className="not-italic serif text-ink">Figure 1 —</span>{" "}
            The three stages of the LABS workflow. Raw lab data is extracted from
            PDFs or spreadsheets and fit to a hybrid model{" "}
            <span className="not-italic text-muted tabular">(a)</span>; the
            trained model is explored across reactor scale, dilution rate, and
            glucose fraction to predict key performance indicators{" "}
            <span className="not-italic text-muted tabular">(b)</span>; and when
            a live batch diverges from its golden trajectory, the model proposes
            corrective feed-flowrate actions carried with ±2σ uncertainty
            envelopes{" "}
            <span className="not-italic text-muted tabular">(c)</span>.
            <sup className="text-muted-soft tabular"> 1</sup>
          </p>
        </motion.section>

        {/* ── Demo note ────────────────────────────────────────────────── */}
        <section className="mt-20 border-y border-hairline py-6">
          <div className="flex items-start gap-6">
            <span className="mt-0.5 text-[10.5px] uppercase tracking-[0.16em] font-semibold text-signal tabular shrink-0">
              Demo note
            </span>
            <p className="flex-1 text-[14px] text-ink-soft leading-relaxed serif italic">
              This is a demo version. Synthetic data generated using a mechanistic
              model from literature and suitable additional assumptions has been
              used to mimic experimental measurements. Hybrid model training and
              predictions have been performed offline; the demo version displays
              final results of training and predictions.
            </p>
          </div>
        </section>

        {/* ── 01 Method ────────────────────────────────────────────────── */}
        <section id="method" className="mt-20 grid grid-cols-12 gap-6">
          <div className="col-span-12 md:col-span-2">
            <span className="text-[11px] uppercase tracking-[0.14em] text-muted tabular">
              01
            </span>
            <div className="serif text-[15px] text-ink mt-1">Method</div>
          </div>
          <div className="col-span-12 md:col-span-10 space-y-4">
            <p className="text-[16px] text-ink-soft leading-[1.7] serif">
              LABS works with raw lab data across different scales involved in
              bioprocess development. It fits your data to hybrid models that
              blend the flexibility of data-driven approaches with the scientific
              rigor of mechanistic approaches.
            </p>
            <p className="text-[16px] text-ink-soft leading-[1.7] serif">
              The trained hybrid models can then be employed in what-if scenarios
              to predict key performance indicators as a function of controlled
              variables. They can also help you take corrective action when a
              batch deviates from the golden trajectory — suggested actions are
              accompanied by uncertainty envelopes from the model itself.
            </p>
          </div>
        </section>

        {/* ── 02 Enter a workflow ──────────────────────────────────────── */}
        <section className="mt-20 grid grid-cols-12 gap-6">
          <div className="col-span-12 md:col-span-2">
            <span className="text-[11px] uppercase tracking-[0.14em] text-muted tabular">
              02
            </span>
            <div className="serif text-[15px] text-ink mt-1">Enter</div>
          </div>
          <div className="col-span-12 md:col-span-10 grid grid-cols-1 md:grid-cols-3 gap-4">
            <WorkflowCard
              n="01"
              title="Process data"
              body="Ingest raw lab data, review the structured extract, configure a hybrid model, fit, and inspect per-species test metrics."
              onClick={() => setSurface("fit")}
            />
            <WorkflowCard
              n="02"
              title="What-if simulator"
              body="Explore predicted trajectories across reactor scale, dilution rate, and glucose fraction. Mean ± 2σ bands drawn from the hybrid model."
              onClick={() => setSurface("scenario1")}
            />
            <WorkflowCard
              n="03"
              title="Anomaly rescue"
              body="A live batch drifts from the golden trajectory. Compare five feed-flowrate rescues and pick one based on model-predicted endpoints."
              onClick={() => setSurface("scenario2")}
            />
          </div>
        </section>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <footer className="mt-24 pt-6 border-t border-hairline flex items-center justify-between text-[11.5px] tabular text-muted-soft">
          <div className="flex items-center gap-2">
            <img src="/lemnisca-logo.svg" alt="Lemnisca" className="h-[16px] w-auto opacity-70" />
            <span>Demo build · synthetic data · trained offline</span>
          </div>
          <span>
            <sup>1</sup> Mechanistic reference: literature kinetics for lactic-acid fermentation.
          </span>
        </footer>
      </div>
    </div>
  );
}

/* ─── Top bar ─────────────────────────────────────────────────────────── */

function TopBar() {
  return (
    <div className="sticky top-0 z-10 bg-canvas/70 backdrop-blur-md">
      <div className="mx-auto max-w-[1240px] px-10 h-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/lemnisca-logo.svg" alt="Lemnisca" className="h-[22px] w-auto" />
          <span className="text-[12.5px] text-muted tabular tracking-wide">LABS</span>
        </div>
        <span className="text-[11.5px] text-muted-soft tabular">
          demo · synthetic data · trained offline
        </span>
      </div>
    </div>
  );
}

/* ─── Subfigure frame ─────────────────────────────────────────────────── */

function SubfigureFrame({
  letter,
  title,
  subtitle,
  hint,
  children,
  onOpen,
}: {
  letter: "a" | "b" | "c";
  title: string;
  subtitle: string;
  hint: string;
  children: React.ReactNode;
  onOpen: () => void;
}) {
  return (
    <button
      onClick={onOpen}
      className="group text-left rounded-2xl bg-canvas-raised/60 border border-hairline overflow-hidden hover:border-hairline-strong transition-all duration-200 hover:-translate-y-[1px] hover:shadow-[0_6px_22px_rgba(28,30,34,0.05)]"
    >
      {/* Label strip */}
      <div className="flex items-baseline justify-between px-4 pt-3.5 pb-2.5 border-b border-hairline/60">
        <div className="flex items-baseline gap-2">
          <span className="text-[10.5px] uppercase tracking-[0.14em] tabular text-muted-soft">
            Fig. 1{letter}
          </span>
          <span className="text-[13px] text-ink serif">{title}</span>
        </div>
        <span className="text-[10.5px] tabular text-muted-soft hidden sm:inline">{subtitle}</span>
      </div>

      {/* Figure body */}
      <div className="aspect-[5/4] relative bg-canvas">
        <div className="absolute inset-0 flex items-center justify-center p-3">
          {children}
        </div>
      </div>

      {/* Footer hint */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-hairline/60 bg-canvas-raised/40">
        <span className="text-[11.5px] text-muted">Opens: {hint}</span>
        <span className="inline-flex items-center gap-1 text-[11.5px] text-muted-soft group-hover:text-ink transition-colors">
          open
          <svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="group-hover:translate-x-[1px] transition-transform">
            <path d="M3 8h10m-4-4 4 4-4 4" />
          </svg>
        </span>
      </div>
    </button>
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
            transition={{ duration: 5.4, delay: i * 0.3, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
      </g>

      {/* Connector */}
      <motion.path
        d="M 152 130 C 180 130, 184 130, 208 130"
        stroke="#4E8B73" strokeWidth="1.6" fill="none" strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 2.2, ease: "easeInOut" }}
      />
      <motion.circle cx="208" cy="130" r="3" fill="#4E8B73"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 2.1 }} />
      <motion.text x="168" y="123" fontSize="8.5" fill="#4E8B73"
        fontFamily="JetBrains Mono, monospace" textAnchor="middle"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        transition={{ duration: 0.45, delay: 1.2 }}
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
                transition={{ duration: 0.35, delay: 2.3 + r * 0.12 + c * 0.03 }}
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

function FigureGrid() {
  const [grid, setGrid] = useState<WhatIfGrid | null>(null);
  const [highlightIdx, setHighlightIdx] = useState(12);

  useEffect(() => {
    loadWhatIfGrid().then(setGrid).catch(() => { /* noop */ });
  }, []);

  // Glide the highlight to a random neighbour cell every ~9s — slow enough
  // that the eye can settle on the currently highlighted sparkline before
  // the focus moves.
  useEffect(() => {
    const id = setInterval(() => {
      setHighlightIdx((prev) => {
        const row = Math.floor(prev / 5);
        const col = prev % 5;
        const dr = [-1, 0, 0, 1][Math.floor(Math.random() * 4)];
        const dc = [0, -1, 1, 0][Math.floor(Math.random() * 4)];
        const nr = Math.max(0, Math.min(4, row + dr));
        const nc = Math.max(0, Math.min(4, col + dc));
        return nr * 5 + nc;
      });
    }, 9000);
    return () => clearInterval(id);
  }, []);

  // Build 25 sparkline curves from the (scale=10000, dKeys[0..4], gfKeys[0..4]) slice.
  const cells = useMemo(() => {
    if (!grid) return [];
    const scaleKey = grid.scaleKeys.find((k) => Number(k) === 10000) ?? grid.scaleKeys[0];
    const dSubset = grid.dKeys.slice(0, 5);
    const gfSubset = grid.gfKeys.slice(0, 5);
    const out: { points: { t: number; v: number }[]; yMax: number; yMin: number }[] = [];
    for (const d of dSubset) {
      for (const g of gfSubset) {
        const cell = grid.cells[scaleKey]?.[d]?.[g];
        if (!cell) { out.push({ points: [], yMax: 1, yMin: 0 }); continue; }
        const t = grid.time;
        const mean = cell.P.mean;
        const pts = t.map((ti, i) => ({ t: ti, v: mean[i] }));
        const yMax = Math.max(...mean);
        const yMin = Math.min(...mean);
        out.push({ points: pts, yMax, yMin });
      }
    }
    return out;
  }, [grid]);

  const CELL_W = 60, CELL_H = 46, GAP = 7;
  const GRID_W = 5 * CELL_W + 4 * GAP;
  const GRID_H = 5 * CELL_H + 4 * GAP;
  const LEFT = 22; // axis labels
  const TOP = 22;
  const W = GRID_W + LEFT + 8;
  const H = GRID_H + TOP + 16;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-[96%] h-auto"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Axis labels */}
      <text x={LEFT + GRID_W / 2} y={11} fontSize="9" fill="#6B7280"
        fontFamily="JetBrains Mono, monospace" textAnchor="middle">
        glucose fraction →
      </text>
      <text x={10} y={TOP + GRID_H / 2} fontSize="9" fill="#6B7280"
        fontFamily="JetBrains Mono, monospace" textAnchor="middle"
        transform={`rotate(-90 10 ${TOP + GRID_H / 2})`}>
        ← dilution rate
      </text>

      <g transform={`translate(${LEFT}, ${TOP})`}>
        {cells.map((cell, i) => {
          const r = Math.floor(i / 5);
          const c = i % 5;
          const x = c * (CELL_W + GAP);
          const y = r * (CELL_H + GAP);
          const isHl = i === highlightIdx;
          const range = cell.yMax - cell.yMin || 1;
          const pad = 5;
          const path = cell.points.length
            ? cell.points.map((p, idx) => {
                const px = pad + (idx / (cell.points.length - 1)) * (CELL_W - pad * 2);
                const py = CELL_H - pad - ((p.v - cell.yMin) / range) * (CELL_H - pad * 2);
                return `${idx === 0 ? "M" : "L"} ${px.toFixed(1)} ${py.toFixed(1)}`;
              }).join(" ")
            : "";
          return (
            <g key={i} transform={`translate(${x}, ${y})`}>
              <motion.rect
                width={CELL_W} height={CELL_H} rx={3.5}
                initial={false}
                animate={{
                  fill: isHl ? "#EDF4EF" : "#FBFAF7",
                  stroke: isHl ? "#4E8B73" : "#E7E5E0",
                }}
                transition={{ duration: 1.0, ease: "easeInOut" }}
                strokeWidth={isHl ? 1.4 : 0.8}
              />
              {path && (
                <motion.path
                  d={path}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={false}
                  animate={{
                    stroke: isHl ? "#4E8B73" : "#9AA0A6",
                    strokeWidth: isHl ? 1.6 : 0.9,
                    opacity: isHl ? 1 : 0.55,
                  }}
                  transition={{ duration: 1.0, ease: "easeInOut" }}
                />
              )}
            </g>
          );
        })}
      </g>
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
          p: Number(r["P_mean (g/L)"]),
          lo: Number(r["P_lower95 (g/L)"]),
          hi: Number(r["P_upper95 (g/L)"]),
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
      } else if (dt >= 320) {
        last = now;
        setFrame((f) => {
          const next = f + 1;
          if (next >= rescue.length) { pause = 2400; return rescue.length; }
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

/* ─── Workflow card ───────────────────────────────────────────────────── */

function WorkflowCard({
  n,
  title,
  body,
  onClick,
}: {
  n: string;
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group text-left rounded-2xl bg-canvas-raised/60 border border-hairline p-5",
        "hover:border-hairline-strong hover:-translate-y-[1px] transition-all duration-200"
      )}
    >
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] uppercase tracking-[0.14em] text-muted-soft tabular">{n}</span>
        <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-muted-soft group-hover:text-ink transition-colors">
          <path d="M3 8h10m-4-4 4 4-4 4" />
        </svg>
      </div>
      <div className="serif text-[18px] text-ink mt-2 leading-tight">{title}</div>
      <p className="mt-2 text-[13px] text-ink-soft leading-relaxed">{body}</p>
    </button>
  );
}
