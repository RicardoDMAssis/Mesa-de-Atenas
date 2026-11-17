import {
  BookOpen,
  ChartColumn,
  House,
  Layers,
  type LucideIcon,
  Puzzle,
  Search,
  Settings,
  Timer,
  Waypoints,
} from "lucide-react";
import { useMemo } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Uma tela principal do app (ou de um plugin) que aparece na navegação. */
export interface Screen {
  id: string;
  label: string;
  to: string;
  icon: LucideIcon;
  /** "app" = tela do app; "plugin" = tela própria de um plugin (Fase 3). */
  group: "app" | "plugin";
  /** Palavras extras para a busca do painel de telas. */
  keywords?: string;
}

export const APP_SCREENS: Screen[] = [
  { id: "inicio", label: "Início", to: "/", icon: House, group: "app", keywords: "home hoje" },
  { id: "notas", label: "Notas", to: "/notas", icon: BookOpen, group: "app" },
  {
    id: "revisao",
    label: "Revisão",
    to: "/revisao",
    icon: Layers,
    group: "app",
    keywords: "baralhos cards flashcards",
  },
  {
    id: "busca",
    label: "Buscar",
    to: "/busca",
    icon: Search,
    group: "app",
    keywords: "procurar pesquisa",
  },
  {
    id: "grafo",
    label: "Grafo",
    to: "/grafo",
    icon: Waypoints,
    group: "app",
    keywords: "mapa conexões",
  },
  { id: "foco", label: "Foco", to: "/foco", icon: Timer, group: "app", keywords: "pomodoro timer" },
  {
    id: "progresso",
    label: "Progresso",
    to: "/progresso",
    icon: ChartColumn,
    group: "app",
    keywords: "sequência estatísticas",
  },
  {
    id: "plugins",
    label: "Plugins",
    to: "/plugins",
    icon: Puzzle,
    group: "app",
    keywords: "extensões",
  },
  {
    id: "ajustes",
    label: "Ajustes",
    to: "/ajustes",
    icon: Settings,
    group: "app",
    keywords: "configurações tema backup",
  },
];

/**
 * Telas registradas por plugins. A Fase 3 preenche este store ao carregar os
 * plugins com ponto de extensão `page`; a navegação já as exibe sem mudanças.
 */
export const usePluginScreens = create<{ screens: Screen[] }>(() => ({ screens: [] }));

export function useScreens(): Screen[] {
  const plugins = usePluginScreens((s) => s.screens);
  return useMemo(() => [...APP_SCREENS, ...plugins], [plugins]);
}

/** Tela principal correspondente a um caminho (`undefined` = subpágina, ex.: uma nota). */
export function screenFor(screens: Screen[], pathname: string): Screen | undefined {
  return screens.find((s) => s.to === pathname);
}

export const MAX_PINNED = 4;

interface NavPrefs {
  /** Telas fixadas na barra inferior do celular, em ordem. */
  pinned: string[];
  /** Telas principais visitadas por último (mais recente primeiro). */
  recent: string[];
  togglePin: (id: string) => void;
  visit: (id: string) => void;
}

/** Preferências de navegação deste aparelho. */
export const useNavPrefs = create<NavPrefs>()(
  persist(
    (set) => ({
      pinned: ["inicio", "notas", "revisao", "grafo"],
      recent: [],
      togglePin: (id) =>
        set((s) =>
          s.pinned.includes(id)
            ? { pinned: s.pinned.filter((p) => p !== id) }
            : s.pinned.length >= MAX_PINNED
              ? s
              : { pinned: [...s.pinned, id] },
        ),
      visit: (id) =>
        set((s) => ({ recent: [id, ...s.recent.filter((r) => r !== id)].slice(0, 6) })),
    }),
    { name: "estudarella:navegacao", partialize: (s) => ({ pinned: s.pinned, recent: s.recent }) },
  ),
);

/** Abre/fecha o painel de telas (botão "Mais" e Ctrl+K). */
export const useLauncher = create<{ open: boolean; setOpen: (open: boolean) => void }>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));
