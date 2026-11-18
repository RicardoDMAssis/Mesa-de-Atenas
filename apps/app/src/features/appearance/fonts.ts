import atkinson400 from "../../theme/fonts/atkinson-hyperlegible-latin-400-normal.woff2";
import atkinson700 from "../../theme/fonts/atkinson-hyperlegible-latin-700-normal.woff2";
import jetbrains from "../../theme/fonts/jetbrains-mono-latin-wght-normal.woff2";
import lexend from "../../theme/fonts/lexend-latin-wght-normal.woff2";
import lora from "../../theme/fonts/lora-latin-wght-normal.woff2";
import nunito from "../../theme/fonts/nunito-latin-wght-normal.woff2";

/*
 * Fontes que vêm dentro do app (só o subconjunto latino, que cobre o português),
 * para funcionarem sem internet. Licença: SIL Open Font License (ver fonts/LEIA-ME.md).
 * Cada arquivo só é baixado quando a fonte é usada.
 */

interface Face {
  url: string;
  weight: string;
}

export interface AppFont {
  id: string;
  label: string;
  hint?: string;
  stack: string;
  family?: string;
  faces?: Face[];
}

const SYSTEM = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export const FONTS: AppFont[] = [
  { id: "sistema", label: "Sistema", hint: "A fonte do aparelho", stack: SYSTEM },
  {
    id: "nunito",
    label: "Nunito",
    hint: "Arredondada",
    family: "Estudarella Nunito",
    faces: [{ url: nunito, weight: "200 1000" }],
    stack: `"Estudarella Nunito", ${SYSTEM}`,
  },
  {
    id: "lexend",
    label: "Lexend",
    hint: "Feita para leitura fácil",
    family: "Estudarella Lexend",
    faces: [{ url: lexend, weight: "100 900" }],
    stack: `"Estudarella Lexend", ${SYSTEM}`,
  },
  {
    id: "atkinson",
    label: "Atkinson Hyperlegible",
    hint: "Letras bem distintas",
    family: "Estudarella Atkinson",
    faces: [
      { url: atkinson400, weight: "400" },
      { url: atkinson700, weight: "700" },
    ],
    stack: `"Estudarella Atkinson", ${SYSTEM}`,
  },
  {
    id: "lora",
    label: "Lora",
    hint: "Serifada, de livro",
    family: "Estudarella Lora",
    faces: [{ url: lora, weight: "400 700" }],
    stack: `"Estudarella Lora", Georgia, ui-serif, serif`,
  },
  {
    id: "serifada",
    label: "Serifada do sistema",
    hint: "Georgia ou equivalente",
    stack: 'ui-serif, Georgia, Cambria, "Times New Roman", serif',
  },
  {
    id: "jetbrains",
    label: "JetBrains Mono",
    hint: "Monoespaçada",
    family: "Estudarella Mono",
    faces: [{ url: jetbrains, weight: "100 800" }],
    stack: `"Estudarella Mono", ui-monospace, Menlo, Consolas, monospace`,
  },
];

export const DEFAULT_FONT = "sistema";

export function findFont(id: string): AppFont {
  return FONTS.find((f) => f.id === id) ?? (FONTS[0] as AppFont);
}

const registered = new Set<string>();

/** Registra as @font-face da fonte (uma vez). O arquivo só baixa quando o texto a usa. */
export function registerFont(font: AppFont): void {
  if (!font.family || !font.faces || registered.has(font.id)) return;
  registered.add(font.id);
  for (const face of font.faces) {
    document.fonts.add(
      new FontFace(font.family, `url(${face.url}) format("woff2")`, {
        weight: face.weight,
        display: "swap",
      }),
    );
  }
}
