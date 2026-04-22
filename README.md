# Praj — Bioprocess Studio

A demo front-end for the Praj case study. Three surfaces:

1. **Model Fitting** — upload a process PDF, preview the structured extract, configure a hybrid model (system · constraints · train/test split), fit, and review per-batch trajectory plots + metrics.
2. **Scenario 1 — Batch tracking** — watch a live fermentation against its golden trajectory; when measurements drift at t=15 h, compare four feed-flowrate interventions and see why 0.5× is recommended.
3. **Scenario 2 — Tech transfer** — placeholder card for the next workflow.

Built with Vite + React + TypeScript + Tailwind v4 + Framer Motion + SheetJS.

## Running

```bash
cd app
npm install
npm run dev
```

Open <http://localhost:5173/>.

Production build:

```bash
npm run build
npm run preview
```

## Layout

```
praaj_demo2/
├── app/                     # Vite + React front-end
│   ├── public/data/         # CSVs + PDF + xlsx served at runtime (copied from /data)
│   └── src/
│       ├── surfaces/        # Fit.tsx, Scenario1.tsx, Scenario2.tsx — one per top-level tab
│       ├── components/      # Rail, Stage, StructuredSheet, BatchPlot, TrajectoryPlot, ui
│       └── lib/             # csv loader, xlsx loader, zustand store, cn helper
├── data/                    # Gaurav's raw drop (source of truth — not modified)
└── docs/
    └── decisions.md         # Per-UI-choice provenance: meeting notes vs. data vs. judgment
```

## Data

Everything animated or plotted is backed by one of the CSVs / xlsx in `/data` (also mirrored under `app/public/data/` for the dev server). No numbers are fabricated.

| File | Used in |
|---|---|
| `raw_data.pdf` | Ingest stage — upload target |
| `structured_data.xlsx` | Structured Data Preview (Summary + Batch_1…10) |
| `test_set_predictions.csv` | Results — trajectory plots per species per batch |
| `test_set_metrics.csv` | Results — metrics table (MAE / RMSE / R²) |
| `golden_batch_trajectory.csv` | Scenario 1 — golden curve |
| `suboptimal_noisy_measurements.csv` | Scenario 1 — noisy run 0 → 15 h |
| `scenario_{1.0,0.8,0.6,0.5}x_F.csv` | Scenario 1 — four intervention projections |

See `docs/decisions.md` for a full per-decision breakdown of what came from Gaurav's README, the 21 Apr meeting notes, or UX judgment.

## Tuning the demo

Both long-running animations have configurable durations at the top of `app/src/surfaces/Fit.tsx`:

```ts
export const DURATIONS = {
  ingest_ms: 2600, // PDF extraction progress
  fit_ms: 7200,    // model fitting progress
};
```

The Scenario 1 play-back duration is `duration = 3200` in `app/src/surfaces/Scenario1.tsx`.

## Known theatrical elements

Flagged honestly — see `docs/decisions.md` for the full list.

- Ingest extraction is a timed progress animation, not a real LLM pipeline.
- Fit training is a scripted progress bar against the shipped metrics.
- Scenario 1 IC inputs (temperature / substrate / biomass) have no effect on the curves — the golden trajectory is fixed per Gaurav's CSV.
- "Anomaly detection" at t=15 h is hardcoded (it's where the noisy CSV ends), not computed.
