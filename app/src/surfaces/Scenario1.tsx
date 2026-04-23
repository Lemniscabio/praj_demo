import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SectionTitle, Pill, Button } from "../components/ui";
import { WhatIfPlot } from "../components/WhatIfPlot";
import { loadWhatIfGrid, type WhatIfGrid } from "../lib/whatif";
import { useApp } from "../lib/store";
import { cn } from "../lib/cn";

// Fixed initial conditions from the README.
const INITIAL = {
  temperature: 37,   // °C
  biomass: 2.0,      // g/L (X₀)
  totalSubstrate: 140, // g/L — glucose + maltose combined
};

export function Scenario1Surface() {
  const modelFitted = useApp((s) => s.modelFitted);
  const setSurface = useApp((s) => s.setSurface);

  const [grid, setGrid] = useState<WhatIfGrid | null>(null);
  const [flowIdx, setFlowIdx] = useState(0); // index into grid.flowKeys
  const [ratioIdx, setRatioIdx] = useState(0); // index into grid.ratioKeys

  useEffect(() => {
    loadWhatIfGrid().then((g) => {
      setGrid(g);
      // Default to the middle of each axis.
      setFlowIdx(Math.floor(g.flowKeys.length / 2));
      setRatioIdx(Math.floor(g.ratioKeys.length / 2));
    });
  }, []);

  const flowKey = grid?.flowKeys[flowIdx];
  const ratioKey = grid?.ratioKeys[ratioIdx];
  const cell = useMemo(() => {
    if (!grid || !flowKey || !ratioKey) return null;
    return grid.cells[flowKey][ratioKey];
  }, [grid, flowKey, ratioKey]);

  const flowrate = flowKey ? Number(flowKey) : 0;
  const ratio = ratioKey ? Number(ratioKey) : 0;

  return (
    <div className="px-10 py-10 max-w-[1360px] mx-auto">
      <div className="flex items-start justify-between gap-6">
        <SectionTitle
          eyebrow="Scenario 01"
          title="What-if simulator"
          sub="Explore predicted batch trajectories across feed flowrate and glucose / maltose ratio. Trajectories are drawn as mean ± 2σ bands."
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
                      Feed {flowrate.toFixed(3)} L/h · G/M ratio {ratio.toFixed(2)}
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

                <SliderRow
                  label="Feed flowrate"
                  unit="L/h"
                  value={flowrate}
                  display={flowrate.toFixed(3)}
                  min={0}
                  max={grid.flowKeys.length - 1}
                  step={1}
                  index={flowIdx}
                  onChange={setFlowIdx}
                  minLabel={Number(grid.flowKeys[0]).toFixed(2)}
                  maxLabel={Number(grid.flowKeys[grid.flowKeys.length - 1]).toFixed(2)}
                />

                <div className="h-px bg-hairline my-4" />

                <SliderRow
                  label="Glucose / maltose ratio"
                  unit=""
                  value={ratio}
                  display={ratio.toFixed(2)}
                  min={0}
                  max={grid.ratioKeys.length - 1}
                  step={1}
                  index={ratioIdx}
                  onChange={setRatioIdx}
                  minLabel={Number(grid.ratioKeys[0]).toFixed(2)}
                  maxLabel={Number(grid.ratioKeys[grid.ratioKeys.length - 1]).toFixed(2)}
                />
              </div>

              <div className="rounded-2xl bg-canvas-raised border border-hairline p-5">
                <div className="text-[11px] uppercase tracking-[0.12em] text-muted mb-3">Initial conditions</div>
                <div className="space-y-2.5 text-[13px]">
                  <Row label="Temperature" value={`${INITIAL.temperature} °C`} />
                  <Row label="Biomass X₀" value={`${INITIAL.biomass.toFixed(1)} g/L`} />
                  <Row label="Total substrate" value={`${INITIAL.totalSubstrate} g/L`} />
                </div>
                <p className="mt-4 text-[11px] text-muted-soft leading-relaxed">
                  Fixed per the dataset README. Only feed flowrate and glucose / maltose ratio vary across the grid.
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

function SliderRow({
  label,
  unit,
  display,
  min,
  max,
  step,
  index,
  onChange,
  minLabel,
  maxLabel,
}: {
  label: string;
  unit: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
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
        min={min}
        max={max}
        step={step}
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
