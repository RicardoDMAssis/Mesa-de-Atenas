import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Um widget no Início: `app:<id>` (do app) ou `plugin:<pluginId>:<widgetId>`. */
export interface HomeItem {
  key: string;
  /** Configuração própria do widget (ex.: telas do widget Atalhos). */
  config?: { screens?: string[] };
}

export const DEFAULT_LAYOUT: HomeItem[] = [
  { key: "app:sequencia" },
  { key: "app:hoje" },
  { key: "app:atalhos", config: { screens: ["notas", "revisao", "busca", "grafo"] } },
  { key: "app:foco" },
  { key: "app:notas-recentes" },
];

export const MAX_PLUGIN_WIDGETS = 4;

interface HomeLayout {
  items: HomeItem[];
  add: (item: HomeItem) => void;
  remove: (key: string) => void;
  /** Move uma posição para cima (-1) ou para baixo (+1). */
  move: (key: string, step: -1 | 1) => void;
  configure: (key: string, config: HomeItem["config"]) => void;
  reset: () => void;
}

/** Arranjo do Início, salvo no aparelho (celular e computador podem ser diferentes). */
export const useHomeLayout = create<HomeLayout>()(
  persist(
    (set) => ({
      items: DEFAULT_LAYOUT,
      add: (item) =>
        set((s) => (s.items.some((i) => i.key === item.key) ? s : { items: [...s.items, item] })),
      remove: (key) => set((s) => ({ items: s.items.filter((i) => i.key !== key) })),
      move: (key, step) =>
        set((s) => {
          const items = [...s.items];
          const from = items.findIndex((i) => i.key === key);
          const to = from + step;
          if (from < 0 || to < 0 || to >= items.length) return s;
          [items[from], items[to]] = [items[to] as HomeItem, items[from] as HomeItem];
          return { items };
        }),
      configure: (key, config) =>
        set((s) => ({ items: s.items.map((i) => (i.key === key ? { ...i, config } : i)) })),
      reset: () => set({ items: DEFAULT_LAYOUT }),
    }),
    { name: "estudarella:inicio", partialize: (s) => ({ items: s.items }) },
  ),
);
