// Loader for /data/what_if_grid.json.
//
// Structure (per README):
//   { "<flowrate L/h>": { "<glucose/maltose ratio>": {
//       X: { mean: number[], std: number[] },
//       S: { mean: number[], std: number[] },
//       P: { mean: number[], std: number[] },
//       M: { mean: number[], std: number[] }
//   } } }
//
// All mean/std arrays have the same length (51 points). No time axis is
// stored in the file; the rest of the dataset (golden_batch_trajectory.csv,
// scenario_rnn_*x_F.csv) runs to t=50 h, so we assume 0..50 h at ~1 h step
// for the simulator x-axis.

export type Species = "X" | "S" | "P" | "M";

export type SpeciesSeries = { mean: number[]; std: number[] };

export type GridCell = Record<Species, SpeciesSeries>;

export type WhatIfGrid = {
  flowrates: number[];              // sorted ascending, raw (L/h)
  ratios: number[];                 // sorted ascending (glucose/maltose)
  /** nested lookup: flowKey → ratioKey → GridCell. Keys are the original string keys. */
  cells: Record<string, Record<string, GridCell>>;
  /** stringified keys in the order they appear in the source JSON */
  flowKeys: string[];
  ratioKeys: string[];
  /** shared time axis assumed from simulation horizon */
  time: number[];
};

let cache: Promise<WhatIfGrid> | null = null;

export function loadWhatIfGrid(): Promise<WhatIfGrid> {
  if (cache) return cache;
  cache = fetch("/data/what_if_grid.json")
    .then((r) => r.json())
    .then((raw: Record<string, Record<string, GridCell>>) => {
      const flowKeys = Object.keys(raw);
      const ratioKeys = Object.keys(raw[flowKeys[0]]);
      const flowrates = flowKeys.map((k) => Number(k)).sort((a, b) => a - b);
      const ratios = ratioKeys.map((k) => Number(k)).sort((a, b) => a - b);

      const anyCell = raw[flowKeys[0]][ratioKeys[0]];
      const n = anyCell.X.mean.length; // 51
      const time = Array.from({ length: n }, (_, i) => (i * 50) / (n - 1));

      return { flowrates, ratios, cells: raw, flowKeys, ratioKeys, time };
    });
  return cache;
}
