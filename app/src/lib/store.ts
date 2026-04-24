import { create } from "zustand";

export type Surface = "fit" | "scenario1" | "scenario2";

const HASH_MAP: Record<string, Surface> = {
  "#process-data": "fit",
  "#what-if-simulator": "scenario1",
  "#anomaly-rescue": "scenario2",
};

const SURFACE_HASH: Record<Surface, string> = {
  fit: "#process-data",
  scenario1: "#what-if-simulator",
  scenario2: "#anomaly-rescue",
};

function readHash(): Surface {
  return HASH_MAP[window.location.hash] ?? "fit";
}

function readModelFitted(): boolean {
  try { return localStorage.getItem("modelFitted") === "true"; } catch { return false; }
}

type State = {
  surface: Surface;
  setSurface: (s: Surface) => void;
  modelFitted: boolean;
  setModelFitted: (b: boolean) => void;
};

export const useApp = create<State>((set) => ({
  surface: readHash(),
  setSurface: (surface) => {
    window.location.hash = SURFACE_HASH[surface];
    set({ surface });
  },
  modelFitted: readModelFitted(),
  setModelFitted: (modelFitted) => {
    try { localStorage.setItem("modelFitted", String(modelFitted)); } catch { /* noop */ }
    set({ modelFitted });
  },
}));

// Sync back-button / forward-button navigation into the store.
window.addEventListener("hashchange", () => {
  useApp.setState({ surface: readHash() });
});
