// Loader for /data/what_if_grid.json.
//
// Actual structure (per _meta in the source JSON):
//   {
//     "<scale L>": {
//       "<dilution rate D (1/h)>": {
//         "<glucose fraction GF>": {
//           F:  number,                              // derived feed flowrate (L/h)
//           X:  { mean: number[], std: number[], std_total: number[] },
//           S:  { mean: number[], std: number[], std_total: number[] },
//           P:  { mean: number[], std: number[], std_total: number[] },
//           M:  { mean: number[], std: number[], std_total: number[] },
//           O2: { mean: number[], std: number[], std_total: number[] }
//         }
//       }
//     },
//     "_meta": {
//       t_arr: number[],        // shared time axis (0..75 h, 1 h step)
//       D_grid: number[],       // 10 dilution rates
//       GF_grid: number[],      // 10 glucose fractions
//       scales_L: number[],     // [10, 1000, 10000, 150000]
//       species: string[],
//       fixed_ICs: { X0, P0, O2_0, total_sub, C_feed_total },
//       ...
//     }
//   }

export type Species = "X" | "S" | "P" | "M" | "O2";

export type SpeciesSeries = { mean: number[]; std: number[]; std_total?: number[] };

export type GridCell = Record<Species, SpeciesSeries> & { F: number };

export type WhatIfMeta = {
  t_arr: number[];
  D_grid: number[];
  GF_grid: number[];
  scales_L: number[];
  species: string[];
  fixed_ICs: {
    X0: number;
    P0: number;
    O2_0: number;
    total_sub: number;
    C_feed_total: number;
  };
  D_training_bounds?: [number, number];
  GF_training_bounds?: [number, number];
};

export type WhatIfGrid = {
  meta: WhatIfMeta;
  /** nested lookup: scaleKey → Dkey → GFkey → GridCell */
  cells: Record<string, Record<string, Record<string, GridCell>>>;
  scaleKeys: string[]; // original string keys, in JSON order
  dKeys: string[];
  gfKeys: string[];
  time: number[]; // alias for meta.t_arr
};

let cache: Promise<WhatIfGrid> | null = null;

export function loadWhatIfGrid(): Promise<WhatIfGrid> {
  if (cache) return cache;
  cache = fetch("/data/what_if_grid.json")
    .then((r) => r.json())
    .then((raw: Record<string, unknown>) => {
      const meta = raw["_meta"] as WhatIfMeta;
      const cells: WhatIfGrid["cells"] = {};
      const scaleKeys: string[] = [];
      for (const k of Object.keys(raw)) {
        if (k === "_meta") continue;
        scaleKeys.push(k);
        cells[k] = raw[k] as Record<string, Record<string, GridCell>>;
      }
      const firstScale = scaleKeys[0];
      const dKeys = Object.keys(cells[firstScale]);
      const gfKeys = Object.keys(cells[firstScale][dKeys[0]]);
      return { meta, cells, scaleKeys, dKeys, gfKeys, time: meta.t_arr };
    });
  return cache;
}
