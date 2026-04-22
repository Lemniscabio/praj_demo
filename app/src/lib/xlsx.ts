import * as XLSX from "xlsx";

export type SheetRows = Record<string, number | string>[];

export type Workbook = {
  sheetNames: string[];
  sheets: Record<string, SheetRows>;
};

let cache: Promise<Workbook> | null = null;

export function loadStructuredWorkbook(): Promise<Workbook> {
  if (!cache) {
    cache = fetch("/data/structured_data.xlsx")
      .then((r) => r.arrayBuffer())
      .then((buf) => {
        const wb = XLSX.read(buf, { type: "array" });
        const sheets: Record<string, SheetRows> = {};
        for (const name of wb.SheetNames) {
          sheets[name] = XLSX.utils.sheet_to_json<SheetRows[number]>(wb.Sheets[name], { defval: "" });
        }
        return { sheetNames: wb.SheetNames, sheets };
      });
  }
  return cache;
}
