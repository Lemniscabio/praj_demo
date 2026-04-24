import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SectionTitle, Pill, Button } from "../components/ui";
import { WhatIfPlot } from "../components/WhatIfPlot";
import { loadWhatIfGrid, type WhatIfGrid } from "../lib/whatif";
import { useApp } from "../lib/store";
import { cn } from "../lib/cn";

export function Scenario1Surface() {
  const modelFitted = useApp((s) => s.modelFitted);
  const setSurface = useApp((s) => s.setSurface);

  const [grid, setGrid] = useState<WhatIfGrid | null>(null);
  const [scaleIdx, setScaleIdx] = useState(0);
  const [dIdx, setDIdx] = useState(0);
  const [gfIdx, setGfIdx] = useState(0);

  useEffect(() => {
    loadWhatIfGrid().then((g) => {
      setGrid(g);
      // Default to the production-scale reactor and the middle of each grid axis.
      const prod = g.scaleKeys.findIndex((k) => Number(k) === 10000);
      setScaleIdx(prod >= 0 ? prod : 0);
      setDIdx(Math.floor(g.dKeys.length / 2));
      setGfIdx(Math.floor(g.gfKeys.length / 2));
    });
  }, []);

  const scaleKey = grid?.scaleKeys[scaleIdx];
  const dKey = grid?.dKeys[dIdx];
  const gfKey = grid?.gfKeys[gfIdx];

  const cell = useMemo(() => {
    if (!grid || !scaleKey || !dKey || !gfKey) return null;
    return grid.cells[scaleKey][dKey][gfKey];
  }, [grid, scaleKey, dKey, gfKey]);

  const D = dKey ? Number(dKey) : 0;
  const GF = gfKey ? Number(gfKey) : 0;
  const scale = scaleKey ? Number(scaleKey) : 0;

  return (
    <div className="px-10 py-10 max-w-[1360px] mx-auto">
      <div className="flex items-start justify-between gap-6">
        <SectionTitle
          eyebrow="Scenario 01"
          title="What-if simulator"
          sub="Explore predicted batch trajectories across reactor scale, dilution rate, and glucose fraction. Trajectories are drawn as mean ± 2σ bands."
        />
        <Pill tone={modelFitted ? "accent" : "muted"}>
          <span className={cn("w-1.5 h-1.5 rounded-full", modelFitted ? "bg-accent" : "bg-muted-soft")} />
          {modelFitted ? "Hybrid model loaded" : "Reference model"}
        </Pill>
      </div>

      <AnimatePresence mode="wait">
        {!grid || !cell ? (
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
            className="mt-8 grid grid-cols-12 gap-6"
          >
            {/* Plots */}
            <div className="col-span-12 lg:col-span-8">
              <div className="rounded-2xl bg-canvas-raised border border-hairline overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-hairline">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.12em] text-muted">Simulated trajectories</div>
                    <div className="serif text-[17px] text-ink leading-tight mt-0.5">
                      {formatScale(scale)} · D {D.toFixed(4)} h⁻¹ · GF {GF.toFixed(2)}
                    </div>
                    <div className="text-[11.5px] text-muted tabular mt-0.5">
                      Feed F = {cell.F.toFixed(3)} L/h
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-soft tabular">
                    <span className="inline-block w-3 h-[2px] rounded-full bg-ink/40" />
                    mean
                    <span className="inline-block w-3 h-2 rounded-sm bg-ink/10 ml-2" />
                    ±2σ
                  </span>
                </div>
                <div className="p-5 bg-canvas">
                  <WhatIfPlot cell={cell} time={grid.time} />
                </div>
              </div>
            </div>

            {/* Controls + context */}
            <div className="col-span-12 lg:col-span-4 flex flex-col gap-4">
              <div className="rounded-2xl bg-canvas-raised border border-hairline p-5">
                <div className="text-[11px] uppercase tracking-[0.12em] text-muted mb-3">Controls</div>

                <div>
                  <div className="flex items-baseline justify-between mb-2">
                    <div className="text-[11.5px] text-muted">Reactor scale</div>
                    <div className="tabular serif text-[16px] text-ink">{formatScale(scale)}</div>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {grid.scaleKeys.map((k, i) => (
                      <button
                        key={k}
                        onClick={() => setScaleIdx(i)}
                        className={cn(
                          "press tabular h-7 px-2.5 rounded-full border text-[11.5px] transition-colors",
                          i === scaleIdx
                            ? "bg-ink text-canvas border-ink"
                            : "bg-canvas text-ink-soft border-hairline hover:border-hairline-strong"
                        )}
                      >
                        {formatScale(Number(k))}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-px bg-hairline my-4" />

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

                <div className="h-px bg-hairline my-4" />

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

              <div className="rounded-2xl bg-canvas-raised border border-hairline p-5">
                <div className="text-[11px] uppercase tracking-[0.12em] text-muted mb-3">Initial conditions</div>
                <div className="space-y-2.5 text-[13px]">
                  <Row label="Biomass X₀" value={`${grid.meta.fixed_ICs.X0.toFixed(1)} g/L`} />
                  <Row label="Lactic acid P₀" value={`${grid.meta.fixed_ICs.P0.toFixed(1)} g/L`} />
                  <Row label="Dissolved O₂" value={`${grid.meta.fixed_ICs.O2_0.toFixed(3)} mg/L`} />
                  <Row label="Total substrate" value={`${grid.meta.fixed_ICs.total_sub.toFixed(0)} g/L`} />
                  <Row label="Feed concentration" value={`${grid.meta.fixed_ICs.C_feed_total.toFixed(0)} g/L`} />
                </div>
                <p className="mt-4 text-[11px] text-muted-soft leading-relaxed">
                  Fixed from the dataset metadata. Only scale, D, and GF vary across the grid.
                </p>
              </div>
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between tabular">
      <span className="text-muted">{label}</span>
      <span className="text-ink">{value}</span>
    </div>
  );
}
