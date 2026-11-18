import type { ResolvedTheme } from "../../stores/theme";

/** Os mesmos tokens de `theme/index.css`. Uma paleta dá valores para o claro e o escuro. */
export interface Tokens {
  "--bg": string;
  "--surface": string;
  "--text": string;
  "--muted": string;
  "--border": string;
  "--accent": string;
  "--accent-contrast": string;
  "--accent-soft": string;
  "--ok": string;
  "--danger": string;
}

export interface Palette {
  id: string;
  label: string;
  light: Tokens;
  dark: Tokens;
}

const OK_DANGER_LIGHT = { "--ok": "#1f7a4d", "--danger": "#b3261e" };
const OK_DANGER_DARK = { "--ok": "#5fd39a", "--danger": "#ff8a80" };

function palette(
  id: string,
  label: string,
  light: [string, string, string, string, string, string, string, string],
  dark: [string, string, string, string, string, string, string, string],
  extra?: { light?: Partial<Tokens>; dark?: Partial<Tokens> },
): Palette {
  const tokens = (
    [bg, surface, text, muted, border, accent, contrast, soft]: typeof light,
    base: Pick<Tokens, "--ok" | "--danger">,
  ): Tokens => ({
    "--bg": bg,
    "--surface": surface,
    "--text": text,
    "--muted": muted,
    "--border": border,
    "--accent": accent,
    "--accent-contrast": contrast,
    "--accent-soft": soft,
    ...base,
  });
  return {
    id,
    label,
    light: { ...tokens(light, OK_DANGER_LIGHT), ...extra?.light },
    dark: { ...tokens(dark, OK_DANGER_DARK), ...extra?.dark },
  };
}

// Ordem das cores: fundo, painel, texto, texto suave, borda, destaque, texto sobre o destaque, destaque suave.
export const PALETTES: Palette[] = [
  palette(
    "lavanda",
    "Lavanda",
    ["#faf9f6", "#ffffff", "#1f1d1a", "#6d675f", "#e5e1d9", "#5b4bd6", "#ffffff", "#eeebfd"],
    ["#141316", "#1d1c21", "#ece9f1", "#a29dae", "#2f2d36", "#9d90ff", "#15131f", "#2a2647"],
  ),
  palette(
    "oceano",
    "Oceano",
    ["#f5f8fa", "#ffffff", "#14212b", "#5b6b78", "#dbe4ea", "#0b6e99", "#ffffff", "#e0f0f7"],
    ["#0e1519", "#152026", "#e4eef3", "#93a7b3", "#24343d", "#5cc3ea", "#062030", "#133847"],
  ),
  palette(
    "floresta",
    "Floresta",
    ["#f6f8f4", "#ffffff", "#1a2118", "#5f6b5a", "#dde3d7", "#2f7a3e", "#ffffff", "#e3f1e4"],
    ["#111611", "#1a201a", "#e6eee4", "#9aaa96", "#2a332a", "#7fd18d", "#0d1f11", "#1f3524"],
  ),
  palette(
    "por-do-sol",
    "Pôr do sol",
    ["#fbf7f3", "#ffffff", "#261c16", "#75655a", "#ece0d5", "#c2410c", "#ffffff", "#fdeadf"],
    ["#17120f", "#211a16", "#f3e9e2", "#b3a196", "#382c25", "#ff9a62", "#2a1206", "#3d2518"],
  ),
  palette(
    "cerejeira",
    "Cerejeira",
    ["#fcf7f8", "#ffffff", "#2a1a20", "#7a6068", "#efdfe4", "#be2f6a", "#ffffff", "#fbe6ee"],
    ["#171114", "#21181c", "#f4e7ec", "#b89ea8", "#3a2a31", "#ff8fb8", "#2b0a18", "#43202f"],
  ),
  palette(
    "sepia",
    "Sépia",
    ["#f4ecd8", "#fbf5e6", "#3b2f20", "#7a6a52", "#e2d5b8", "#8a5a19", "#ffffff", "#efe0bf"],
    ["#1c1812", "#252019", "#e9dcc3", "#a8987c", "#3a3226", "#d9a55b", "#22180a", "#3b2f1d"],
  ),
  palette(
    "grafite",
    "Grafite",
    ["#f7f7f7", "#ffffff", "#171717", "#636363", "#e2e2e2", "#262626", "#ffffff", "#ececec"],
    ["#111111", "#1b1b1b", "#ededed", "#a3a3a3", "#2e2e2e", "#e5e5e5", "#111111", "#2a2a2a"],
  ),
  palette(
    "alto-contraste",
    "Alto contraste",
    ["#ffffff", "#ffffff", "#000000", "#333333", "#000000", "#0000c8", "#ffffff", "#e0e0ff"],
    ["#000000", "#000000", "#ffffff", "#d0d0d0", "#ffffff", "#ffd400", "#000000", "#332b00"],
    {
      light: { "--ok": "#006b2e", "--danger": "#a00000" },
      dark: { "--ok": "#5dff9d", "--danger": "#ff6b6b" },
    },
  ),
];

export const DEFAULT_PALETTE = "lavanda";

export function findPalette(id: string): Palette {
  return PALETTES.find((p) => p.id === id) ?? (PALETTES[0] as Palette);
}

/** Texto preto ou branco, o que tiver mais contraste com a cor (#rrggbb). */
export function contrastFor(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.36 ? "#000000" : "#ffffff";
}

export const isHexColor = (value: string) => /^#[0-9a-f]{6}$/i.test(value);

/** Tokens finais: a paleta escolhida, com a cor de destaque própria por cima, se houver. */
export function resolveTokens(
  paletteId: string,
  customAccent: string | null,
  theme: ResolvedTheme,
): Tokens {
  const tokens = { ...findPalette(paletteId)[theme] };
  if (customAccent && isHexColor(customAccent)) {
    tokens["--accent"] = customAccent;
    tokens["--accent-contrast"] = contrastFor(customAccent);
    tokens["--accent-soft"] =
      `color-mix(in srgb, ${customAccent} ${theme === "dark" ? 22 : 14}%, ${tokens["--surface"]})`;
  }
  return tokens;
}
