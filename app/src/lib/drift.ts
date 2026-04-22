export type Sample = Record<string, number>;

export type DriftResult = {
  key: string;
  label: string;
  unit: string;
  siteAValues: number[];
  siteAMean: number;
  siteAStd: number;
  siteAMin: number;
  siteAMax: number;
  siteBValues: number[];
  siteBMean: number;
  meanAbsZ: number;
  percentDelta: number;
};

const mean = (arr: number[]) => (arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0);
const std = (arr: number[], m: number) =>
  arr.length > 1
    ? Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1))
    : 0;

export function computeDrift(
  siteA: Sample[],
  siteB: Sample[],
  variables: { key: string; label: string; unit: string }[]
): DriftResult[] {
  return variables.map((v) => {
    const aVals = siteA.map((s) => Number(s[v.key])).filter(Number.isFinite);
    const bVals = siteB.map((s) => Number(s[v.key])).filter(Number.isFinite);
    const aMean = mean(aVals);
    const aStd = std(aVals, aMean) || Math.abs(aMean) * 1e-3 || 1e-9;
    const bMean = mean(bVals);
    const meanAbsZ =
      bVals.length > 0
        ? bVals.reduce((s, x) => s + Math.abs((x - aMean) / aStd), 0) / bVals.length
        : 0;
    return {
      key: v.key,
      label: v.label,
      unit: v.unit,
      siteAValues: aVals,
      siteAMean: aMean,
      siteAStd: aStd,
      siteAMin: Math.min(...aVals),
      siteAMax: Math.max(...aVals),
      siteBValues: bVals,
      siteBMean: bMean,
      meanAbsZ,
      percentDelta: aMean !== 0 ? (bMean - aMean) / aMean : 0,
    };
  });
}
