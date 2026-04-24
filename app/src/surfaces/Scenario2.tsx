import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SectionTitle, Button, Pill } from "../components/ui";
import { BatchPlot, type Point } from "../components/BatchPlot";
import { loadCSV } from "../lib/csv";
import { useApp } from "../lib/store";
import { cn } from "../lib/cn";

type Phase = "ready" | "playing" | "anomaly" | "intervention" | "compare";
type SpeciesKey = "X" | "S" | "P" | "M";

const SPECIES: { key: SpeciesKey; label: string; unit: string }[] = [
  { key: "X", label: "Biomass X", unit: "g/L" },
  { key: "S", label: "Glucose S", unit: "g/L" },
  { key: "P", label: "Lactic P",  unit: "g/L" },
  { key: "M", label: "Maltose M", unit: "g/L" },
];

// Intervention file set — id is read back from the filename, label from the
// multiplier. 0.6× is flagged as the recommended rescue.
type Intervention = {
  id: string;
  mult: number;
  file: string;
  label: string;
  detail: string;
  color: string;
  recommended?: boolean;
};

function labelFromMult(mult: number): string {
  if (mult === 1) return "No change";
  if (mult < 1) return `Reduce feed ${Math.round((1 - mult) * 100)}%`;
  return `Increase feed ${Math.round((mult - 1) * 100)}%`;
}

function detailFromMult(mult: number, recommended: boolean): string {
  if (recommended) return "recommended rescue";
  if (mult === 1) return "maintain current";
  if (mult < 1) return mult <= 0.3 ? "strong cut" : "moderate cut";
  return mult >= 1.6 ? "strongest push" : "push feed up";
}

const INTERVENTION_SPECS: { mult: number; color: string; recommended?: boolean }[] = [
  { mult: 0.3, color: "#1F77B4", recommended: true },
  { mult: 0.6, color: "#2CA02C" },
  { mult: 1.0, color: "#D62728" },
  { mult: 1.3, color: "#FF7F0E" },
  { mult: 1.6, color: "#9467BD" },
];

const INTERVENTIONS: Intervention[] = INTERVENTION_SPECS.map((s) => {
  const id = s.mult === 1 ? "1" : String(s.mult);
  return {
    id,
    mult: s.mult,
    file: `/data/rnn_scenario_${id}x_F.csv`,
    label: labelFromMult(s.mult),
    detail: detailFromMult(s.mult, !!s.recommended),
    color: s.color,
    recommended: s.recommended,
  };
});

// Raw CSV row types
type GoldenRow = Record<string, number | string>;
type NoisyRow  = Record<string, number | string>;
type ScenRow   = Record<string, number | string>;

function goldenPoints(rows: GoldenRow[], sp: SpeciesKey): Point[] {
  return rows
    .map((r) => ({
      t:  Number(r["Time (h)"]),
      p:  Number(r[`${sp} (g/L)`]),
      lo: Number(r[`${sp}_lower (g/L)`]),
      hi: Number(r[`${sp}_upper (g/L)`]),
    }))
    .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.p))
    .sort((a, b) => a.t - b.t);
}

function noisyPoints(rows: NoisyRow[], sp: SpeciesKey): Point[] {
  return rows
    .map((r) => ({ t: Number(r["Time (h)"]), p: Number(r[`${sp}_noisy (g/L)`]) }))
    .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.p))
    .sort((a, b) => a.t - b.t);
}

function scenPoints(rows: ScenRow[], sp: SpeciesKey): Point[] {
  return rows
    .map((r) => ({
      t:  Number(r["Time (h)"]),
      p:  Number(r[`${sp}_mean (g/L)`]),
      lo: Number(r[`${sp}_lower95 (g/L)`]),
      hi: Number(r[`${sp}_upper95 (g/L)`]),
    }))
    .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.p))
    .sort((a, b) => a.t - b.t);
}

/* ── Persistence ─────────────────────────────────────────────────────── */

const S2_KEY = "s2State";

