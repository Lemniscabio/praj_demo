import { AnimatePresence, motion } from "framer-motion";
import { Rail } from "./components/Rail";
import { useApp } from "./lib/store";
import { FitSurface } from "./surfaces/Fit";
import { Scenario1Surface } from "./surfaces/Scenario1";
import { Scenario2Surface } from "./surfaces/Scenario2";

export default function App() {
  const surface = useApp((s) => s.surface);

  return (
    <div className="h-full flex bg-canvas text-ink">
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
