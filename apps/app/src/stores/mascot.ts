import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { MascotMessage } from "../features/mascot/messages";

export interface MascotPrefs {
  /** Mascote escolhido; `null` desliga o mascote em todo o app. */
  mascotId: string | null;
  /** Cor própria (#rrggbb); `null` usa a cor do mascote. */
  color: string | null;
  /** Apelido dado pelo usuário; vazio usa o nome do mascote. */
  nickname: string;
  /** Mostra o mascote no canto da tela, ajudando nos estudos. */
  companion: boolean;
  /** Avisa quando há cards para revisar. */
  reminders: boolean;
  /** Dá dicas de estudo. */
  tips: boolean;
  /** Comemora sessões concluídas e sequências. */
  celebrate: boolean;
  /** Lembrete diário, em hora cheia (0–23); `null` desliga. */
  dailyHour: number | null;
}

interface MascotState extends MascotPrefs {
  /** Último aviso automático mostrado (ms), para não repetir a toda hora. */
  lastNudgeAt: number;
  /** Silenciado até este instante (ms). */
  snoozedUntil: number;
  /** Dia (aaaa-mm-dd) do último lembrete diário dado na web. */
  lastDailyReminder: string;
  set: (values: Partial<MascotState>) => void;
}

export const MASCOT_DEFAULTS: MascotPrefs = {
  mascotId: null,
  color: null,
  nickname: "",
  companion: true,
  reminders: true,
  tips: true,
  celebrate: true,
  dailyHour: null,
};

/** Preferência do aparelho, como tema e aparência (cada aparelho pode ter o seu mascote). */
export const useMascotStore = create<MascotState>()(
  persist(
    (set) => ({
      ...MASCOT_DEFAULTS,
      lastNudgeAt: 0,
      snoozedUntil: 0,
      lastDailyReminder: "",
      set: (values) => set(values),
    }),
    { name: "estudarella:mascote" },
  ),
);

/**
 * Falas que chegam de fora da rotina normal (fim de uma fase do foco, pedido de um
 * plugin). O mascote do canto abre o balão com elas. Estado só de interface.
 */
export const useMascotEvents = create<{
  event: (MascotMessage & { at: number }) | null;
  push: (message: MascotMessage, from?: string) => void;
  clear: () => void;
}>((set) => ({
  event: null,
  push: (message, from) => set({ event: { ...message, from, at: Date.now() } }),
  clear: () => set({ event: null }),
}));
