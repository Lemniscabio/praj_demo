# Lemnisca LABS

A demo front-end for the lactic acid bioprocess simulation. Four surfaces:

1. **Landing** — overview with animated triptych figures, methodology walkthrough (model formulation · synthetic data · data splitting · model training), and references.
2. **Model development** — upload a process PDF, preview the structured extract from `structured_data.xlsx`, configure a model (RNN default; Neural ODE / PINN coming soon), fit against `loss_history.csv`, and review per-batch trajectory plots + metrics from the test-set files.
3. **What-if simulator** — explore predicted trajectories across reactor scale × dilution rate × glucose fraction, drawn from `what_if_grid.json`. Four scales shown: Lab (10 L) · Pilot (1 000 L) · Demo (10 000 L) · Production (150 000 L); the Production card is greyed as an extrapolation.
4. **Real-time monitoring** — a live batch drifts from the golden trajectory; compare five feed-flowrate rescue scenarios (0.3× / 0.6× / 1× / 1.3× / 1.6×) against the golden curve. 0.3× is the recommended rescue.

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
│       ├── surfaces/        # Landing.tsx · Fit.tsx · Scenario1.tsx · Scenario2.tsx
│       ├── components/      # Rail, Reactor, StructuredPlot, BatchPlot, FleetTrajectory, ui
│       └── lib/             # csv loader · xlsx loader · whatif loader · zustand store · cn helper
└── docs/
    └── decisions.md         # Per-UI-choice provenance: meeting notes vs. data vs. judgment
```

## Data

Everything plotted or animated is read from a file under `app/public/data/` at runtime. The schema (file names, column names, JSON shape) is pinned in code; every displayed *value* is read fresh on each load.

| File | Used in |
|---|---|
| `raw_data.pdf` | Model development — ingest sample (size read via HEAD `Content-Length`) |
| `structured_data.xlsx` | Structured preview (Summary + Batch_1…n) and `StructuredPlot` small-multiples |
| `loss_history.csv` | Fit stage — per-epoch train / val loss animation + final loss readout |
| `test_set_predictions.csv` | Results — per-species × per-batch trajectory plots |
| `test_set_metrics.csv` | Results metrics cards + the "lactic acid R²" headline on fit-complete |
| `what_if_grid.json` | What-if simulator — `scale → D → GF → {F, X, S, P, M, O2}` grid + `_meta` (t_arr, fixed_ICs, grid axes) |
| `golden_batch_trajectory.csv` | Real-time monitoring — golden curve with ±95% band (`P (g/L)`, `P_lower (g/L)`, `P_upper (g/L)`) |
| `suboptimal_noisy_measurements.csv` | Real-time monitoring — the live-batch noisy stream |
| `rnn_scenario_{0.3,0.6,1,1.3,1.6}x_F.csv` | Real-time monitoring — five feed-flowrate rescue projections |

### What's fixed in code vs. read from files

**Fixed schema (the contract):** file names / paths, column names, JSON depth, the set of intervention multipliers, species colors, which multiplier is flagged "recommended" (0.3×).

**Read from the files on every load:** every concentration, time, loss, epoch count, R² / MAE / RMSE, initial conditions (X₀, P₀, O₂, total substrate, feed concentration), time axis, scale / D / GF grid, cell feed flowrate F, anomaly onset time, PDF byte length. Intervention labels ("Reduce feed 70%", etc.) are computed from the multiplier rather than typed. Dissolved O₂ is stored as g/L in the data and converted to mg/L (×1000) at render time.

## State & routing

- Surface selection uses a Zustand store in `app/src/lib/store.ts`; the default surface is `"landing"`.
- `modelFitted` persists in `localStorage` so the header pill ("RNN model loaded" vs. "Reference model") survives refresh.
- The full Fit workflow (active stage, completed stages, uploaded-file info) persists under `fitState`; each stage has a **Rerun** pill that clears it and everything downstream.
- Real-time monitoring phase / selected intervention persist under `s2State`.

## Tuning the demo

Long-running animation durations live at the top of `app/src/surfaces/Fit.tsx`:

```ts
export const DURATIONS = {
  ingest_ms: 4800, // PDF extraction progress
  fit_ms: 11000,   // loss-curve scrub
};
```

Real-time monitoring stream duration (`duration = 5800`) is in `app/src/surfaces/Scenario2.tsx`.

## Honest caveats

- Ingest "extraction" is a timed progress animation, not a real LLM pipeline; the underlying `structured_data.xlsx` is loaded in parallel for real stats.
- Fit "training" is a scripted progress bar that scrubs through the shipped `loss_history.csv`; it does not train the model live.
- Anomaly onset is *not* detected — it's read as the first `Time (h)` in any loaded `rnn_scenario_*.csv` (all five share the same start).
- Model-type selector defaults to RNN; Neural ODE / PINN are present but disabled ("coming soon").
