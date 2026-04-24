import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SectionTitle, Button, Pill } from "../components/ui";
import { Stage } from "../components/Stage";
import { StructuredSheet } from "../components/StructuredSheet";
import { StructuredPlot } from "../components/StructuredPlot";
import { TrajectoryPlot } from "../components/TrajectoryPlot";
import { loadCSV } from "../lib/csv";
import { loadStructuredWorkbook } from "../lib/xlsx";
import { useApp } from "../lib/store";
import { cn } from "../lib/cn";

// ── Tune these to change animation pacing ────────────────────────────
export const DURATIONS = {
  ingest_ms: 4800, // PDF extraction progress
  fit_ms: 11000,   // model fitting progress
};
// ─────────────────────────────────────────────────────────────────────

type StageId = "ingest" | "structured" | "configure" | "fit" | "results";

const SPECIES = [
  { key: "X", label: "Biomass", unit: "g/L" },
  { key: "S", label: "Glucose", unit: "g/L" },
  { key: "P", label: "Lactic Acid", unit: "g/L" },
  { key: "M", label: "Maltose", unit: "g/L" },
] as const;

type SpeciesKey = (typeof SPECIES)[number]["key"];

export type Config = {
  modelType: "rnn" | "node" | "pinn";
  system: "lactic" | "isobutanol" | "phb";
  constraints: { mass: boolean; ode: boolean };
  trainFraction: number;
  split: "random" | "batchwise";
};

const SYSTEM_LABEL: Record<Config["system"], string> = {
  lactic: "Lactic acid",
  isobutanol: "Isobutanol",
  phb: "PHB",
};

