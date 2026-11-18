/**
 * Motor de destaques: acha, num texto, os termos definidos pelos plugins.
 *
 * - Palavra inteira: "ato" não casa dentro de "contato".
 * - Sem diferenciar maiúsculas; acentos opcionais por regra ("fonetica" casa "fonética").
 * - Termos podem ter números e sinais ("H2O", "Fe3+").
 * - Sobreposição: vale o termo mais longo; empate, a regra que veio antes.
 *
 * As posições devolvidas são as do texto original (o texto nunca muda).
 */

export interface HighlightTerm<R> {
  term: string;
  ignoreAccents: boolean;
  /** Qualquer dado da regra, devolvido junto com cada ocorrência. */
  rule: R;
}

export interface HighlightMatch<R> {
  from: number;
  to: number;
  rule: R;
}

interface Node<R> {
  next: Map<string, Node<R>>;
  /** Regra que termina aqui (a primeira cadastrada vence). */
  rule?: R;
}

/** Letra ou número (inclui letras acentuadas de qualquer língua). */
const WORD = /[\p{L}\p{N}]/u;
const isWord = (ch: string | undefined) => ch !== undefined && WORD.test(ch);

/** Minúscula e, se pedido, sem acento, mantendo um caractere por caractere (posições iguais). */
function foldChar(ch: string, accents: boolean): string {
  const lower = ch.toLowerCase();
  if (!accents) return lower.length === 1 ? lower : ch;
  const base = lower.normalize("NFD").replace(/[̀-ͯ]/g, "");
  return base.length === 1 ? base : lower.length === 1 ? lower : ch;
}

const foldText = (text: string, accents: boolean) =>
  Array.from(text, (ch) => foldChar(ch, accents)).join("");

export interface Highlighter<R> {
  find(text: string, limit?: number): HighlightMatch<R>[];
  readonly size: number;
}

/** Compila as regras num buscador único (uma árvore de prefixos para cada modo de acento). */
export function compileHighlights<R>(terms: HighlightTerm<R>[]): Highlighter<R> {
  const roots = { accents: { next: new Map() } as Node<R>, exact: { next: new Map() } as Node<R> };
  let size = 0;
  for (const { term, ignoreAccents, rule } of terms) {
    const clean = term.trim();
    if (!clean) continue;
    let node = ignoreAccents ? roots.accents : roots.exact;
    for (const ch of foldText(clean, ignoreAccents)) {
      let child = node.next.get(ch);
      if (!child) {
        child = { next: new Map() };
        node.next.set(ch, child);
      }
      node = child;
    }
    if (node.rule === undefined) {
      node.rule = rule;
      size++;
    }
  }

  /** Maior termo que começa em `start` e termina em fim de palavra: [fim, regra]. */
  function longest(folded: string[], original: string[], start: number, root: Node<R>) {
    let node: Node<R> | undefined = root;
    let best: [number, R] | null = null;
    for (let i = start; i < folded.length && node; i++) {
      node = node.next.get(folded[i] as string);
      if (node?.rule !== undefined && !isWord(original[i + 1])) best = [i + 1, node.rule];
    }
    return best;
  }

  return {
    size,
    find(text, limit = 2000) {
      if (size === 0 || !text) return [];
      const original = Array.from(text);
      const withAccents = Array.from(foldText(text, true));
      const exact = Array.from(foldText(text, false));
      // Posições em código (UTF-16) de cada caractere, para devolver índices do texto original.
      const offsets: number[] = [];
      let pos = 0;
      for (const ch of original) {
        offsets.push(pos);
        pos += ch.length;
      }
      offsets.push(pos);

      const out: HighlightMatch<R>[] = [];
      for (let i = 0; i < original.length && out.length < limit; i++) {
        if (isWord(original[i - 1])) continue; // só começa no início de uma palavra
        const a = longest(withAccents, original, i, roots.accents);
        const b = longest(exact, original, i, roots.exact);
        const hit = a && b ? (b[0] > a[0] ? b : a) : (a ?? b);
        if (!hit) continue;
        out.push({ from: offsets[i] as number, to: offsets[hit[0]] as number, rule: hit[1] });
        i = hit[0] - 1;
      }
      return out;
    },
  };
}

/**
 * Partes de uma fórmula química que aparecem como subscrito (quantidades) ou sobrescrito
 * (cargas). Ex.: "H2SO4" → subscrito em "2" e "4"; "Fe3+" → sobrescrito em "3+";
 * "SO4 2-" → subscrito em "4" e sobrescrito em "2-". Posições relativas ao termo.
 */
export function formulaParts(term: string): { from: number; to: number; kind: "sub" | "sup" }[] {
  const parts: { from: number; to: number; kind: "sub" | "sup" }[] = [];
  // Carga no fim: "3+", "2-", "+", "-" (opcionalmente depois de um espaço ou "^").
  const charge = /(?:\s|\^)?(\d*[+-])$/.exec(term);
  const body = charge ? term.slice(0, charge.index) : term;
  const digits = /(?<=[\p{L})\]])\d+/gu;
  for (let m = digits.exec(body); m; m = digits.exec(body)) {
    parts.push({ from: m.index, to: m.index + m[0].length, kind: "sub" });
  }
  if (charge?.[1]) {
    const from = term.length - charge[1].length;
    parts.push({ from, to: term.length, kind: "sup" });
  }
  return parts;
}
