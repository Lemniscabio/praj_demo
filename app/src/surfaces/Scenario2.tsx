import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SectionTitle, Button, Pill } from "../components/ui";
import { BatchPlot, type Point } from "../components/BatchPlot";
import { loadCSV } from "../lib/csv";
import { useApp } from "../lib/store";
import { cn } from "../lib/cn";

type Phase = "ready" | "playing" | "anomaly" | "intervention" | "compare";

// Five feed flowrate interventions per README — each provided with an error
// envelope (upper/lower 95 %). 0.6× is the recommended action.
const INTERVENTIONS: {
  id: string;
  mult: number;
  file: string;
  label: string;
  detail: string;
  color: string;
  recommended?: boolean;
}[] = [
  { id: "0.6", mult: 0.6, file: "/data/scenario_rnn_0.6x_F.csv", label: "Reduce feed 40%", detail: "0.6× — recommended rescue", color: "#2CA02C", recommended: true },
  { id: "0.8", mult: 0.8, file: "/data/scenario_rnn_0.8x_F.csv", label: "Reduce feed 20%", detail: "0.8× — gentle correction",   color: "#1F77B4" },
  { id: "1",   mult: 1.0, file: "/data/scenario_rnn_1x_F.csv",   label: "No change",       detail: "1.0× — maintain current",    color: "#D62728" },
  { id: "1.2", mult: 1.2, file: "/data/scenario_rnn_1.2x_F.csv", label: "Increase feed 20%", detail: "1.2× — push feed up",      color: "#FF7F0E" },
  { id: "1.4", mult: 1.4, file: "/data/scenario_rnn_1.4x_F.csv", label: "Increase feed 40%", detail: "1.4× — strongest push",    color: "#9467BD" },
];

type RowTraj = {
  "Time (h)": number;
  "P_mean (g/L)": number;
  "P_std (g/L)": number;
  "P_lower95 (g/L)": number;
  "P_upper95 (g/L)": number;
};

function rowsToPoints(rows: RowTraj[]): Point[] {
  return rows.map((r) => ({
    t: r["Time (h)"],
    p: r["P_mean (g/L)"],
    lo: r["P_lower95 (g/L)"],
    hi: r["P_upper95 (g/L)"],
  }));
}

export function Scenario2Surface() {
  const modelFitted = useApp((s) => s.modelFitted);

  const [phase, setPhase] = useState<Phase>("ready");
  const [noisyIdx, setNoisyIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>("");

  const [golden, setGolden] = useState<Point[]>([]);
  const [noisy, setNoisy] = useState<Point[]>([]);
  const [predictions, setPredictions] = useState<Record<string, Point[]>>({});

  useEffect(() => {
    loadCSV<RowTraj>("/data/golden_batch_trajectory.csv").then((rows) => setGolden(rowsToPoints(rows)));
    loadCSV<{ "Time (h)": number; "Lactic Acid P (g/L)": number }>("/data/suboptimal_noisy_measurements.csv").then((rows) =>
      setNoisy(rows.map((r) => ({ t: r["Time (h)"], p: r["Lactic Acid P (g/L)"] })))
    );
    Promise.all(
      INTERVENTIONS.map((iv) =>
        loadCSV<RowTraj>(iv.file).then((rows) => [iv.id, rowsToPoints(rows)] as const)
      )
    ).then((pairs) => setPredictions(Object.fromEntries(pairs)));
  }, []);

  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (phase !== "playing") return;
    const start = performance.now();
    const total = noisy.length;
    const duration = 5800;
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
      points: predictions[iv.id] ?? [],
      recommended: iv.recommended,
    })),
    [predictions]
  );

  const showingPredictions = phase === "intervention" || phase === "compare";
  const selectedIv = INTERVENTIONS.find((i) => i.id === selected);
  const goldenEnd = golden[golden.length - 1]?.p;
  const selectedEnd = selected && predictions[selected] ? predictions[selected][predictions[selected].length - 1]?.p : undefined;
  const endpointDelta = goldenEnd != null && selectedEnd != null ? Math.abs(goldenEnd - selectedEnd) : null;

  return (
    <div className="px-10 py-10 max-w-[1360px] mx-auto">
      <div className="flex items-start justify-between gap-6">
        <SectionTitle
          eyebrow="Scenario 02"
          title="Anomaly rescue"
          sub="A live batch drifts from the golden trajectory at t = 15 h. Compare rescue actions on feed flowrate and pick one."
        />
        <Pill tone={modelFitted ? "accent" : "muted"}>
          <span className={cn("w-1.5 h-1.5 rounded-full", modelFitted ? "bg-accent" : "bg-muted-soft")} />
          {modelFitted ? "Hybrid model loaded" : "Reference model"}
        </Pill>
      </div>

      <motion.div
        key="run"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
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
              <div className="flex items-center gap-3 text-[11.5px] text-muted tabular">
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block w-4 h-[2.5px] rounded-full" style={{ background: "#4E8B73" }} />
                  Golden
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block w-3 h-2 rounded-sm" style={{ background: "#4E8B73", opacity: 0.18 }} />
                  95% band
                </span>
              </div>
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
                {phase === "ready" && "Golden trajectory projected. Press Play to stream the live batch."}
                {phase === "playing" && `Streaming · t = ${(noisy[noisyIdx - 1]?.t ?? 0).toFixed(1)} h`}
                {phase === "anomaly" && "Anomaly at t = 15 h · feed composition drift (higher maltose / lower glucose). Select an intervention."}
                {phase === "intervention" && selectedIv && (
                  <>Projecting {selectedIv.label} · endpoint{" "}
                    {endpointDelta != null && (
                      <span className={cn("tabular", selectedIv.recommended ? "text-accent" : "text-ink-soft")}>
                        {endpointDelta.toFixed(2)} g/L from golden
                      </span>
                    )}
                  </>
                )}
                {phase === "compare" && "Comparing all five rescue scenarios."}
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
            <div className="text-[11px] uppercase tracking-[0.12em] text-muted mb-2">Diagnosis</div>
            <p className="text-[13px] text-ink leading-relaxed">
              Feed composition drifted — a higher maltose / lower glucose fraction than expected.
            </p>
            <p className="mt-2 text-[12px] text-muted leading-relaxed">
              Reducing the feed flowrate cuts dilution, so biomass and glucose stay concentrated and the rate recovers. The model prefers <span className="text-accent">0.6×</span> as the rescue.
            </p>
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
    </div>
  );
}