function loadS2(): { phase: Phase; selected: string | null; species: SpeciesKey } | null {
  try {
    const raw = localStorage.getItem(S2_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function saveS2(phase: Phase, selected: string | null, species: SpeciesKey) {
  try {
    const savedPhase: Phase = phase === "playing" ? "ready" : phase;
    localStorage.setItem(S2_KEY, JSON.stringify({ phase: savedPhase, selected, species }));
  } catch { /* noop */ }
}

/* ── Surface ──────────────────────────────────────────────────────────── */

export function Scenario2Surface() {
  const modelFitted = useApp((s) => s.modelFitted);

  const saved = useRef(loadS2()).current;

  const [phase,       setPhaseRaw]    = useState<Phase>(saved?.phase ?? "ready");
  const [noisyIdx,    setNoisyIdx]    = useState(0);
  const [selected,    setSelectedRaw] = useState<string | null>(saved?.selected ?? "");
  const [species]  = useState<SpeciesKey>(saved?.species ?? "P");

  // Raw CSV data (loaded once)
  const [goldenRows,  setGoldenRows]  = useState<GoldenRow[]>([]);
  const [noisyRows,   setNoisyRows]   = useState<NoisyRow[]>([]);
  const [scenRows,    setScenRows]    = useState<Record<string, ScenRow[]>>({});

  useEffect(() => {
    loadCSV<GoldenRow>("/data/golden_batch_trajectory.csv").then(setGoldenRows);
    loadCSV<NoisyRow>("/data/suboptimal_noisy_measurements.csv").then((rows) => {
      setNoisyRows(rows);
      if (saved?.phase && saved.phase !== "ready") setNoisyIdx(rows.length);
    });
    Promise.all(
      INTERVENTIONS.map((iv) =>
        loadCSV<ScenRow>(iv.file).then((rows) => [iv.id, rows] as const)
      )
    ).then((pairs) => setScenRows(Object.fromEntries(pairs)));
  }, []);

  // Derive Point arrays from raw rows + selected species
  const golden = useMemo(() => goldenPoints(goldenRows, species), [goldenRows, species]);
  const noisy  = useMemo(() => noisyPoints(noisyRows,  species), [noisyRows,  species]);
  const predictionList = useMemo(
    () => INTERVENTIONS.map((iv) => ({
      id:          iv.id,
      label:       iv.label,
      color:       iv.color,
      recommended: iv.recommended,
      points:      scenRows[iv.id] ? scenPoints(scenRows[iv.id], species) : [],
    })),
    [scenRows, species]
  );

  /* Streaming animation */
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (phase !== "playing") return;
    const start    = performance.now();
    const total    = noisy.length;
    const duration = 5800;
    const step = () => {
      const t = Math.min(1, (performance.now() - start) / duration);
      setNoisyIdx(Math.floor(t * total));
      if (t < 1) rafRef.current = requestAnimationFrame(step);
      else { setNoisyIdx(total); setPhaseRaw("anomaly"); saveS2("anomaly", selected, species); }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [phase, noisy.length]);

  const handlePlay    = () => { setPhaseRaw("playing"); saveS2("ready", selected, species); setNoisyIdx(0); };
  const handleSelect  = (id: string) => { setSelectedRaw(id); setPhaseRaw("intervention"); saveS2("intervention", id, species); };
  const handleReset   = () => { setSelectedRaw(""); setPhaseRaw("anomaly"); saveS2("anomaly", "", species); };
  const handleCompare = () => { setSelectedRaw(null); setPhaseRaw("compare"); saveS2("compare", null, species); };

  const showingPredictions = phase === "intervention" || phase === "compare";
  const selectedIv  = INTERVENTIONS.find((i) => i.id === selected);
  const goldenEnd   = golden[golden.length - 1]?.p;
  const selectedEnd = selected && scenRows[selected] ? scenPoints(scenRows[selected], species).at(-1)?.p : undefined;
  const endpointDelta = goldenEnd != null && selectedEnd != null ? Math.abs(goldenEnd - selectedEnd) : null;
  const sp = SPECIES.find((s) => s.key === species)!;

  // Anomaly onset = first timestamp in any loaded scenario file. All five
  // scenarios share the same start so we read whichever one came back first.
  const anomalyT = useMemo(() => {
    for (const iv of INTERVENTIONS) {
      const rows = scenRows[iv.id];
      if (rows && rows.length) {
        const t = Number(rows[0]["Time (h)"]);
        if (Number.isFinite(t)) return t;
      }
    }
    return null;
  }, [scenRows]);

  return (
    <div className="px-10 py-10 max-w-[1360px] mx-auto">
      <div className="flex items-start justify-between gap-6">
        <SectionTitle
          eyebrow="Scenario 02"
          title="Real-time monitoring"
          sub={anomalyT != null
            ? `A live batch drifts from the golden trajectory at t = ${anomalyT} h. Compare rescue actions on feed flowrate and pick one.`
            : "A live batch drifts from the golden trajectory. Compare rescue actions on feed flowrate and pick one."}
        />
        <Pill tone={modelFitted ? "accent" : "muted"}>
          <span className={cn("w-1.5 h-1.5 rounded-full", modelFitted ? "bg-accent" : "bg-muted-soft")} />
          {modelFitted ? "Hybrid model loaded" : "Reference model"}
        </Pill>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: [0.23, 1, 0.32, 1] }}
        className="mt-8 grid grid-cols-12 gap-6"
      >
        <div className="col-span-12 lg:col-span-8">
          <div className="rounded-2xl bg-canvas-raised border border-hairline overflow-hidden">
            {/* Chart header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-hairline gap-4">
              <div>
                <div className="text-[11px] uppercase tracking-[0.12em] text-muted">Bioreactor · vessel 3</div>
                <div className="serif text-[17px] text-ink leading-tight mt-0.5">
                  {sp.label} vs time
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-3 text-[11.5px] text-muted tabular">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block w-4 h-[2.5px] rounded-full bg-[#4E8B73]" />
                    Golden
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block w-3 h-2 rounded-sm bg-[#4E8B73] opacity-20" />
                    95% band
                  </span>
                </div>
              </div>
            </div>

            {/* Plot */}
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
                anomalyT={anomalyT}
                unit={sp.unit}
              />
            </div>

            {/* Footer bar */}
            <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-t border-hairline bg-canvas-raised">
              <div className="text-[12px] text-muted tabular">
                {phase === "ready"  && "Golden trajectory projected. Press Play to stream the live batch."}
                {phase === "playing" && `Streaming · t = ${(noisy[noisyIdx - 1]?.t ?? 0).toFixed(1)} h`}
                {phase === "anomaly" && (anomalyT != null
                  ? `Anomaly at t = ${anomalyT} h · feed composition drift. Select an intervention.`
                  : "Anomaly detected · feed composition drift. Select an intervention.")}
                {phase === "intervention" && selectedIv && (
                  <>Projecting {selectedIv.label} · endpoint{" "}
                    {endpointDelta != null && (
                      <span className={cn("tabular", selectedIv.recommended ? "text-accent" : "text-ink-soft")}>
                        {endpointDelta.toFixed(2)} {sp.unit} from golden
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

        {/* Right panel */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-4">
          <div className="rounded-2xl bg-canvas-raised border border-hairline p-5">
            <div className="text-[11px] uppercase tracking-[0.12em] text-muted mb-2">Diagnosis</div>
            <p className="text-[13px] text-ink leading-relaxed">
              Feed composition drifted — a higher maltose / lower glucose fraction than expected.
            </p>
            <p className="mt-2 text-[12px] text-muted leading-relaxed">
              Reducing the feed flowrate cuts dilution, so biomass and glucose stay concentrated and the rate recovers. The model prefers <span className="text-accent">0.3×</span> as the rescue.
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
                          isSelected && iv.recommended  && "bg-accent-wash border-accent ring-2 ring-accent/30",
                          isSelected && !iv.recommended && "border-2",
                          !isSelected && iv.recommended && "bg-accent-wash/60 border-accent",
                          !isSelected && !iv.recommended && "bg-canvas border-hairline hover:border-hairline-strong"
                        )}
                        style={isSelected && !iv.recommended ? { borderColor: iv.color, background: `${iv.color}12` } : undefined}
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
