import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_FONT, findFont, registerFont } from "../features/appearance/fonts";
import { DEFAULT_PALETTE, resolveTokens } from "../features/appearance/palettes";
import type { ResolvedTheme } from "./theme";

export interface BackgroundSettings {
  /** Hash da imagem no armazenamento de arquivos do aparelho. */
  hash: string;
  /** Quanto a cor de fundo cobre a imagem, de 0 a 90 (%). */
  dim: number;
  /** Desfoque da imagem, em px. */
  blur: number;
  /** Opacidade dos painéis sobre a imagem, de 40 a 100 (%). */
  panels: number;
}

export interface AppearanceValues {
  palette: string;
  /** Cor de destaque própria (#rrggbb), por cima da paleta. */
  customAccent: string | null;
  font: string;
  /** Fonte do texto das notas; `null` usa a mesma do app. */
  noteFont: string | null;
  /** Tamanho do texto, em relação ao padrão (1 = 100%). */
  textScale: number;
  background: BackgroundSettings | null;
}

interface AppearanceState extends AppearanceValues {
  set: (values: Partial<AppearanceValues>) => void;
  setBackground: (values: Partial<BackgroundSettings>) => void;
  reset: () => void;
}

export const APPEARANCE_DEFAULTS: AppearanceValues = {
  palette: DEFAULT_PALETTE,
  customAccent: null,
  font: DEFAULT_FONT,
  noteFont: null,
  textScale: 1,
  background: null,
};

export const BACKGROUND_DEFAULTS: Omit<BackgroundSettings, "hash"> = {
  dim: 45,
  blur: 0,
  panels: 85,
};

/**
 * Aparência é preferência do aparelho, como o tema: fica no armazenamento local,
 * não sincroniza e não entra no backup (a imagem de fundo também é só deste aparelho).
 */
export const useAppearanceStore = create<AppearanceState>()(
  persist(
    (set) => ({
      ...APPEARANCE_DEFAULTS,
      set: (values) => set(values),
      setBackground: (values) =>
        set((s) => (s.background ? { background: { ...s.background, ...values } } : {})),
      reset: () => set(APPEARANCE_DEFAULTS),
    }),
    { name: "estudarella:appearance" },
  ),
);

/** Chave lida pelo script de `index.html` para aplicar as cores antes da primeira pintura. */
const PAINT_CACHE = "estudarella:appearance-paint";

const currentTheme = (): ResolvedTheme =>
  document.documentElement.dataset.theme === "dark" ? "dark" : "light";

/** Aplica cores, fontes, tamanho e o estado do fundo ao documento. */
export function applyAppearance(): void {
  const state = useAppearanceStore.getState();
  const root = document.documentElement;
  const theme = currentTheme();

  for (const [name, value] of Object.entries(
    resolveTokens(state.palette, state.customAccent, theme),
  )) {
    root.style.setProperty(name, value);
  }

  const font = findFont(state.font);
  const noteFont = findFont(state.noteFont ?? state.font);
  registerFont(font);
  registerFont(noteFont);
  root.style.setProperty("--app-font", font.stack);
  root.style.setProperty("--note-font", noteFont.stack);
  root.style.fontSize = state.textScale === 1 ? "" : `${state.textScale * 100}%`;

  if (state.background) {
    root.dataset.bg = "";
    root.style.setProperty("--panel-opacity", `${state.background.panels}%`);
  } else {
    delete root.dataset.bg;
    root.style.removeProperty("--panel-opacity");
  }

  const accent = getComputedStyle(root).getPropertyValue("--accent").trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", accent);

  try {
    localStorage.setItem(
      PAINT_CACHE,
      JSON.stringify({
        light: resolveTokens(state.palette, state.customAccent, "light"),
        dark: resolveTokens(state.palette, state.customAccent, "dark"),
        textScale: state.textScale,
      }),
    );
  } catch {
    // Sem armazenamento local: só perde a aplicação antecipada.
  }
}

/** Mantém a aparência aplicada quando ela muda. O tema chama `applyAppearance` por conta própria. */
export function watchAppearance(): () => void {
  applyAppearance();
  return useAppearanceStore.subscribe(applyAppearance);
}
