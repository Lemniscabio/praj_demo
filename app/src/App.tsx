import { AnimatePresence, motion } from "framer-motion";
import { Rail } from "./components/Rail";
import { useApp } from "./lib/store";
import { FitSurface } from "./surfaces/Fit";
import { Scenario1Surface } from "./surfaces/Scenario1";
import { Scenario2Surface } from "./surfaces/Scenario2";

function MobileGate() {
  return (
    <div className="h-full flex flex-col items-center justify-center bg-canvas px-8 text-center gap-6">
      <img src="/lemnisca-logo.svg" alt="Lemnisca" className="h-[22px] w-auto opacity-60" />
      <div>
        <div className="serif text-[22px] text-ink leading-snug">Open on a larger screen</div>
        <p className="mt-2 text-[13px] text-muted leading-relaxed max-w-[28ch] mx-auto">
          Bioprocess Studio is designed for desktop and tablet — a screen at least 768 px wide.
        </p>
      </div>
      <div className="flex items-center gap-3 text-muted-soft">
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="4" width="20" height="14" rx="2" />
          <path d="M8 20h8M12 18v2" />
        </svg>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="2" width="16" height="20" rx="2" />
          <path d="M9 21h6" />
        </svg>
      </div>
    </div>
  );
}

export default function App() {
  const surface = useApp((s) => s.surface);

  return (
    <div className="h-full flex bg-canvas text-ink">
      <div className="md:hidden h-full w-full fixed inset-0 z-50">
        <MobileGate />
      </div>
      <Rail />
      <main className="flex-1 min-w-0 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={surface}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            className="min-h-full"
          >
            {surface === "fit" && <FitSurface />}
            {surface === "scenario1" && <Scenario1Surface />}
            {surface === "scenario2" && <Scenario2Surface />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
