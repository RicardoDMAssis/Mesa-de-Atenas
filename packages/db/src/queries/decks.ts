import { and, eq, isNull, sql } from "drizzle-orm";
import type { Db } from "../client";
import { cards, decks } from "../schema";
import { active } from "./base";

export type Deck = typeof decks.$inferSelect;

export interface DeckSummary {
  id: string;
  name: string;
  subjectId: string | null;
  total: number;
  /** Cards já vistos que vencem até `cutoff`. */
  due: number;
  /** Cards nunca estudados. */
  fresh: number;
}

/** Baralhos com a contagem de cards. `cutoff` é o fim do dia de estudo. */
export function listDecks(db: Db, cutoff: number): Promise<DeckSummary[]> {
  return db
    .select({
      id: decks.id,
      name: decks.name,
      subjectId: decks.subjectId,
      total: sql<number>`count(${cards.id})`,
      due: sql<number>`coalesce(sum(case when ${cards.state} <> 0 and ${cards.due} <= ${cutoff} then 1 else 0 end), 0)`,
      fresh: sql<number>`coalesce(sum(case when ${cards.state} = 0 then 1 else 0 end), 0)`,
    })
    .from(decks)
    .leftJoin(cards, and(eq(cards.deckId, decks.id), isNull(cards.deletedAt)))
    .where(active(decks))
    .groupBy(decks.id)
    .orderBy(decks.name);
}

export async function getDeck(db: Db, id: string): Promise<Deck | undefined> {
  return db.query.decks.findFirst({ where: and(eq(decks.id, id), active(decks)) });
}

export async function createDeck(
  db: Db,
  input: { name: string; subjectId?: string | null },
): Promise<Deck> {
  const [row] = await db
    .insert(decks)
    .values({ name: input.name.trim(), subjectId: input.subjectId ?? null })
    .returning();
  if (!row) throw new Error("Não foi possível criar o baralho.");
  return row;
}

export async function updateDeck(
  db: Db,
  id: string,
  input: { name: string; subjectId: string | null },
): Promise<void> {
  await db
    .update(decks)
    .set({ name: input.name.trim(), subjectId: input.subjectId })
    .where(eq(decks.id, id));
}

/** Exclui o baralho e seus cards. */
export async function deleteDeck(db: Db, id: string): Promise<void> {
  const now = Date.now();
  await db.batch([
    db.update(decks).set({ deletedAt: now, updatedAt: now }).where(eq(decks.id, id)),
    db
      .update(cards)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(cards.deckId, id), active(cards))),
  ]);
}
