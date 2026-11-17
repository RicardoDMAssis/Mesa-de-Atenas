// {{c1::resposta}} ou {{c1::resposta::dica}}
const CLOZE = /\{\{c(\d+)::(.*?)(?:::(.*?))?\}\}/gs;

/** Números de lacuna presentes no texto, em ordem e sem repetição. */
export function clozeIndexes(text: string): number[] {
  const found = new Set<number>();
  for (const match of text.matchAll(CLOZE)) found.add(Number(match[1]));
  return [...found].sort((a, b) => a - b);
}

/** Próximo número livre, para marcar uma nova lacuna. */
export function nextClozeIndex(text: string): number {
  return Math.max(0, ...clozeIndexes(text)) + 1;
}

export interface ClozeSegment {
  kind: "text" | "hidden" | "answer";
  text: string;
  hint?: string;
}

/**
 * Divide o texto para exibição do card que pergunta a lacuna `index`.
 * Essa lacuna aparece escondida (ou destacada, se `revealed`); as demais viram texto comum.
 */
export function renderCloze(text: string, index: number, revealed: boolean): ClozeSegment[] {
  const segments: ClozeSegment[] = [];
  const push = (segment: ClozeSegment) => {
    const last = segments.at(-1);
    if (segment.kind === "text" && last?.kind === "text") last.text += segment.text;
    else if (segment.text !== "" || segment.kind !== "text") segments.push(segment);
  };
  let cursor = 0;
  for (const match of text.matchAll(CLOZE)) {
    const [whole, number, answer = "", hint] = match;
    push({ kind: "text", text: text.slice(cursor, match.index) });
    if (Number(number) !== index) push({ kind: "text", text: answer });
    else if (revealed) push({ kind: "answer", text: answer });
    else push({ kind: "hidden", text: answer, hint });
    cursor = match.index + whole.length;
  }
  push({ kind: "text", text: text.slice(cursor) });
  return segments;
}
