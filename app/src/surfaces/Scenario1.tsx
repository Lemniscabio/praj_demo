import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SectionTitle, Button, Pill } from "../components/ui";
import { BatchPlot, type Point } from "../components/BatchPlot";
import { loadCSV } from "../lib/csv";
import { useApp } from "../lib/store";
import { cn } from "../lib/cn";

type Phase = "setup" | "ready" | "playing" | "anomaly" | "intervention" | "compare";

type ICs = { temperature: string; substrate: string; biomass: string };

// Distinct, still-soft palette so the 4 curves don't blur together.
// 1.0×  = warm clay (worst / "no change")
// 0.8×  = muted ochre
// 0.6×  = slate blue
// 0.5×  = sage (recommended)
const INTERVENTIONS: {
  id: string;
  file: string;
  label: string;
  detail: string;
  color: string;
  dot: string;
  /** SVG strokeDasharray — distinct pattern per line for easy visual separation */
  dash: string;
  recommended?: boolean;
}[] = [
  // Bold, distinct hues (red · orange · blue · green) — matplotlib Tab10 style
  { id: "1.0", file: "/data/scenario_1.0x_F.csv", label: "No change", detail: "Feed at 1.0× — maintain current flowrate", color: "#D62728", dot: "#D62728", dash: "2 4" },
  { id: "0.8", file: "/data/scenario_0.8x_F.csv", label: "Reduce feed 20%", detail: "Feed at 0.8× — gentle correction", color: "#FF7F0E", dot: "#FF7F0E", dash: "7 3" },
  { id: "0.6", file: "/data/scenario_0.6x_F.csv", label: "Reduce feed 40%", detail: "Feed at 0.6× — stronger correction", color: "#1F77B4", dot: "#1F77B4", dash: "10 3 2 3" },
  { id: "0.5", file: "/data/scenario_0.5x_F.csv", label: "Reduce feed 50%", detail: "Feed at 0.5× — restores growth rate", color: "#2CA02C", dot: "#2CA02C", dash: "0", recommended: true },
];

