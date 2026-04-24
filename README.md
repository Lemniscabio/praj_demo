# Lemnisca — Bioprocess Studio

A demo front-end for the Praj bioprocess case study. Three surfaces:

1. **Process data** (`#process-data`) — upload a process PDF, preview the structured extract from `structured_data.xlsx`, configure a hybrid model (system · constraints · train/test split), fit against `loss_history.csv`, and review per-batch trajectory plots + metrics from the test-set files.
2. **What-if simulator** (`#what-if-simulator`) — explore predicted trajectories across reactor scale × dilution rate × glucose fraction, drawn from `what_if_grid.json`. Initial conditions come from `_meta.fixed_ICs`.
3. **Anomaly rescue** (`#anomaly-rescue`) — a live batch drifts from the golden trajectory; compare five feed-flowrate rescue scenarios (0.3× / 0.6× / 1× / 1.3× / 1.6×) against the golden curve and pick one. 0.6× is flagged as the recommended rescue.

Built with Vite + React + TypeScript + Tailwind v4 + Framer Motion + SheetJS + Zustand.

## Running

```bash
cd app
npm install
npm run dev
```

Open <http://localhost:5173/>. Below 768 px a mobile gate asks the user to switch to desktop / tablet.

Production build:

```bash
npm run build
npm run preview
```

## Layout

```
praaj_demo2/
├── app/                     # Vite + React front-end
│   ├── public/data/         # CSVs · XLSX · JSON · PDF served by the dev server
│   └── src/
│       ├── surfaces/        # Fit.tsx · Scenario1.tsx · Scenario2.tsx — one per top-level tab
│       ├── components/      # Rail, Stage, StructuredPlot, BatchPlot, TrajectoryPlot, WhatIfPlot, ui
│       └── lib/             # csv loader · xlsx loader · whatif loader · zustand store · cn helper
├── docs/
│   └── decisions.md         # Per-UI-choice provenance: meeting notes vs. data vs. judgment
└── html_demo/               # Earlier static HTML prototype (reference only)
```

## Data

Everything plotted or animated is read from a file under `app/public/data/` at runtime. The schema (file names, column names, JSON shape) is pinned in code; every displayed *value* is read fresh on each load.

| File | Used in |
|---|---|
| `raw_data.pdf` | Process data — ingest sample (size read via HEAD `Content-Length`) |
| `structured_data.xlsx` | Structured preview (Summary + Batch_1…n) and `StructuredPlot` small-multiples |
| `loss_history.csv` | Fit stage — per-epoch train / val loss animation + final loss readout |
| `test_set_predictions.csv` | Results — per-species × per-batch trajectory plots |
| `test_set_metrics.csv` | Results metrics cards + the "lactic acid R²" headline on fit-complete |
| `what_if_grid.json` | What-if simulator — `scale → D → GF → {F, X, S, P, M, O2}` grid + `_meta` (t_arr, fixed_ICs, grid axes) |
| `golden_batch_trajectory.csv` | Anomaly rescue — golden curve with ±95% band |
| `suboptimal_noisy_measurements.csv` | Anomaly rescue — the live-batch noisy stream |
| `rnn_scenario_{0.3,0.6,1,1.3,1.6}x_F.csv` | Anomaly rescue — five feed-flowrate rescue projections (anomaly onset = first row's `Time (h)`) |

### What's fixed in code vs. read from files

**Fixed schema (the contract):** file names / paths, column names, JSON depth, the set of intervention multipliers, species colors, which multiplier is flagged "recommended".

**Read from the files on every load:** every concentration, time, loss, epoch count, R² / MAE / RMSE, initial condition (X₀, P₀, O₂, total substrate, feed concentration), time axis, scale / D / GF grid, cell feed flowrate F, anomaly onset time, PDF byte length. Intervention labels ("Reduce feed 70%", etc.) are computed from the multiplier rather than typed.

See `docs/decisions.md` for the full per-decision breakdown.

## State & routing

- Surface selection uses URL hashes (`#process-data` / `#what-if-simulator` / `#anomaly-rescue`) wired through a Zustand store in `app/src/lib/store.ts`.
- `modelFitted` persists in `localStorage`, so the header pill ("Hybrid model loaded" vs. "Reference model") survives refresh.
- The full Fit workflow (active stage, completed stages, uploaded-file info) persists under `fitState`; each stage has a **Rerun** pill that clears it and everything downstream.
- Anomaly rescue phase / selected intervention / selected species persist under `s2State`.

## Tuning the demo

Long-running animation durations live at the top of `app/src/surfaces/Fit.tsx`:

```ts
export const DURATIONS = {
  ingest_ms: 4800, // PDF extraction progress
  fit_ms: 11000,   // loss-curve scrub
};
```

Scenario 2 stream duration (`duration = 5800`) is in `app/src/surfaces/Scenario2.tsx`.

## Honest caveats

Flagged plainly — see `docs/decisions.md` for context.

- Ingest "extraction" is a timed progress animation, not a real LLM pipeline; the underlying `structured_data.xlsx` is loaded in parallel for real stats.
- Fit "training" is a scripted progress bar that scrubs through the shipped `loss_history.csv`, it does not train the model live.
- Anomaly onset is *not* detected — it's read as the first `Time (h)` in any loaded `rnn_scenario_*.csv` (all five share the same start).
- Model-type selector lets you pick Hybrid; RNN / Neural ODE / PINN options are present but disabled ("coming soon").
- Biological system selector only enables Lactic acid; Isobutanol / PHB are present but disabled.
