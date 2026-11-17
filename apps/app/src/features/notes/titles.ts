import { listNoteTitles } from "@estudarella/db";
import { useEffect } from "react";
import { create } from "zustand";
import { useLiveQuery } from "../../data/useLiveQuery";

interface NoteTitlesState {
  /** id → título atual de cada nota ativa, da mais recente para a mais antiga. */
  titles: Map<string, string>;
  loaded: boolean;
}

/**
 * Títulos de todas as notas, sempre em dia. Os links dentro do editor leem daqui
 * para mostrar o título atual da nota citada (e não o que valia quando o link foi criado).
 */
export const useNoteTitles = create<NoteTitlesState>(() => ({ titles: new Map(), loaded: false }));

export const noteLabel = (title: string | undefined) => title?.trim() || "Sem título";

/** Sem acentos e em minúsculas, para comparar o que foi digitado com os títulos. */
export const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/** Mantém o store acima sincronizado com o banco. Montado uma vez, no layout do app. */
export function NoteTitlesSync() {
  const { data } = useLiveQuery(["notes"], listNoteTitles);
  useEffect(() => {
    if (data) {
      useNoteTitles.setState({ titles: new Map(data.map((n) => [n.id, n.title])), loaded: true });
    }
  }, [data]);
  return null;
}
