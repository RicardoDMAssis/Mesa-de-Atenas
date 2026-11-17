import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_SETTINGS, INITIAL_STATE, type TimerSettings, type TimerState } from "./timer";

interface FocusStore {
  timer: TimerState;
  settings: TimerSettings;
  /** Se o usuário quer aviso ao terminar cada fase. */
  notify: boolean;
  setTimer: (timer: TimerState) => void;
  setSettings: (settings: Partial<TimerSettings>) => void;
  setNotify: (notify: boolean) => void;
}

/**
 * Timer e preferências ficam no armazenamento do aparelho: recarregar a página
 * ou reabrir o app não perde o ciclo em andamento.
 */
export const useFocusStore = create<FocusStore>()(
  persist(
    (set) => ({
      timer: INITIAL_STATE,
      settings: DEFAULT_SETTINGS,
      notify: true,
      setTimer: (timer) => set({ timer }),
      setSettings: (settings) => set((s) => ({ settings: { ...s.settings, ...settings } })),
      setNotify: (notify) => set({ notify }),
    }),
    { name: "estudarella:foco" },
  ),
);
