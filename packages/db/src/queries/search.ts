import { inArray, sql } from "drizzle-orm";
import type { Db } from "../client";
import { cards } from "../schema";

export interface SearchHit {
  kind: "note" | "card";
  id: string;
  title: string;
  /** Trecho do texto; os termos encontrados ficam entre `SNIPPET_OPEN` e `SNIPPET_CLOSE`. */
  snippet: string;
  /** Baralho do card (ausente em notas). */
  deckId?: string;
}

// Marcadores invisíveis, que não aparecem em texto digitado.
export const SNIPPET_OPEN = "\u0001";
export const SNIPPET_CLOSE = "\u0002";

/**
 * Converte o que o usuário digitou em uma consulta FTS5 segura: cada palavra
 * vira um termo entre aspas com busca por prefixo. Devolve `null` se não sobrar nada.
 */
export function buildFtsQuery(input: string): string | null {
  const words = input.match(/[\p{L}\p{N}]+/gu) ?? [];
  if (words.length === 0) return null;
  return words.map((word) => `"${word}"*`).join(" ");
}

/** Busca em notas e cards, sem diferenciar maiúsculas ou acentos. */
export async function search(db: Db, input: string, limit = 40): Promise<SearchHit[]> {
  const query = buildFtsQuery(input);
  if (!query) return [];
  const rows = await db.values<[string, string, string, string]>(sql`
    SELECT kind, ref_id, title, snippet(search_index, -1, ${SNIPPET_OPEN}, ${SNIPPET_CLOSE}, '…', 14)
    FROM search_index
    WHERE search_index MATCH ${query}
    ORDER BY rank
    LIMIT ${limit}
  `);
  const cardIds = rows.filter(([kind]) => kind === "card").map(([, id]) => id);
  const decksOf = new Map(
    cardIds.length > 0
      ? (
          await db
            .select({ id: cards.id, deckId: cards.deckId })
            .from(cards)
            .where(inArray(cards.id, cardIds))
        ).map((c) => [c.id, c.deckId])
      : [],
  );
  return rows.map(([kind, id, title, snippet]) => ({
    kind: kind as SearchHit["kind"],
    id,
    title,
    snippet,
    deckId: decksOf.get(id),
  }));
}

/** Todas as notas e cards ativos (busca com o campo vazio): notas recentes primeiro, depois cards. */
export async function listAllSearchable(db: Db, limit = 200): Promise<SearchHit[]> {
  const rows = await db.values<[string, string, string, string, string | null]>(sql`
    SELECT kind, ref_id, title, substr(body, 1, 160),
      (SELECT deck_id FROM cards WHERE cards.id = search_index.ref_id)
    FROM search_index
    ORDER BY kind DESC, rowid DESC
    LIMIT ${limit}
  `);
  return rows.map(([kind, id, title, snippet, deckId]) => ({
    kind: kind as SearchHit["kind"],
    id,
    title,
    snippet: snippet.trim(),
    deckId: deckId ?? undefined,
  }));
}