export function Scenario1Surface() {
  const modelFitted = useApp((s) => s.modelFitted);

  const [ics, setICs] = useState<ICs>({ temperature: "37", substrate: "120", biomass: "0.8" });

  const [phase, setPhase] = useState<Phase>("setup");
  const [system, setSystem] = useState<"lactic" | "isobutanol" | "phb">("lactic");
  const [noisyIdx, setNoisyIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>("");

  const [golden, setGolden] = useState<Point[]>([]);
  const [noisy, setNoisy] = useState<Point[]>([]);
  const [predictions, setPredictions] = useState<Record<string, Point[]>>({});

  useEffect(() => {
    loadCSV<{ "Time (h)": number; "Lactic Acid P (g/L)": number }>("/data/golden_batch_trajectory.csv").then((rows) =>
      setGolden(rows.map((r) => ({ t: r["Time (h)"], p: r["Lactic Acid P (g/L)"] })))
    );
    loadCSV<{ "Time (h)": number; "Lactic Acid P (g/L)": number }>("/data/suboptimal_noisy_measurements.csv").then((rows) =>
      setNoisy(rows.map((r) => ({ t: r["Time (h)"], p: r["Lactic Acid P (g/L)"] })))
    );
    Promise.all(
      INTERVENTIONS.map((iv) =>
        loadCSV<{ "Time (h)": number; "Lactic Acid P (g/L)": number }>(iv.file).then(
          (rows) => [iv.id, rows.map((r) => ({ t: r["Time (h)"], p: r["Lactic Acid P (g/L)"] }))] as const
        )
      )
    ).then((pairs) => setPredictions(Object.fromEntries(pairs)));
  }, []);

  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (phase !== "playing") return;
    const start = performance.now();
    const total = noisy.length;
    const duration = 3200;
    const step = () => {
      const t = Math.min(1, (performance.now() - start) / duration);
      setNoisyIdx(Math.floor(t * total));
      if (t < 1) rafRef.current = requestAnimationFrame(step);
      else {
        setNoisyIdx(total);
        setPhase("anomaly");
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [phase, noisy.length]);

  const handlePlay = () => { setPhase("playing"); setNoisyIdx(0); };
  const handleSelect = (id: string) => { setSelected(id); setPhase("intervention"); };
  const handleReset = () => { setSelected(""); setPhase("anomaly"); };
  const handleCompare = () => { setSelected(null); setPhase("compare"); };

  const predictionList = useMemo(
    () => INTERVENTIONS.map((iv) => ({
      id: iv.id,
      label: iv.label,
      color: iv.color,
      dash: iv.dash,
      points: predictions[iv.id] ?? [],
      recommended: iv.recommended,
    })),
    [predictions]
  );

  const showingPredictions = phase === "intervention" || phase === "compare";

  const selectedIv = INTERVENTIONS.find((i) => i.id === selected);

  // Compute actual endpoint delta vs golden for narrative pill
  const goldenEnd = golden[golden.length - 1]?.p;
  const selectedEnd = selected && predictions[selected] ? predictions[selected][predictions[selected].length - 1]?.p : undefined;
  const endpointDelta = goldenEnd != null && selectedEnd != null ? Math.abs(goldenEnd - selectedEnd) : null;

  const SYSTEM_LABEL = { lactic: "Lactic acid", isobutanol: "Isobutanol", phb: "PHB" } as const;

  return (
    <div className="px-10 py-10 max-w-[1360px] mx-auto">
      <div className="flex items-start justify-between gap-6">
        <SectionTitle
          eyebrow="Scenario 01"
          title="Batch tracking in production"
          sub="Watch a live fermentation against its golden trajectory. When measurements drift, decide how to intervene."
        />
        <Pill tone={modelFitted ? "accent" : "muted"}>
          <span className={cn("w-1.5 h-1.5 rounded-full", modelFitted ? "bg-accent" : "bg-muted-soft")} />
          {modelFitted ? "Hybrid model loaded" : "Reference model"}
        </Pill>
      </div>

      <AnimatePresence mode="wait">
        {phase === "setup" ? (
          <motion.div
            key="setup"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            className="mt-10 max-w-[680px] mx-auto"
          >
            <div className="rounded-2xl bg-canvas-raised border border-hairline p-8">
              <div className="text-[11px] uppercase tracking-[0.12em] text-muted">Configure the batch</div>
              <h3 className="serif text-[22px] text-ink mt-1 leading-tight">
                Pick a system and set the initial conditions.
              </h3>
              <p className="text-[13px] text-muted mt-2 max-w-[52ch] leading-relaxed">
                We&rsquo;ll project the golden trajectory for this configuration, then you can run the live batch against it.
              </p>

              <div className="mt-7">
                <div className="text-[11px] uppercase tracking-[0.12em] text-muted mb-2">Biological system</div>
                <div className="relative">
                  <select
                    value={system}
                    onChange={(e) => setSystem(e.target.value as "lactic" | "isobutanol" | "phb")}
                    className="appearance-none w-full h-11 pl-4 pr-10 rounded-xl bg-canvas border border-hairline text-[14px] text-ink hover:border-hairline-strong transition-colors focus:outline-none focus:border-ink/40"
                  >
                    <option value="lactic">Lactic acid</option>
                    <option value="isobutanol" disabled>Isobutanol — coming soon</option>
                    <option value="phb" disabled>PHB — coming soon</option>
                  </select>
                  <svg viewBox="0 0 16 16" width="14" height="14" className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M4 6l4 4 4-4" /></svg>
                </div>
              </div>

              <div className="mt-6">
                <div className="text-[11px] uppercase tracking-[0.12em] text-muted mb-2">Initial conditions</div>
                <div className="grid grid-cols-3 gap-3">
                  <ICField label="Temp" unit="°C" placeholder="37" value={ics.temperature} onChange={(v) => setICs({ ...ics, temperature: v })} />
                  <ICField label="Substrate" unit="g/L" placeholder="120" value={ics.substrate} onChange={(v) => setICs({ ...ics, substrate: v })} />
                  <ICField label="Biomass" unit="g/L" placeholder="0.8" value={ics.biomass} onChange={(v) => setICs({ ...ics, biomass: v })} />
                </div>
                <p className="mt-3 text-[11.5px] text-muted-soft leading-relaxed">
                  Pre-filled with the reference batch. Adjust or continue as-is.
                </p>
              </div>

              <div className="mt-8 flex justify-end">
                <Button onClick={() => setPhase("ready")} disabled={!ics.temperature || !ics.substrate || !ics.biomass}>
                  Project golden trajectory →
                </Button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="run"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.23, 1, 0.32, 1] }}
            className="mt-8 grid grid-cols-12 gap-6"
          >
        <div className="col-span-12 lg:col-span-8">
          <div className="rounded-2xl bg-canvas-raised border border-hairline overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-hairline">
              <div>
                <div className="text-[11px] uppercase tracking-[0.12em] text-muted">Bioreactor · vessel 3</div>
                <div className="serif text-[17px] text-ink leading-tight mt-0.5">Lactic acid (P) vs time</div>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[11.5px] text-muted tabular">
                <span className="inline-block w-4 h-[2.5px] rounded-full" style={{ background: "#4E8B73" }} />
                Golden batch
              </span>
            </div>
            <div className="px-4 py-3 bg-canvas">
              <BatchPlot
                golden={golden}
                noisy={noisy}
                noisyVisibleCount={noisyIdx}
                predictions={showingPredictions ? predictionList : []}
                selectedScenario={phase === "intervention" ? selected : phase === "compare" ? null : ""}
                showNowLine={phase === "playing"}
                nowLineAt={noisy[noisyIdx - 1]?.t ?? 0}
                anomaly={phase === "anomaly" || phase === "intervention" || phase === "compare"}
              />
            </div>

            <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-t border-hairline bg-canvas-raised">
              <div className="text-[12px] text-muted tabular">
                {phase === "ready" && "Golden trajectory projected. Press Play to start the batch."}
                {phase === "playing" && `Streaming · t = ${(noisy[noisyIdx - 1]?.t ?? 0).toFixed(1)} h`}
                {phase === "anomaly" && "Anomaly at t = 15 h · feed composition drift (maltose/glucose). Select an intervention."}
                {phase === "intervention" && selectedIv && (
                  <>Projecting {selectedIv.label} · endpoint{" "}
                    {endpointDelta != null && (
                      <span className={cn("tabular", selectedIv.recommended ? "text-accent" : "text-ink-soft")}>
                        {endpointDelta.toFixed(2)} g/L from golden
                      </span>
                    )}
                  </>
                )}
                {phase === "compare" && "Comparing all four interventions."}
              </div>
              <div className="flex items-center gap-2">
                {phase === "ready" && (
                  <Button onClick={handlePlay}>
                    <svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor"><path d="M4 3v10l9-5z"/></svg>
                    Play
                  </Button>
                )}
                {(phase === "intervention" || phase === "compare") && (
                  <>
                    <Button variant="ghost" size="sm" onClick={handleCompare} disabled={phase === "compare"}>
                      Compare all
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleReset}>
                      Try another
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>

        </div>

        <div className="col-span-12 lg:col-span-4 flex flex-col gap-4">
          <div className="rounded-2xl bg-canvas-raised border border-hairline p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[11px] uppercase tracking-[0.12em] text-muted">Current batch</div>
              <button
                onClick={() => setPhase("setup")}
                className="press text-[11px] text-muted hover:text-ink transition-colors"
              >
                Reconfigure
              </button>
            </div>
            <div className="space-y-2.5 text-[13px]">
              <div className="flex items-center justify-between">
                <span className="text-muted">System</span>
                <span className="text-ink">{SYSTEM_LABEL[system]}</span>
              </div>
              <div className="h-px bg-hairline" />
              <div className="flex items-center justify-between tabular">
                <span className="text-muted">Temperature</span>
                <span className="text-ink">{ics.temperature} <span className="text-muted-soft">°C</span></span>
              </div>
              <div className="flex items-center justify-between tabular">
                <span className="text-muted">Substrate</span>
                <span className="text-ink">{ics.substrate} <span className="text-muted-soft">g/L</span></span>
              </div>
              <div className="flex items-center justify-between tabular">
                <span className="text-muted">Biomass</span>
                <span className="text-ink">{ics.biomass} <span className="text-muted-soft">g/L</span></span>
              </div>
            </div>
          </div>

          <AnimatePresence>
            {(phase === "anomaly" || phase === "intervention" || phase === "compare") && (
              <motion.div
                key="tray"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.34, ease: [0.32, 0.72, 0, 1] }}
                className="rounded-2xl bg-canvas-raised border border-hairline p-4"
              >
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="text-[11px] uppercase tracking-[0.12em] text-muted">Interventions</div>
                  <div className="text-[10.5px] text-muted-soft tabular">Feed flowrate</div>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {INTERVENTIONS.map((iv, i) => {
                    const isSelected = selected === iv.id;
                    return (
                      <motion.button
                        key={iv.id}
                        onClick={() => handleSelect(iv.id)}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.28, delay: 0.04 + i * 0.04, ease: [0.23, 1, 0.32, 1] }}
                        className={cn(
                          "press text-left rounded-xl border p-3 transition-all duration-200 relative overflow-hidden",
                          isSelected && iv.recommended && "bg-accent-wash border-accent ring-2 ring-accent/30",
                          isSelected && !iv.recommended && "border-2",
                          !isSelected && iv.recommended && "bg-accent-wash/60 border-accent",
                          !isSelected && !iv.recommended && "bg-canvas border-hairline hover:border-hairline-strong"
                        )}
                        style={
                          isSelected && !iv.recommended
                            ? { borderColor: iv.color, background: `${iv.color}12` }
                            : undefined
                        }
                      >
                        {iv.recommended && (
                          <span className="absolute -top-px -right-px inline-flex items-center gap-1 h-5 px-2 rounded-bl-lg rounded-tr-xl bg-accent text-canvas text-[9.5px] font-semibold tracking-[0.06em] uppercase">
                            <svg viewBox="0 0 12 12" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 6.5 5 9l4.5-5" /></svg>
                            Best
                          </span>
                        )}
                        <div className="flex items-center gap-2">
                          <span className="inline-block w-3 h-[3px] rounded-sm shrink-0" style={{ background: iv.color }} />
                          <span className="tabular text-[11px]" style={{ color: iv.color }}>Feed × {iv.id}</span>
                        </div>
                        <div className="serif text-[13.5px] text-ink mt-1.5 leading-tight">{iv.label}</div>
                        <div className="text-[11px] text-muted mt-1 leading-snug line-clamp-2">
                          {iv.detail.split("—")[1]?.trim() ?? iv.detail}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ICField({
  label, unit, placeholder, value, onChange,
}: { label: string; unit: string; placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <div className="text-[10.5px] text-muted tracking-wide uppercase mb-1">{label}</div>
      <div className="relative">
        <input
          inputMode="decimal"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-10 pl-2.5 pr-9 rounded-lg bg-canvas border border-hairline tabular text-[13px] text-ink placeholder:text-muted-soft focus:outline-none focus:border-ink/30 transition-colors"
        />
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10.5px] text-muted-soft">{unit}</span>
      </div>
    </label>
  );
}
