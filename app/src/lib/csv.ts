import Papa from "papaparse";

export async function loadCSV<T = Record<string, string>>(url: string): Promise<T[]> {
  const res = await fetch(url);
  const text = await res.text();
  const { data } = Papa.parse<T>(text, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
  });
  return data as T[];
}