export function FitSurface() {
  const setModelFitted = useApp((s) => s.setModelFitted);
  const setSurface = useApp((s) => s.setSurface);

  const ORDER: StageId[] = ["ingest", "structured", "configure", "fit", "results"];

  function loadFitState() {
    try {
      const raw = localStorage.getItem("fitState");
      if (!raw) return null;
      return JSON.parse(raw) as { active: StageId; done: StageId[]; uploadedName: string; uploadedSize: string };
    } catch { return null; }
  }

  function saveFitState(active: StageId, doneSet: Set<StageId>, name: string, size: string) {
    try {
      localStorage.setItem("fitState", JSON.stringify({ active, done: [...doneSet], uploadedName: name, uploadedSize: size }));
    } catch { /* noop */ }
  }

  const saved = useRef(loadFitState()).current;

  const [activeStage, setActiveStageRaw] = useState<StageId>(saved?.active ?? "ingest");
  const doneRef = useRef(new Set<StageId>(saved?.done ?? []));
  const [, forceUpdate] = useState(0);
  const [uploadedName, setUploadedName] = useState<string>(saved?.uploadedName ?? "raw_data.pdf");
  const [uploadedSize, setUploadedSize] = useState<string>(saved?.uploadedSize ?? "");

  const done = doneRef.current;

  const setActiveStage = (id: StageId) => {
    setActiveStageRaw(id);
  };

  // Persist whenever active or done changes.
  const persistState = (active: StageId, name: string, size: string) => {
    saveFitState(active, doneRef.current, name, size);
  };

  const rerunFrom = (id: StageId) => {
    const idx = ORDER.indexOf(id);
    ORDER.slice(idx).forEach((s) => doneRef.current.delete(s));
    if (id === "fit" || id === "results") setModelFitted(false);
    setActiveStageRaw(id);
    persistState(id, uploadedName, uploadedSize);
    forceUpdate((n) => n + 1);
  };

  // If the user hasn't uploaded their own file yet, read the sample PDF's real
  // byte length via a HEAD request rather than showing a hand-typed size.
  useEffect(() => {
    if (uploadedName !== "raw_data.pdf" || uploadedSize) return;
    fetch("/data/raw_data.pdf", { method: "HEAD" })
      .then((r) => {
        const len = Number(r.headers.get("content-length"));
        if (!Number.isFinite(len) || len <= 0) return;
        const mb = len / (1024 * 1024);
        const s = mb >= 1 ? `${mb.toFixed(1)} MB` : `${(len / 1024).toFixed(0)} KB`;
        setUploadedSize(s);
        saveFitState(activeStage, doneRef.current, uploadedName, s);
      })
      .catch(() => { /* noop */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadedName]);

  const [cfg, setCfg] = useState<Config>({
    modelType: "rnn",
    system: "lactic",
    constraints: { mass: true, ode: false },
    trainFraction: 0.7,
    split: "batchwise",
  });

  const status = (id: StageId): "pending" | "active" | "done" => {
    if (done.has(id)) return "done";
    if (activeStage === id) return "active";
    return "pending";
  };

  const advance = (from: StageId, to: StageId) => {
    done.add(from);
    setActiveStage(to);
    persistState(to, uploadedName, uploadedSize);
  };

  return (
    <div className="px-10 py-10 max-w-[1280px] mx-auto">
      <SectionTitle
        eyebrow="Workflow 01"
        title="Process data"
        sub="Upload raw process data, review the structured extract, configure the model, and fit. Metrics are held against a test set."
      />

      <div className="mt-10 flex flex-col gap-4">
        <IngestStage
          status={status("ingest")}
          onDone={() => advance("ingest", "structured")}
          onRerun={() => rerunFrom("ingest")}
          uploadedName={uploadedName}
          uploadedSize={uploadedSize}
          onFile={(name, size) => {
            setUploadedName(name);
            setUploadedSize(size);
            persistState(activeStage, name, size);
          }}
        />
        <StructuredStage
          status={status("structured")}
          onDone={() => advance("structured", "configure")}
          onRerun={() => rerunFrom("structured")}
        />
        <ConfigureStage
          status={status("configure")}
          cfg={cfg}
          setCfg={setCfg}
          onDone={() => advance("configure", "fit")}
          onRerun={() => rerunFrom("configure")}
        />
        <FitStage
          status={status("fit")}
          cfg={cfg}
          onDone={() => {
            advance("fit", "results");
            setModelFitted(true);
          }}
          onRerun={() => rerunFrom("fit")}
        />
        <ResultsStage
          status={status("results")}
          onToScenario={() => setSurface("scenario1")}
          onRerun={() => rerunFrom("results")}
        />
      </div>
    </div>
  );
}

/* ---------- 01 Ingest ---------- */

function IngestStage({
  status,
  onDone,
  onRerun,
  uploadedName,
  uploadedSize,
  onFile,
}: {
  status: "pending" | "active" | "done";
  onDone: () => void;
  onRerun: () => void;
  uploadedName: string;
  uploadedSize: string;
  onFile: (name: string, size: string) => void;
}) {
  const [phase, setPhase] = useState<"drop" | "extracting" | "ready">("drop");
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState<{ batches: number; rows: number; columns: number } | null>(null);

  useEffect(() => {
    if (phase !== "extracting") return;
    const start = performance.now();
    let raf = 0;
    // Kick off the real workbook load in parallel with the progress animation.
    loadStructuredWorkbook().then((wb) => {
      const batchSheets = wb.sheetNames.filter((n) => n !== "Summary");
      const rows = batchSheets.reduce((acc, n) => acc + wb.sheets[n].length, 0);
      const columns = wb.sheets[batchSheets[0]]?.[0] ? Object.keys(wb.sheets[batchSheets[0]][0]).length : 0;
      setStats({ batches: batchSheets.length, rows, columns });
    });
    const step = () => {
      const t = Math.min(1, (performance.now() - start) / DURATIONS.ingest_ms);
      setProgress(t);
      if (t < 1) raf = requestAnimationFrame(step);
      else setPhase("ready");
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  const useSample = async () => {
    let size = "";
    try {
      const r = await fetch("/data/raw_data.pdf", { method: "HEAD" });
      const len = Number(r.headers.get("content-length"));
      if (Number.isFinite(len) && len > 0) {
        const mb = len / (1024 * 1024);
        size = mb >= 1 ? `${mb.toFixed(1)} MB` : `${(len / 1024).toFixed(0)} KB`;
      }
    } catch { /* noop */ }
    onFile("raw_data.pdf", size);
    setPhase("extracting");
  };

  return (
    <Stage
      index={1}
      title="Ingest raw data"
      status={status}
      summary={<><Pill tone="muted">{uploadedName}</Pill><span className="tabular">{uploadedSize}</span></>}
      onRerun={onRerun}
    >
      <div className="pt-4">
        <AnimatePresence mode="wait" initial={false}>
          {phase === "drop" && (
            <motion.div key="drop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
              <div
                className="rounded-2xl border border-dashed border-hairline-strong bg-canvas/60 px-8 py-10 flex flex-col items-center gap-4 opacity-60 select-none cursor-not-allowed"
                aria-disabled="true"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => e.preventDefault()}
              >
                <div className="w-11 h-11 rounded-xl bg-canvas-raised border border-hairline grid place-items-center">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#6B7280" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 17V3m0 0-5 5m5-5 5 5" />
                    <path d="M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" />
                  </svg>
                </div>
                <div className="text-center">
                  <div className="text-[14px] text-ink">Drop your process file here</div>
                  <div className="text-[12px] text-muted mt-1">Upload not yet available — use the sample below</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" disabled>
                    Choose file
                  </Button>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-center">
                <Button variant="ghost" size="sm" onClick={useSample}>
                  Use sample
                </Button>
              </div>
            </motion.div>
          )}

          {phase === "extracting" && (
            <motion.div key="extract" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <div className="rounded-2xl bg-canvas border border-hairline px-7 py-7">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-8 h-8 rounded-lg bg-signal-wash grid place-items-center">
                    <motion.span
                      className="w-2 h-2 rounded-full bg-signal"
                      animate={{ opacity: [0.35, 1, 0.35] }}
                      transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="text-[13.5px] text-ink">Extracting structured data — {uploadedName}</div>
                    <div className="text-[11.5px] text-muted">LLM pipeline reading the document · identifying tables, species, timestamps</div>
                  </div>
                  <div className="tabular text-[12px] text-muted">{Math.round(progress * 100)}%</div>
                </div>
                <div className="h-[3px] bg-hairline rounded-full overflow-hidden">
                  <div className="h-full bg-ink transition-none" style={{ width: `${progress * 100}%` }} />
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {["Feed schedules", "Biomass probes", "Offline assays", "Bioreactor vitals"].map((label, i) => (
                    <motion.span
                      key={label}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: progress > (i + 1) * 0.2 ? 1 : 0.35, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-canvas-raised border border-hairline text-[11px] text-muted"
                    >
                      {progress > (i + 1) * 0.2 && (
                        <svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="#6B9E88" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8.5 6.5 12 13 4.5" /></svg>
                      )}
                      {label}
                    </motion.span>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {phase === "ready" && (
            <motion.div key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <div className="rounded-2xl bg-canvas border border-hairline px-7 py-6 flex items-center gap-5">
                <div className="w-10 h-10 rounded-xl bg-accent-wash grid place-items-center">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#6B9E88" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5 10 17 19 7" /></svg>
                </div>
                <div className="flex-1">
                  <div className="text-[14px] text-ink">Extraction complete</div>
                  <div className="text-[12px] text-muted tabular">
                    {stats
                      ? `${stats.batches} batches · 1 summary sheet · ${stats.rows.toLocaleString()} timestamped rows`
                      : "Reading structured sheets…"}
                  </div>
                </div>
                <Button onClick={onDone}>Review structured data →</Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Stage>
  );
}

/* ---------- 02 Structured ---------- */

function StructuredStage({ status, onDone, onRerun }: { status: "pending" | "active" | "done"; onDone: () => void; onRerun: () => void }) {
  const [open, setOpen] = useState(false);
  const [sheets, setSheets] = useState<Record<string, Record<string, number | string>[]> | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [activeSheet, setActiveSheet] = useState<string>("Batch_1");

  useEffect(() => {
    loadStructuredWorkbook().then((wb) => {
      setSheets(wb.sheets);
      setSheetNames(wb.sheetNames);
    });
  }, []);

  const chipNames = useMemo(() => {
    const names = sheetNames.length ? sheetNames : [];
    const summary = names.filter((n) => n === "Summary");
    const batches = names.filter((n) => /^Batch_\d+$/.test(n))
      .sort((a, b) => Number(a.replace("Batch_", "")) - Number(b.replace("Batch_", "")));
    return [...summary, ...batches];
  }, [sheetNames]);

  const activeRows = sheets && activeSheet in sheets ? sheets[activeSheet] : [];

  return (
    <>
      <Stage
        index={2}
        title="Structured data preview"
        status={status}
        summary={<><Pill tone="accent">Reviewed</Pill></>}
        onRerun={onRerun}
      >
        <div className="pt-4 flex flex-col gap-4">
          <div className="rounded-2xl bg-canvas border border-hairline p-6">
            <div className="flex items-baseline justify-between mb-3">
              <div className="text-[12px] uppercase tracking-[0.12em] text-muted">Sheets</div>
              <div className="text-[11px] text-muted-soft tabular">{chipNames.length} total</div>
            </div>
            <div className="flex gap-1.5 mb-5 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin">
              {chipNames.map((c) => {
                const isActive = c === activeSheet;
                return (
                  <button
                    key={c}
                    onClick={() => setActiveSheet(c)}
                    className={cn(
                      "press inline-flex items-center justify-center shrink-0 h-6 px-2.5 rounded-full border text-[11.5px] tabular transition-colors",
                      isActive
                        ? "bg-ink text-canvas border-ink"
                        : "bg-canvas-raised text-ink-soft border-hairline hover:border-hairline-strong"
                    )}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
            <p className="text-[13px] text-ink-soft leading-relaxed max-w-[58ch]">
              A Summary sheet of per-batch initial conditions plus one time-series sheet per batch (Biomass X, Glucose S, Lactic Acid P, Maltose M, Volume V over time). Click a chip to preview its trajectory.
            </p>

            {activeSheet !== "Summary" && activeRows.length > 0 && (
              <div className="mt-5">
                <StructuredPlot rows={activeRows} batchName={activeSheet} />
              </div>
            )}
            {activeSheet === "Summary" && (
              <div className="mt-5 rounded-xl bg-canvas-raised border border-hairline p-4 text-[12px] text-muted">
                The Summary sheet holds per-batch initial conditions — open the full table to inspect values.
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
              <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M2 4h12M2 8h12M2 12h12"/></svg>
              Open table
            </Button>
            <Button size="sm" onClick={onDone}>Looks good →</Button>
          </div>
        </div>
      </Stage>
      <StructuredSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/* ---------- 03 Configure ---------- */

function ConfigureStage({
  status,
  cfg,
  setCfg,
  onDone,
  onRerun,
}: {
  status: "pending" | "active" | "done";
  cfg: Config;
  setCfg: (c: Config) => void;
  onDone: () => void;
  onRerun: () => void;
}) {
  return (
    <Stage
      index={3}
      title="Configure the fit"
      status={status}
      summary={
        <>
          <Pill tone="muted">{({ rnn: "RNN", node: "Neural ODE", pinn: "PINN" } as const)[cfg.modelType]}</Pill>
          <Pill tone="accent">{SYSTEM_LABEL[cfg.system]}</Pill>
          <span className="tabular">
            {Math.round(cfg.trainFraction * 100)}/{100 - Math.round(cfg.trainFraction * 100)} · {cfg.split === "random" ? "random" : "batch-wise"}
          </span>
        </>
      }
      onRerun={onRerun}
    >
      <div className="pt-5 grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="flex flex-col gap-6">
          <Select
            label="Model type"
            value={cfg.modelType}
            options={[
              { v: "rnn", label: "RNN" },
              { v: "node", label: "Neural ODE", disabled: true, suffix: "coming soon" },
              { v: "pinn", label: "PINN", disabled: true, suffix: "coming soon" },
            ]}
            onChange={(v) => setCfg({ ...cfg, modelType: v as Config["modelType"] })}
          />
          <Select
            label="Biological system"
            value={cfg.system}
            options={[
              { v: "lactic", label: "Lactic acid" },
              { v: "isobutanol", label: "Isobutanol", disabled: true, suffix: "coming soon" },
              { v: "phb", label: "PHB", disabled: true, suffix: "coming soon" },
            ]}
            onChange={(v) => setCfg({ ...cfg, system: v as Config["system"] })}
          />
          <div>
            <Label>Physics constraints</Label>
            <div className="mt-2 flex gap-2 flex-wrap">
              <Chip
                active={cfg.constraints.mass}
                onClick={() => setCfg({ ...cfg, constraints: { ...cfg.constraints, mass: !cfg.constraints.mass } })}
              >
                Mass balance
              </Chip>
              <Chip
                active={cfg.constraints.ode}
                onClick={() => setCfg({ ...cfg, constraints: { ...cfg.constraints, ode: !cfg.constraints.ode } })}
              >
                ODE system
              </Chip>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div>
            <div className="flex items-baseline justify-between">
              <Label>Train / test split</Label>
              <span className="tabular text-[12px] text-muted">
                {Math.round(cfg.trainFraction * 100)}% / {100 - Math.round(cfg.trainFraction * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={50}
              max={90}
              step={5}
              value={cfg.trainFraction * 100}
              onChange={(e) => setCfg({ ...cfg, trainFraction: Number(e.target.value) / 100 })}
              className="mt-3 w-full accent-[color:var(--color-ink)]"
            />
            <div className="flex justify-between text-[10.5px] text-muted-soft tabular mt-1 px-0.5">
              <span>50</span><span>60</span><span>70</span><span>80</span><span>90</span>
            </div>
          </div>

          <div>
            <Label>Split method</Label>
            <p className="mt-2 text-[13px] text-ink">Batch-wise</p>
            <p className="mt-1 text-[11.5px] text-muted leading-relaxed max-w-[48ch]">
              Entire batches are held out — the harder, more honest test for downstream prediction.
            </p>
          </div>

          <div className="mt-auto flex justify-end">
            <Button onClick={onDone}>Continue →</Button>
          </div>
        </div>
      </div>
    </Stage>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] uppercase tracking-[0.12em] text-muted">{children}</div>;
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { v: string; label: string; disabled?: boolean; suffix?: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <Label>{label}</Label>
      <div className="mt-2 relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="appearance-none w-full h-11 pl-4 pr-10 rounded-xl bg-canvas border border-hairline text-[14px] text-ink hover:border-hairline-strong transition-colors focus:outline-none focus:border-ink/40"
        >
          {options.map((o) => (
            <option key={o.v} value={o.v} disabled={o.disabled}>
              {o.label}{o.suffix ? ` — ${o.suffix}` : ""}
            </option>
          ))}
        </select>
        <svg viewBox="0 0 16 16" width="14" height="14" className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 6l4 4 4-4" />
        </svg>
      </div>
    </label>
  );
}

function Chip({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "press inline-flex items-center gap-2 h-9 px-3.5 rounded-full border text-[13px] transition-colors",
        active
          ? "bg-accent-wash border-accent-soft text-accent"
          : "bg-canvas border-hairline text-ink-soft hover:border-hairline-strong"
      )}
    >
      <span className={cn("inline-flex items-center justify-center w-4 h-4 rounded-[5px] border transition-colors shrink-0", active ? "bg-accent border-accent" : "border-hairline-strong")}>
        {active && (
          <svg viewBox="0 0 14 14" width="10" height="10" fill="none" stroke="#FBFAF7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7.5 6 10.5 11 4.5" /></svg>
        )}
      </span>
      {children}
    </button>
  );
}

/* ---------- 04 Fit ---------- */

type LossRow = { epoch: number; train_loss: number; val_loss: number };

function FitStage({
  status,
  cfg,
  onDone,
  onRerun,
}: {
  status: "pending" | "active" | "done";
  cfg: Config;
  onDone: () => void;
  onRerun: () => void;
}) {
  const [phase, setPhase] = useState<"idle" | "running" | "ready">("idle");
  const [progress, setProgress] = useState(0);
  const [epoch, setEpoch] = useState(0);
  const [trainLoss, setTrainLoss] = useState(0);
  const [valLoss, setValLoss] = useState(0);
  const [lossRows, setLossRows] = useState<LossRow[]>([]);
  const [metrics, setMetrics] = useState<Record<string, number | string>[]>([]);

  // Load the real loss history and metrics CSVs once on mount.
  useEffect(() => {
    loadCSV<LossRow>("/data/loss_history.csv").then((rows) => setLossRows(rows));
    loadCSV<Record<string, number | string>>("/data/test_set_metrics.csv").then((rows) =>
      setMetrics(rows.filter((m) => m.Species !== "Species"))
    );
  }, []);

  const lactic = metrics.find((m) => typeof m.Species === "string" && (m.Species as string).startsWith("Lactic"));

  useEffect(() => {
    if (phase !== "running") return;
    const start = performance.now();
    let raf = 0;
    const step = () => {
      const t = Math.min(1, (performance.now() - start) / DURATIONS.fit_ms);
      setProgress(t);
      const rowIdx = Math.min(Math.floor(t * lossRows.length), lossRows.length - 1);
      const row = lossRows[rowIdx];
      if (row) {
        setEpoch(row.epoch);
        setTrainLoss(row.train_loss);
        setValLoss(row.val_loss);
      }
      if (t < 1) raf = requestAnimationFrame(step);
      else setPhase("ready");
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [phase, lossRows]);

  const activeConstraints = [
    cfg.constraints.mass && "mass balance",
    cfg.constraints.ode && "ODE system",
  ].filter(Boolean).join(" + ") || "no constraints";

  const modelLabel = ({ rnn: "RNN", node: "Neural ODE", pinn: "PINN" } as const)[cfg.modelType];
  const summary = `${modelLabel} model · ${SYSTEM_LABEL[cfg.system]} · ${activeConstraints} · ${cfg.split === "random" ? "random" : "batch-wise"} ${Math.round(cfg.trainFraction * 100)}/${100 - Math.round(cfg.trainFraction * 100)}`;

  return (
    <Stage
      index={4}
      title="Fit the model"
      status={status}
      summary={<><Pill tone="accent">Converged</Pill><span className="tabular">{lossRows.length || 100} epochs</span></>}
      onRerun={onRerun}
    >
      <div className="pt-5">
        <AnimatePresence mode="wait" initial={false}>
          {phase === "idle" && (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <div className="rounded-2xl bg-canvas border border-hairline px-7 py-6 flex items-center gap-6">
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] text-ink">Ready to fit</div>
                  <div className="text-[12px] text-muted truncate">{summary}</div>
                </div>
                <Button onClick={() => setPhase("running")}>
                  Fit model
                  <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8h10m-4-4 4 4-4 4"/></svg>
                </Button>
              </div>
            </motion.div>
          )}

          {phase === "running" && (
            <motion.div key="run" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <div className="rounded-2xl bg-canvas border border-hairline px-7 py-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="relative w-8 h-8 rounded-lg bg-ink grid place-items-center">
                      <motion.div
                        className="absolute inset-[3px] rounded-md border-2 border-canvas/40 border-t-canvas"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
                      />
                    </div>
                    <div>
                      <div className="text-[13.5px] text-ink">Training</div>
                      <div className="text-[11.5px] text-muted tabular">
                        epoch {String(epoch).padStart(3, "0")} / {String(Math.max(0, lossRows.length - 1)).padStart(2, "0")} · train {trainLoss.toFixed(4)} · val {valLoss.toFixed(4)}
                      </div>
                    </div>
                  </div>
                  <div className="tabular text-[12px] text-muted">{Math.round(progress * 100)}%</div>
                </div>
                <div className="h-[3px] bg-hairline rounded-full overflow-hidden">
                  <div className="h-full bg-ink" style={{ width: `${progress * 100}%` }} />
                </div>
                <div className="mt-5 grid grid-cols-5 gap-2">
                  {SPECIES.map((sp, i) => (
                    <div key={sp.key} className="rounded-xl bg-canvas-raised border border-hairline px-3 py-2.5">
                      <div className="text-[10.5px] uppercase tracking-wide text-muted">{sp.label}</div>
                      <div className={cn("mt-1 h-[2px] rounded-full", progress > (i + 1) * 0.18 ? "bg-accent" : "bg-hairline-strong")} />
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {phase === "ready" && (
            <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <div className="rounded-2xl bg-canvas border border-hairline px-7 py-6 flex items-center gap-5">
                <div className="w-10 h-10 rounded-xl bg-accent-wash grid place-items-center">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#6B9E88" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5 10 17 19 7" /></svg>
                </div>
                <div className="flex-1">
                  <div className="text-[14px] text-ink">
                    Fit complete
                    {lactic && <> — lactic acid R² {Number(lactic.R2).toFixed(3)}</>}
                  </div>
                  <div className="text-[12px] text-muted">
                    Final val loss {(lossRows[lossRows.length - 1]?.val_loss ?? valLoss).toFixed(4)} · train {(lossRows[lossRows.length - 1]?.train_loss ?? trainLoss).toFixed(4)} · {lossRows.length} epochs
                  </div>
                </div>
                <Button onClick={onDone}>See results →</Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Stage>
  );
}

/* ---------- 05 Results ---------- */

function ResultsStage({ status, onToScenario, onRerun }: { status: "pending" | "active" | "done"; onToScenario: () => void; onRerun: () => void }) {
  const [rows, setRows] = useState<Record<string, number | string>[]>([]);
  const [metrics, setMetrics] = useState<Record<string, number | string>[]>([]);
  const [species, setSpecies] = useState<SpeciesKey>("P");
  const [batch, setBatch] = useState<number | null>(null);

  useEffect(() => {
    if (status !== "active") return;
    loadCSV("/data/test_set_predictions.csv").then((r) => {
      setRows(r as Record<string, number | string>[]);
      const batches = Array.from(new Set(r.map((x) => Number((x as Record<string, number | string>).Batch)))).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
      if (batches.length && batch == null) setBatch(batches[0]);
    });
    loadCSV("/data/test_set_metrics.csv").then((r) => {
      // Filter out any duplicate header rows the CSV may contain.
      setMetrics((r as Record<string, number | string>[]).filter((m) => m.Species !== "Species"));
    });
  }, [status]);

  const product = metrics.find((m) => typeof m.Species === "string" && (m.Species as string).startsWith("Lactic"));
  const batches = Array.from(new Set(rows.map((r) => Number(r.Batch)))).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  const speciesLabel = SPECIES.find((s) => s.key === species);

  return (
    <Stage index={5} title="Results" status={status} onRerun={onRerun}>
      <div className="pt-5 grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-7 rounded-2xl bg-canvas border border-hairline">
          <div className="flex flex-wrap items-center justify-between px-5 pt-4 pb-3 border-b border-hairline gap-x-4 gap-y-2">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-[0.12em] text-muted">Test-set trajectory</div>
              <div className="serif text-[16px] text-ink mt-0.5 whitespace-nowrap">
                {speciesLabel?.label} over time {batch != null && <span className="text-muted">· Batch {batch}</span>}
              </div>
            </div>
            <div className="flex items-center gap-1 bg-canvas-raised rounded-full border border-hairline p-0.5">
              {SPECIES.map((sp) => (
                <button
                  key={sp.key}
                  onClick={() => setSpecies(sp.key)}
                  className={cn(
                    "press tabular h-7 px-2.5 rounded-full text-[11.5px] transition-colors",
                    species === sp.key ? "bg-ink text-canvas" : "text-muted hover:text-ink"
                  )}
                >
                  {sp.key}
                </button>
              ))}
            </div>
          </div>
          {batches.length > 0 && (
            <div className="px-5 py-2.5 border-b border-hairline flex items-center gap-3">
              <div className="text-[10.5px] uppercase tracking-[0.12em] text-muted shrink-0">Batch</div>
              <div className="flex gap-1 overflow-x-auto scrollbar-thin -mx-1 px-1 flex-1">
                {batches.map((b) => {
                  const active = b === batch;
                  return (
                    <button
                      key={b}
                      onClick={() => setBatch(b)}
                      className={cn(
                        "press shrink-0 h-6 min-w-[30px] px-2 rounded-full border text-[11px] tabular transition-colors",
                        active
                          ? "bg-ink text-canvas border-ink"
                          : "bg-canvas-raised text-muted border-hairline hover:border-hairline-strong hover:text-ink"
                      )}
                    >
                      {b}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="h-[340px] px-2">
            {batch != null && <TrajectoryPlot rows={rows} species={species} batch={batch} />}
          </div>
          <div className="flex items-center gap-5 px-5 pb-4 pt-1 text-[11.5px] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-[2px]" style={{ background: ({ X: "#1F77B4", S: "#1C1E22", P: "#2CA02C", M: "#D62728" } as const)[species] }} />
              Predicted
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ border: `1.5px solid ${({ X: "#1F77B4", S: "#1C1E22", P: "#2CA02C", M: "#D62728" } as const)[species]}` }}
              />
              Experiment
            </span>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-5 flex flex-col gap-4">
          <div className="rounded-2xl bg-canvas border border-hairline p-5">
            <div className="text-[11px] uppercase tracking-[0.12em] text-muted mb-3">Test-set metrics</div>
            <div className="space-y-2">
              {metrics
                .filter((m) => m.Species !== "Overall")
                .filter((m) => typeof m.Species !== "string" || !m.Species.startsWith("Volume"))
                .map((m) => {
                const isActive = typeof m.Species === "string" && m.Species.startsWith(
                  { X: "Biomass", S: "Glucose", P: "Lactic", M: "Maltose" }[species]
                );
                const r2 = Number(m.R2);
                return (
                  <button
                    key={String(m.Species)}
                    onClick={() => {
                      const key = String(m.Species).split(" ")[0];
                      const map: Record<string, SpeciesKey> = { Biomass: "X", Glucose: "S", Lactic: "P", Maltose: "M" };
                      setSpecies(map[key] ?? "P");
                    }}
                    className={cn(
                      "w-full text-left rounded-xl border transition-colors px-3.5 py-2.5 flex items-center gap-3",
                      isActive ? "bg-accent-wash border-accent-soft" : "bg-canvas-raised border-hairline hover:border-hairline-strong"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] text-ink truncate">{String(m.Species)}</div>
                      <div className="mt-1 h-[2px] rounded-full bg-hairline overflow-hidden">
                        <div className="h-full bg-accent" style={{ width: `${Math.max(0, Math.min(1, r2)) * 100}%` }} />
                      </div>
                    </div>
                    <div className="tabular text-[11.5px] text-muted shrink-0 w-[150px] text-right">
                      MAE <span className="text-ink">{Number(m.MAE).toFixed(2)}</span> · R² <span className="text-ink">{r2.toFixed(3)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {product && (
            <div className="rounded-2xl bg-ink text-canvas p-5 flex items-baseline gap-6">
              <div>
                <div className="text-[11px] uppercase tracking-[0.12em] text-canvas/60">Lactic Acid (P)</div>
                <div className="serif text-[28px] leading-none mt-2 tabular">{Number(product.R2).toFixed(3)}</div>
                <div className="text-[11px] text-canvas/60 mt-1">R² on the product channel</div>
              </div>
              <div className="ml-auto text-right tabular text-[12px] text-canvas/70 space-y-1">
                <div>MAE {Number(product.MAE).toFixed(3)}</div>
                <div>RMSE {Number(product.RMSE).toFixed(3)}</div>
              </div>
            </div>
          )}

          {status === "active" && (
            <Button onClick={onToScenario}>
              Use this model in Scenario 1 →
            </Button>
          )}
        </div>
      </div>
    </Stage>
  );
}
