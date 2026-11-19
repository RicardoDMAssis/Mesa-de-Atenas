import type { Card } from "@estudarella/db";
import type { BatchCardItem, PluginContext } from "@estudarella/plugin-api";
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
  pluginId: string;
  pluginName: string;
  front: string;
  back: string;
  /** Card visual: desenhado pelo plugin; `front`/`back` (e `image`) são a reserva. */
  visual?: { pluginId: string; content: unknown; image?: string };
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

/**
 * Pedidos de plugins que o usuário precisa confirmar numa tela do app (Fase 4.1): criar vários
 * cards, corrigir ou excluir cards do plugin, escolher um arquivo, criar uma nota. Um por vez: um pedido novo
 * cancela o anterior (que recebe a resposta "nada feito").
 */
export type CardRequest =
  | {
      kind: "batch";
      pluginId: string;
      pluginName: string;
      items: BatchCardItem[];
      deckName?: string;
      resolve: (ids: string[]) => void;
    }
  | {
      kind: "update";
      pluginName: string;
      changes: { card: Card; front?: string; back?: string }[];
      resolve: (updated: number) => void;
    }
  | {
      kind: "delete";
      pluginName: string;
      cards: Card[];
      resolve: (deleted: number) => void;
    }
  | {
      kind: "note";
      pluginId: string;
      pluginName: string;
      title: string;
      text: string;
      embed?: { data: unknown; label: string; thumbnail?: string };
      resolve: (noteId: string | null) => void;
    }
  | {
      kind: "pickFile";
      pluginName: string;
      accept?: string[];
      resolve: (file: File | null) => void;
    };

type Pending<K extends CardRequest["kind"]> = Omit<Extract<CardRequest, { kind: K }>, "resolve">;
type Answer<K extends CardRequest["kind"]> = Parameters<
  Extract<CardRequest, { kind: K }>["resolve"]
>[0];

const EMPTY: { [K in CardRequest["kind"]]: Answer<K> } = {
  batch: [],
  update: 0,
  delete: 0,
  pickFile: null,
  note: null,
};

export const usePluginRequest = create<{
  request: CardRequest | null;
  ask: <K extends CardRequest["kind"]>(request: Pending<K> & { kind: K }) => Promise<Answer<K>>;
}>((set, get) => ({
  request: null,
  ask: (request) =>
    new Promise((resolve) => {
      const previous = get().request;
      // biome-ignore lint/suspicious/noExplicitAny: a resposta vazia combina com o tipo do pedido
      if (previous) (previous.resolve as (v: any) => void)(EMPTY[previous.kind]);
      set({
        request: {
          ...request,
          resolve: (answer: unknown) => {
            set({ request: null });
            resolve(answer as never);
          },
        } as CardRequest,
      });
    }),
}));
