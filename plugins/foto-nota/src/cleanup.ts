/**
 * Arruma o texto lido de uma foto para virar nota: junta as linhas quebradas pela largura da
 * página, desfaz hifenização no fim da linha, transforma marcadores (•, –, ·) em lista e tira
 * linhas que são só sujeira (riscos, pontos soltos).
 */

const BULLET = /^\s*[•·▪◦●■□○*–—-]\s+(.+)$/;
const NUMBERED = /^\s*(\d{1,3}[.)]|[a-z][)])\s+\S/i;
/** Linha sem nenhuma letra ou número (ou com só um caractere): sujeira da leitura. */
const NOISE = /^[^\p{L}\p{N}]*$|^.$/u;

export interface TidyOptions {
  /** Mantém as quebras de linha como estão na foto (bom para poemas, tabelas, código). */
  keepLines?: boolean;
}

/**
 * Junta duas linhas: "pala-" + "vra" vira "palavra"; "Hispano-" + "Americana" mantém o hífen
 * (palavra composta); no resto, um espaço.
 */
function join(previous: string, next: string): string {
  if (/\p{L}-$/u.test(previous)) {
    return /^\p{Ll}/u.test(next) ? previous.slice(0, -1) + next : previous + next;
  }
  return `${previous} ${next}`;
}

export function tidyOcrText(raw: string, options: TidyOptions = {}): string {
  const paragraphs = raw
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t ]+/g, " ")
    .split(/\n\s*\n/);

  const out: string[] = [];
  for (const paragraph of paragraphs) {
    const lines = paragraph
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !NOISE.test(l));
    if (lines.length === 0) continue;

    const result: string[] = [];
    for (const line of lines) {
      const bullet = BULLET.exec(line);
      if (bullet) {
        result.push(`- ${bullet[1]?.trim()}`);
        continue;
      }
      const last = result.at(-1);
      const startsItem = NUMBERED.test(line);
      if (last === undefined || options.keepLines || startsItem) {
        result.push(line);
      } else {
        result[result.length - 1] = join(last, line);
      }
    }
    out.push(result.join("\n"));
  }
  return out.join("\n\n");
}

/** Sugestão de título: a primeira linha, se for curta e estiver sozinha no seu parágrafo. */
export function guessTitle(text: string): { title: string; rest: string } {
  const [first, ...others] = text.split("\n\n");
  const line = first?.trim() ?? "";
  if (
    line &&
    !line.includes("\n") &&
    line.length <= 80 &&
    !line.startsWith("- ") &&
    others.length
  ) {
    return { title: line.replace(/[.:]$/, ""), rest: others.join("\n\n") };
  }
  return { title: "", rest: text };
}

/** Linha lida, com a caixa dela na imagem. */
export interface OcrLine {
  text: string;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export interface OcrBlock {
  paragraphs: { lines: OcrLine[] }[];
}

const STARTS_BULLET = /^\s*[•·▪◦●■□○*–—-]\s/;

/**
 * Monta o texto a partir das linhas e das posições delas. O texto simples do leitor quase nunca
 * separa parágrafos; aqui, o parágrafo termina quando:
 * - a linha é bem mais curta que as linhas cheias do bloco (última linha, título ou item);
 * - o espaço até a próxima linha é bem maior que o normal entre linhas;
 * - a próxima linha começa com recuo.
 * Itens de lista seguidos continuam juntos.
 */
export function layoutText(blocks: OcrBlock[]): string {
  const paragraphs: string[] = [];
  for (const block of blocks) {
    const lines = block.paragraphs.flatMap((p) => p.lines);
    const widths = lines.map((l) => l.x1 - l.x0).sort((a, b) => a - b);
    const full = widths[Math.floor(widths.length * 0.75)] ?? 0;
    // Distância normal entre linhas (do topo de uma ao topo da seguinte) e a margem esquerda.
    const steps = lines
      .slice(1)
      .map((l, i) => l.y0 - (lines[i]?.y0 ?? l.y0))
      .filter((d) => d > 0)
      .sort((a, b) => a - b);
    const step = steps[Math.floor(steps.length / 2)] ?? 0;
    const left = Math.min(...lines.map((l) => l.x0));
    for (const paragraph of block.paragraphs) {
      let current: string[] = [];
      paragraph.lines.forEach((line, i) => {
        const text = line.text.trim();
        if (!text) return;
        current.push(text);
        const following = paragraph.lines[i + 1];
        const next = following?.text.trim();
        if (!following || !next) return;
        const short = line.x1 - line.x0 < full * 0.8;
        const gap = step > 0 && following.y0 - line.y0 > step * 1.4;
        // Recuo depois de um item de lista é só a continuação do item.
        const inItem = STARTS_BULLET.test(current[0] ?? "") || NUMBERED.test(current[0] ?? "");
        const indent =
          !inItem && following.x0 - left > full * 0.03 && following.x0 - line.x0 > full * 0.03;
        const listGoesOn = STARTS_BULLET.test(text) && STARTS_BULLET.test(next);
        if ((short || gap || indent) && !listGoesOn) {
          paragraphs.push(current.join("\n"));
          current = [];
        }
      });
      if (current.length) paragraphs.push(current.join("\n"));
    }
  }
  return paragraphs.join("\n\n");
}
