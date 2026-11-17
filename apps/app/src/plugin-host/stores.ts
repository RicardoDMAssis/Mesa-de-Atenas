import type { PluginContext } from "@estudarella/plugin-api";
import type { Editor } from "@tiptap/react";
import { create } from "zustand";

/** Nota aberta no momento (o que os plugins com `notes:*` enxergam). */
export const useActiveNote = create<{
  note: { id: string; title: string } | null;
  editor: Editor | null;
}>(() => ({ note: null, editor: null }));

/** Painel de plugin aberto (lateral no computador, folha inferior no celular). */
export const usePluginPanel = create<{
  open: { pluginId: string; context: PluginContext } | null;
  show: (pluginId: string, context: PluginContext) => void;
  close: () => void;
}>((set) => ({
  open: null,
  show: (pluginId, context) => set({ open: { pluginId, context } }),
  close: () => set({ open: null }),
}));

export interface CardProposal {
  pluginName: string;
  front: string;
  back: string;
  resolve: (created: boolean) => void;
}

/** Card proposto por um plugin, à espera da confirmação do usuário. */
export const useCardProposal = create<{
  proposal: CardProposal | null;
  propose: (p: Omit<CardProposal, "resolve">) => Promise<boolean>;
}>((set, get) => ({
  proposal: null,
  propose: (p) =>
    new Promise<boolean>((resolve) => {
      get().proposal?.resolve(false); // uma proposta por vez
      set({
        proposal: {
          ...p,
          resolve: (created) => {
            set({ proposal: null });
            resolve(created);
          },
        },
      });
    }),
}));
