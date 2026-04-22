# Design Decisions — Source Provenance

A per-decision record of where each UI/UX choice came from. Three sources:

- **[M]** Meeting notes (21 Apr 2026 Praj discussion)
- **[G]** Gaurav's data / README.docx
- **[K]** Kartikey's own judgment (design, UX, or flagged deviation)

---

## Structure & Navigation

| Decision | Source | Note |
|---|---|---|
| Three top-level surfaces: Model Fitting, Scenario 1, Scenario 2 | [M] | Scenario 2 left as placeholder per meeting ("think about scenario 2"). |
| Single-page app, left icon rail for navigation | [K] | Not specified; chosen for calmness and to preserve model-fitting state when switching into Scenario 1. |
| Model handoff: fitted model from step 1 is reused in Scenario 1 | [K] | Implied product narrative, not stated. |

## Model Fitting Flow

| Decision | Source | Note |
|---|---|---|
| Five-stage horizontal stepper (Ingest → Structured → Configure → Fit → Results) | [M] | Maps 1:1 to the meeting's workflow bullets. |
| PDF upload as drag-drop + agentic extraction animation | [M] | "Upload raw data option (PDF)" + "Convert to structured data using agentic/LLM workflow". |
| Structured data opens in a side sheet (not a new page) | [K] | Meeting says "Option to view structured data…in a polished viewer"; side sheet chosen to keep context. |
| Model-type dropdown: mechanistic, hybrid (default hybrid) | [M] | Verbatim from notes. |
| Biological system dropdown: lactic acid (default), isobutanol, PHB | [M] | Verbatim from notes. |
| Physics-constraint chips: mass balance (selected), ODE system | [M] | Verbatim from notes. |
| Data-split control with random / batch-wise toggle (batch-wise default) | [M] | Verbatim from notes. |
| Progress bar morphs out of the Fit button rather than replacing it | [K] | Emil-style single-element state transition. |
| Parity plot + metrics table for results | [M] | "Parity plot…" + "A list of metrics (MAE, RMSE, R²)". |
| Species switcher cycles X · S · P · M · V in parity plot | [G] | `test_set_predictions.csv` contains exactly these species. |
| Metrics table has color-bar cells for scan-ability | [K] | Pure design choice. |

## Scenario 1 — Batch Tracking

| Decision | Source | Note |
|---|---|---|
| Central plot: product (Lactic Acid) vs time | [G] | Gaurav's CSVs are Lactic Acid P (g/L); meeting notes said biomass X — I'm following the data Gaurav actually shipped. **Deviation from [M].** |
| Right-hand control column with system dropdown + three initial-condition inputs (temperature, substrate, biomass) | [M] | Verbatim from notes. |
| Golden batch appears as dotted sage ghost line once ICs are entered | [M] + [K] | Meeting: "the golden batch trajectory should appear". Visual treatment (dotted ghost) mine. |
| Play button starts noisy animation from t=0 to t=15h | [M] + [G] | Meeting: "animate noisy trajectory from t_0 to t_1". Gaurav's `suboptimal_noisy_measurements.csv` ends at 15h, setting t_1. |
| **Four intervention options (1.0× / 0.8× / 0.6× / 0.5×)**, not three | [G] | **Deviation from [M].** Meeting asked for three; Gaurav shipped four scenario files. I recommend rendering all four so the comparison is honest. |
| Intervention labels named by real flowrate reduction, not "Dummy text 1/2" | [G] | Meeting placeholders replaced with real names from the README. |
| 0.5× tagged with a `Recommended` pill | [G] | README: "The tool can then highlight 0.5x as the recommended action." |
| Reason log panel surfaces anomaly + rationale text | [G] + [K] | README contains the narrative ("feed composition deviation — higher maltose fraction than glucose…reducing flowrate keeps biomass/glucose high to raise rate"). Log UI is mine. |
| Reset pill returns to a comparison view with all four predicted curves dimmed | [K] | Meeting only asks for reset to re-watch individual interventions. I'm adding a compare view so the "why 0.5× is best" story is visible, not asserted. |
| Predicted intervention trajectories are smooth (non-noisy) | [M] | "These will not be noisy, as these are model predictions." |

## Visual Language

| Decision | Source | Note |
|---|---|---|
| "Cool and soft" palette — warm off-white canvas, sage accent, amber signal, cool blue-gray for predictions | [K] | User brief: "keep it cool and soft". |
| Serif for section titles, humanist sans for UI, monospace tabular for numbers | [K] | Design judgment. |
| Hairline dividers, generous whitespace, no pure black/white | [K] | Design judgment. |

## Motion

| Decision | Source | Note |
|---|---|---|
| All UI transitions ≤ 220ms, `cubic-bezier(0.23, 1, 0.32, 1)` | [K] | Emil-design-eng defaults. |
| Drawer/sheet curve `cubic-bezier(0.32, 0.72, 0, 1)` at 320ms | [K] | Emil-design-eng defaults. |
| Button `:active` scale 0.97 | [K] | Emil-design-eng default. |
| Data points enter via WAAPI with 20–40ms stagger (interruptible) | [K] | Chosen for smooth scrub/reset. |
| Species switcher crossfade uses `filter: blur(2px)` to mask label swap | [K] | Emil-design-eng technique. |
| `prefers-reduced-motion` removes position animation, keeps opacity | [K] | Accessibility default. |

## Tech Stack

| Decision | Source | Note |
|---|---|---|
| Vite + React + TypeScript + Tailwind | [K] | Not specified in meeting. |
| Framer Motion (drawers) + CSS transitions (rapid UI) | [K] | Emil-design-eng guidance on CSS-over-JS under load. |
| Zustand for cross-surface state | [K] | Lightweight; avoids Context gymnastics. |
| visx (leaning) or Recharts for plots | [K] | Open; visx gives finer control over point animation. |
| No backend — CSVs/PDF served from `/public/data`, fitting + extraction are scripted animations against Gaurav's real output files | [K] | MVP demo context. |

## Open Questions for Pushkar

1. Four interventions vs three — confirm you're okay showing all four.
2. Plot y-axis: Lactic Acid (per Gaurav's data) vs Biomass (per meeting notes) — confirm product.
3. Plot library preference (visx vs Recharts)?
4. Accent hue — sage (proposed) vs a cooler teal vs a warm ochre? Happy to sketch alternatives.
5. Any brand constraints from Praj (logo, must-use colors)?
