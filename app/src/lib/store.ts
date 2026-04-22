import { create } from "zustand";

export type Surface = "fit" | "scenario1" | "scenario2";

type State = {
  surface: Surface;
  setSurface: (s: Surface) => void;
  modelFitted: boolean;
  setModelFitted: (b: boolean) => void;
};

export const useApp = create<State>((set) => ({
  surface: "fit",
  setSurface: (surface) => set({ surface }),
  modelFitted: false,
  setModelFitted: (modelFitted) => set({ modelFitted }),
}));
