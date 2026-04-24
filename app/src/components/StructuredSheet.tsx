import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { loadStructuredWorkbook, type Workbook, type SheetRows } from "../lib/xlsx";
import { cn } from "../lib/cn";

export function StructuredSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [wb, setWb] = useState<Workbook | null>(null);
  const [active, setActive] = useState<string>("Summary");

  useEffect(() => {
    if (!open) return;
    loadStructuredWorkbook().then((w) => {
      setWb(w);
      if (!w.sheets[active]) setActive(w.sheetNames[0]);
    });
  }, [open]);

  const rows: SheetRows = wb?.sheets[active] ?? [];
  const cols = rows[0] ? Object.keys(rows[0]) : [];

  // Show dataset values at up to 5 decimal places. Integers / shorter values
  // render without trailing zeros (30 → "30", 6.48177 stays "6.48177").
  const fmt = (v: number | string) => {
    if (typeof v === "number") return String(Number(v.toFixed(5)));
    return v === "" ? "—" : v;
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-ink/10 backdrop-blur-[2px] z-40"
          />
          <motion.aside
            key="sheet"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.36, ease: [0.32, 0.72, 0, 1] }}
            className="fixed top-0 right-0 h-full w-[min(960px,94vw)] bg-canvas border-l border-hairline z-50 flex flex-col"
          >
            <div className="flex items-center justify-between px-7 py-5 border-b border-hairline">
              <div>
                <div className="text-[11px] uppercase tracking-[0.12em] text-muted">Extracted</div>
                <div className="serif text-[20px] text-ink leading-tight">Structured process data</div>
              </div>
              <button
                onClick={onClose}
                className="press w-9 h-9 rounded-full border border-hairline text-muted hover:text-ink grid place-items-center transition-colors"
                aria-label="Close"
              >
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>
              </button>
            </div>

            <div className="px-7 pt-3 pb-2 border-b border-hairline bg-canvas-raised overflow-x-auto">
              <div className="flex gap-1 min-w-max">
                {wb?.sheetNames.map((name) => (
                  <button
                    key={name}
                    onClick={() => setActive(name)}
                    className={cn(
                      "press h-7 px-3 rounded-full text-[11.5px] transition-colors whitespace-nowrap",
                      active === name ? "bg-ink text-canvas" : "text-muted hover:text-ink"
                    )}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-auto">
              <table className="w-full text-[12.5px]">
                <thead className="sticky top-0 bg-canvas z-10">
                  <tr className="text-left text-muted">
                    {cols.map((c) => (
                      <th key={c} className="font-medium px-4 py-2.5 border-b border-hairline whitespace-nowrap">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="tabular">
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b border-hairline/70 hover:bg-canvas-raised transition-colors">
                      {cols.map((c) => (
                        <td key={c} className="px-4 py-2 text-ink-soft whitespace-nowrap">{fmt(r[c])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-7 py-3 border-t border-hairline text-[11.5px] text-muted flex items-center justify-between">
              <span className="tabular">{rows.length} rows · {cols.length} columns</span>
              <span className="tabular">Source: raw_data.pdf → structured_data.xlsx</span>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
