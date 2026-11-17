import { create } from "zustand";
import { persist } from "zustand/middleware";

export type NoteMode = "edit" | "read";

/**
 * Modo de exibição das notas: edição ou leitura. Preferência do aparelho
 * (fica no armazenamento local): ao abrir outra nota, vale o último modo escolhido.
 */
export const useNoteMode = create<{ mode: NoteMode; setMode: (mode: NoteMode) => void }>()(
  persist((set) => ({ mode: "edit", setMode: (mode) => set({ mode }) }), {
    name: "estudarella:modoNota",
  }),
);
