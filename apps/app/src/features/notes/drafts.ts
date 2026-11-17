import type { EditorSnapshot } from "./NoteEditor";

/**
 * Rascunho local da nota, gravado de forma síncrona a cada alteração. O banco é
 * salvo de forma assíncrona e o navegador não espera por ele ao recarregar ou
 * fechar; o rascunho garante que a última edição não se perca.
 */
export interface NoteDraft {
  title: string;
  body: EditorSnapshot | null;
  at: number;
}

const key = (id: string) => `estudarella:rascunho:${id}`;

export function saveDraft(id: string, draft: NoteDraft) {
  try {
    localStorage.setItem(key(id), JSON.stringify(draft));
  } catch {
    // Sem espaço ou sem armazenamento: o salvamento normal continua.
  }
}

export function readDraft(id: string): NoteDraft | null {
  try {
    const raw = localStorage.getItem(key(id));
    return raw ? (JSON.parse(raw) as NoteDraft) : null;
  } catch {
    return null;
  }
}

export function clearDraft(id: string) {
  try {
    localStorage.removeItem(key(id));
  } catch {
    // Nada a limpar.
  }
}
