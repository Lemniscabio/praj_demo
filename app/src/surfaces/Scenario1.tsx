import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SectionTitle, Pill, Button } from "../components/ui";
import { Reactor } from "../components/Reactor";
import { FleetTrajectory, scaleColor } from "../components/FleetTrajectory";
import { loadWhatIfGrid, type WhatIfGrid } from "../lib/whatif";
import { useApp } from "../lib/store";
import { cn } from "../lib/cn";

const ROLE_BY_INDEX = ["Lab", "Pilot", "Demo", "Production"];

export function Scenario1Surface() {
  const modelFitted = useApp((s) => s.modelFitted);
  const setSurface = useApp((s) => s.setSurface);

  const [grid, setGrid] = useState<WhatIfGrid | null>(null);
  const [dIdx, setDIdx] = useState(0);
  const [gfIdx, setGfIdx] = useState(0);
  const [showPlots, setShowPlots] = useState(false);

  useEffect(() => {
    loadWhatIfGrid().then((g) => {
      setGrid(g);
      setDIdx(Math.floor(g.dKeys.length / 2));
      setGfIdx(Math.floor(g.gfKeys.length / 2));
    });
  }, []);

  const dKey = grid?.dKeys[dIdx];
  const gfKey = grid?.gfKeys[gfIdx];
  const D = dKey ? Number(dKey) : 0;
  const GF = gfKey ? Number(gfKey) : 0;

  // Per-scale cell for each reactor in the strip.
  const fleetCells = useMemo(() => {
    if (!grid || !dKey || !gfKey) return null;
    return grid.scaleKeys.map((scaleKey, i) => {
      const cell = grid.cells[scaleKey]?.[dKey]?.[gfKey];
      const lastIdx = cell ? cell.P.mean.length - 1 : -1;
      return {
        scaleKey,
        scaleL: Number(scaleKey),
        role: ROLE_BY_INDEX[i] ?? "",
        F: cell ? cell.F : 0,
        Pend: cell && lastIdx >= 0 ? cell.P.mean[lastIdx] : null,
        Pstd: cell && lastIdx >= 0 ? cell.P.std[lastIdx] : null,
        Xend: cell && lastIdx >= 0 ? cell.X.mean[lastIdx] : null,
        color: scaleColor(i, grid.scaleKeys.length),
      };
    });
  }, [grid, dKey, gfKey]);

  return (
    <div className="px-10 py-10 max-w-[1360px] mx-auto">
      <div className="flex items-start justify-between gap-6">
        <SectionTitle
          title="What-if simulations"
          sub="The trained hybrid model predicts impact on biomass and lactic acid production at 4 different scales when we vary the dilution rate and feed composition."
        />
        {/* <Pill tone={modelFitted ? "accent" : "muted"}>
          <span className={cn("w-1.5 h-1.5 rounded-full", modelFitted ? "bg-accent" : "bg-muted-soft")} />
          {modelFitted ? "Hybrid model loaded" : "Reference model"}
        </Pill> */}
      </div>

      <AnimatePresence mode="wait">
        {!grid || !fleetCells ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-10 text-[13px] text-muted"
          >
            Loading simulator grid…
          </motion.div>
        ) : (
          <motion.div
            key="ready"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            className="mt-8 flex flex-col gap-5"
          >
            {/* ── Reactor fleet strip ──────────────────────────────────── */}
            <div className="rounded-2xl bg-canvas-raised border border-hairline overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-hairline">
                <div className="text-[11px] uppercase tracking-[0.12em] text-muted">
                  Reactor fleet
                </div>
                <span className="text-[10.5px] text-muted-soft tabular">
                  schematics · not to scale · four working volumes
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-hairline/60">
                {fleetCells.map((c, idx) => {
                  const isExtrapolation = idx === fleetCells.length - 1;
                  // Visual size scales logarithmically — 10 L is the smallest,
                  // 150 m³ fills the card. Honest differentiation.
                  const sizeFrac =
                    0.7 + 0.3 * (Math.log10(Math.max(1, c.scaleL)) / Math.log10(150000));
                  return (
                    <div
                      key={c.scaleKey}
                      className="bg-canvas-raised px-3 pt-3 pb-4 flex flex-col relative"
                    >
                      <div className="flex items-baseline justify-between px-1 mb-1">
                        <div className="flex items-baseline gap-1.5">
                          <span className="serif text-[15px] text-ink">{formatScale(c.scaleL)}</span>
                          <span className="text-[10.5px] tabular text-muted-soft">
                            {c.scaleL.toLocaleString()} L
                          </span>
                        </div>
                        <span className="text-[10px] uppercase tracking-[0.12em] text-muted-soft">
                          {c.role}
                        </span>
                      </div>

                      <div className={cn(
                        "flex-1 flex items-end justify-center bg-canvas rounded-lg py-3 px-1",
                        isExtrapolation && "opacity-40 grayscale"
                      )}>
                        <div style={{ width: `${sizeFrac * 100}%`, maxWidth: 240 }}>
                          <Reactor
                            scaleL={c.scaleL}
                            D={D}
                            GF={GF}
                            F={c.F}
                            compact
                            showReadout={false}
                          />
                        </div>
                      </div>

                      {isExtrapolation && (
                        <span className="mt-2 self-start text-[9px] uppercase tracking-[0.12em] text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 font-medium">
                          extrapolation
                        </span>
                      )}

                      {/* Per-reactor KPIs: inputs and predicted outputs at t=75h */}
                      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 px-1">
                        <KPI label="Feed rate" value={formatFlowrate(c.F)} />
                        <KPI
                          label="Lactic acid · 75 h"
                          value={c.Pend != null ? `${c.Pend.toFixed(1)} g/L` : "—"}
                          sub={c.Pstd != null ? `±${(2 * c.Pstd).toFixed(2)}` : undefined}
                          accent
                        />
                        <KPI
                          label="Biomass · 75 h"
                          value={c.Xend != null ? `${c.Xend.toFixed(1)} g/L` : "—"}
                        />
                      </div>
                      <div className="mt-2 h-0.5 rounded-full"
                        style={{ background: c.color, opacity: 0.65 }} />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Controls (D, GF) shared across fleet ─────────────────── */}
            <div className="rounded-2xl bg-canvas-raised border border-hairline p-5">
              <div className="flex items-baseline justify-between mb-4">
                <div className="text-[11px] uppercase tracking-[0.12em] text-muted">
                  Controls
                </div>
                <span className="text-[10.5px] text-muted-soft">applies to all four reactors</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SliderRow
                  label="Dilution rate (D)"
                  unit="h⁻¹"
                  display={D.toFixed(4)}
                  max={grid.dKeys.length - 1}
                  index={dIdx}
                  onChange={setDIdx}
                  minLabel={Number(grid.dKeys[0]).toFixed(4)}
                  maxLabel={Number(grid.dKeys[grid.dKeys.length - 1]).toFixed(4)}
                />
                <SliderRow
                  label="Glucose fraction (GF)"
                  unit=""
                  display={GF.toFixed(2)}
                  max={grid.gfKeys.length - 1}
                  index={gfIdx}
                  onChange={setGfIdx}
                  minLabel={Number(grid.gfKeys[0]).toFixed(2)}
                  maxLabel={Number(grid.gfKeys[grid.gfKeys.length - 1]).toFixed(2)}
                />
              </div>

              {/* Initial conditions strip */}
              <div className="mt-5 pt-4 border-t border-hairline flex flex-wrap items-baseline gap-x-5 gap-y-1 text-[11.5px] tabular">
                <span className="text-[10px] uppercase tracking-[0.12em] text-muted">Initial conditions</span>
                <IcItem label="X₀" value={`${grid.meta.fixed_ICs.X0.toFixed(1)} g/L`} />
                <IcItem label="P₀" value={`${grid.meta.fixed_ICs.P0.toFixed(1)} g/L`} />
                <IcItem label="O₂" value={`${grid.meta.fixed_ICs.O2_0.toFixed(3)} mg/L`} />
                <IcItem label="Σsub" value={`${grid.meta.fixed_ICs.total_sub.toFixed(0)} g/L`} />
                <IcItem label="feed C" value={`${grid.meta.fixed_ICs.C_feed_total.toFixed(0)} g/L`} />
              </div>
            </div>

            {/* ── Collapsible trajectory panel ─────────────────────────── */}
            <div className="rounded-2xl bg-canvas-raised border border-hairline overflow-hidden">
              <button
                onClick={() => setShowPlots((v) => !v)}
                className="press w-full flex items-center justify-between px-5 py-4 text-left hover:bg-canvas-raised/60 transition-colors"
              >
                <div>
                  <div className="text-[11px] uppercase tracking-[0.12em] text-muted">
                    Predicted trajectories
                  </div>
                  <div className="serif text-[15px] text-ink mt-0.5">
                    {showPlots ? "Hide" : "Show"} species curves across scales
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-muted-soft tabular">
                    {showPlots ? "4 species × 4 scales overlaid" : "collapsed"}
                  </span>
                  <motion.svg
                    viewBox="0 0 16 16" width="14" height="14"
                    fill="none" stroke="currentColor" strokeWidth="1.8"
                    strokeLinecap="round" strokeLinejoin="round"
                    className="text-muted"
                    animate={{ rotate: showPlots ? 180 : 0 }}
                    transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                  >
                    <path d="M4 6l4 4 4-4" />
                  </motion.svg>
                </div>
              </button>

              <AnimatePresence initial={false}>
                {showPlots && (
                  <motion.div
                    key="plots"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.34, ease: [0.23, 1, 0.32, 1] }}
                    className="overflow-hidden border-t border-hairline"
                  >
                    <div className="px-5 py-5 bg-canvas">
                      {/* Legend */}
                      <div className="flex flex-wrap items-center gap-4 mb-4 text-[11px] tabular">
                        <span className="text-muted uppercase tracking-[0.1em] text-[10.5px]">Scales</span>
                        {fleetCells.map((c) => (
                          <span key={c.scaleKey} className="inline-flex items-center gap-1.5 text-ink-soft">
                            <span className="inline-block w-4 h-[2.5px] rounded-full"
                              style={{ background: c.color }} />
                            {formatScale(c.scaleL)}
                          </span>
                        ))}
                        <span className="text-muted-soft">· Production (150 m³) shown dashed — extrapolation</span>
                      </div>

                      <FleetTrajectory grid={grid} dKey={dKey!} gfKey={gfKey!} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-8 flex justify-end">
        <Button onClick={() => setSurface("scenario2")}>
          See anomaly rescue →
        </Button>
      </div>
    </div>
  );
}

function formatScale(l: number): string {
  if (l >= 1000) return `${(l / 1000).toLocaleString()} m³`;
  return `${l} L`;
}

function formatFlowrate(f: number): string {
  if (f >= 100) return `${f.toFixed(0)} L/h`;
  if (f >= 1) return `${f.toFixed(2)} L/h`;
  return `${f.toFixed(3)} L/h`;
}

function IcItem({ label, value }: { label: string; value: string }) {
  return (
    <span className="text-muted">
      <span className="text-muted-soft">{label}</span>{" "}
      <span className="text-ink">{value}</span>
    </span>
  );
}

function KPI({
  label, value, sub, accent,
}: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="flex flex-col min-w-0">
      <span className="text-[9.5px] uppercase tracking-[0.1em] text-muted-soft leading-none">
        {label}
      </span>
      <span className={cn(
        "tabular text-[12px] leading-tight mt-1 truncate",
        accent ? "text-accent" : "text-ink",
      )}>
        {value}
        {sub && <span className="text-muted-soft text-[10px] ml-1">{sub}</span>}
      </span>
    </div>
  );
}

function SliderRow({
  label,
  unit,
  display,
  max,
  index,
  onChange,
  minLabel,
  maxLabel,
}: {
  label: string;
  unit: string;
  display: string;
  max: number;
  index: number;
  onChange: (v: number) => void;
  minLabel: string;
  maxLabel: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <div className="text-[11.5px] text-muted">{label}</div>
        <div className="tabular serif text-[18px] text-ink">
          {display}
          {unit && <span className="text-[11px] ml-1 text-muted-soft">{unit}</span>}
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={max}
        step={1}
        value={index}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[color:var(--color-ink)]"
      />
      <div className="flex justify-between tabular text-[10.5px] text-muted-soft mt-1">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}
