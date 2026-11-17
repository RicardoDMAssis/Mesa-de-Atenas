import { and, asc, eq, gte, lte, sql } from "drizzle-orm";
import type { Db } from "../client";
import { cards, decks, reviewLogs } from "../schema";
import { active } from "./base";

export type Card = typeof cards.$inferSelect;

/** Frente e verso, cada lado com uma imagem opcional (hash no armazenamento de arquivos). */
export interface BasicContent {
  front: string;
  back: string;
  frontImage?: string;
  backImage?: string;
}

/** Texto com lacunas `{{c1::...}}`; este card esconde a lacuna de número `index`. */
export interface ClozeContent {
  text: string;
  index: number;
  extra?: string;
}

/** Estado de agendamento de um card, como devolvido por `packages/core/srs`. */
export interface Scheduling {
  srs: Record<string, unknown>;
  due: number;
  state: number;
  reps: number;
  lapses: number;
  lastReview: number | null;
}

export function listCards(db: Db, deckId: string): Promise<Card[]> {
  return db
    .select()
    .from(cards)
    .where(and(eq(cards.deckId, deckId), active(cards)))
    .orderBy(asc(cards.createdAt), asc(cards.id));
}

export async function getCard(db: Db, id: string): Promise<Card | undefined> {
  return db.query.cards.findFirst({ where: and(eq(cards.id, id), active(cards)) });
}

export type NewCard =
  | { type: "basic"; content: BasicContent }
  | { type: "cloze"; content: ClozeContent };

/** Cria um ou mais cards de uma vez (um texto com várias lacunas gera vários). */
export async function createCards(
  db: Db,
  deckId: string,
  items: NewCard[],
  initial: Scheduling,
): Promise<void> {
  if (items.length === 0) return;
  await db.insert(cards).values(items.map((item) => ({ deckId, ...item, ...initial })));
}

export function updateCardContent(db: Db, id: string, content: BasicContent | ClozeContent) {
  return db.update(cards).set({ content }).where(eq(cards.id, id));
}

export function deleteCard(db: Db, id: string) {
  const now = Date.now();
  return db.update(cards).set({ deletedAt: now, updatedAt: now }).where(eq(cards.id, id));
}

/**
 * Fila de estudo: cards que vencem até `cutoff` (fim do dia de estudo), de um
 * baralho ou de todos. Primeiro os já vistos, do mais atrasado ao menos; depois os novos.
 */
export function dueCards(
  db: Db,
  options: { deckId?: string; cutoff: number; limit?: number },
): Promise<Card[]> {
  return db
    .select({ card: cards })
    .from(cards)
    .innerJoin(decks, eq(decks.id, cards.deckId))
    .where(
      and(
        active(cards),
        active(decks),
        lte(cards.due, options.cutoff),
        options.deckId ? eq(cards.deckId, options.deckId) : undefined,
      ),
    )
    .orderBy(sql`${cards.state} = 0`, asc(cards.due), asc(cards.createdAt))
    .limit(options.limit ?? 200)
    .then((rows) => rows.map((r) => r.card));
}

export interface ReviewRecord {
  rating: number;
  /** Estado do card antes da resposta. */
  state: number;
  reviewedAt: number;
  durationMs?: number;
  data: Record<string, unknown>;
}

/** Grava o novo agendamento e o histórico da resposta em um único lote. */
export async function recordReview(
  db: Db,
  cardId: string,
  next: Scheduling,
  log: ReviewRecord,
): Promise<void> {
  await db.batch([
    db.update(cards).set(next).where(eq(cards.id, cardId)),
    db.insert(reviewLogs).values({ cardId, ...log }),
  ]);
}

/** Quantas respostas foram dadas desde `since` (ex.: início do dia de estudo). */
export async function countReviewsSince(db: Db, since: number): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(reviewLogs)
    .where(and(gte(reviewLogs.reviewedAt, since), active(reviewLogs)));
  return row?.n ?? 0;
}
