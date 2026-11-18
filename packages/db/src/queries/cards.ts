import { and, asc, desc, eq, gt, gte, inArray, isNotNull, lte, sql } from "drizzle-orm";
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

/** Versão estática de um card de plugin: aparece na busca, nas listas e quando o plugin falta. */
export interface CardFallback {
  front: string;
  back: string;
  /** Hash de uma imagem no armazenamento de arquivos. */
  imageAssetId?: string;
}

export type NewCard =
  | { type: "basic"; content: BasicContent }
  | { type: "cloze"; content: ClozeContent }
  | { type: "plugin"; pluginId: string; content: unknown; fallback: CardFallback };

/** Cria um ou mais cards de uma vez (um texto com várias lacunas gera vários). */
/** Plugin que criou o card e a chave que ele deu (para achar o card depois). */
export interface CardOrigin {
  pluginId: string;
  key?: string;
}

/** Cria um ou mais cards de uma vez (um texto com várias lacunas gera vários). Devolve os ids. */
export async function createCards(
  db: Db,
  deckId: string,
  items: (NewCard & { origin?: CardOrigin })[],
  initial: Scheduling,
): Promise<string[]> {
  if (items.length === 0) return [];
  const rows = await db
    .insert(cards)
    .values(
      items.map(({ origin, ...item }) => ({
        deckId,
        ...item,
        ...initial,
        originPluginId: origin?.pluginId ?? null,
        originKey: origin?.key ?? null,
      })),
    )
    .returning({ id: cards.id });
  return rows.map((r) => r.id);
}

/** Edição feita pelo usuário no app (marca `edited_at`). */
export async function updateCardContent(
  db: Db,
  id: string,
  content: BasicContent | ClozeContent,
): Promise<void> {
  await db.update(cards).set({ content, editedAt: Date.now() }).where(eq(cards.id, id));
}

/** Personaliza a parte de texto de um card de plugin (pergunta, resposta e imagem). */
export async function updateCardFallback(
  db: Db,
  id: string,
  fallback: CardFallback,
): Promise<void> {
  await db.update(cards).set({ fallback, editedAt: Date.now() }).where(eq(cards.id, id));
}

// ---------- cards criados por plugins (Fase 4.1) ----------

export interface OwnCard {
  id: string;
  key: string | null;
  deckId: string;
  deckName: string;
  type: Card["type"];
  /** Frente e verso como o usuário vê (a reserva, nos cards visuais). */
  front: string;
  back: string;
  /** Dados internos do plugin (só nos cards visuais). */
  content: unknown;
  createdAt: number;
  /** Última edição do usuário no app, se houver. */
  editedAt: number | null;
}

/** Frente e verso que o usuário vê, de qualquer tipo de card. */
export function visibleText(card: Pick<Card, "type" | "content" | "fallback">): {
  front: string;
  back: string;
} {
  if (card.type === "plugin")
    return { front: card.fallback?.front ?? "", back: card.fallback?.back ?? "" };
  if (card.type === "cloze") {
    const c = card.content as ClozeContent;
    return { front: c.text, back: c.extra ?? "" };
  }
  const c = card.content as BasicContent;
  return { front: c.front, back: c.back };
}

const ownedBy = (pluginId: string) =>
  and(eq(cards.originPluginId, pluginId), active(cards), active(decks));

/** Cards criados por um plugin, em ordem de criação, em páginas. */
export async function listOwnCards(
  db: Db,
  pluginId: string,
  options: { deckId?: string; key?: string; after?: string; limit: number },
): Promise<OwnCard[]> {
  const rows = await db
    .select({ card: cards, deckName: decks.name })
    .from(cards)
    .innerJoin(decks, eq(decks.id, cards.deckId))
    .where(
      and(
        ownedBy(pluginId),
        options.deckId ? eq(cards.deckId, options.deckId) : undefined,
        options.key ? eq(cards.originKey, options.key) : undefined,
        // Ids UUID v7 crescem com o tempo: "depois deste" é só comparar.
        options.after ? gt(cards.id, options.after) : undefined,
      ),
    )
    .orderBy(asc(cards.id))
    .limit(options.limit);
  return rows.map(({ card, deckName }) => ({
    id: card.id,
    key: card.originKey,
    deckId: card.deckId,
    deckName,
    type: card.type,
    ...visibleText(card),
    content: card.type === "plugin" ? card.content : null,
    createdAt: card.createdAt,
    editedAt: card.editedAt,
  }));
}

/** Cards deste plugin entre os ids pedidos (os de outros plugins ou do usuário ficam de fora). */
export async function ownCardsByIds(db: Db, pluginId: string, ids: string[]): Promise<Card[]> {
  if (ids.length === 0) return [];
  return db
    .select({ card: cards })
    .from(cards)
    .innerJoin(decks, eq(decks.id, cards.deckId))
    .where(and(ownedBy(pluginId), inArray(cards.id, ids)))
    .then((rows) => rows.map((r) => r.card));
}

/** Chaves que o plugin já usou (para marcar "já existe" num lote). */
export async function existingOwnKeys(
  db: Db,
  pluginId: string,
  keys: string[],
): Promise<Set<string>> {
  if (keys.length === 0) return new Set();
  const rows = await db
    .select({ key: cards.originKey })
    .from(cards)
    .innerJoin(decks, eq(decks.id, cards.deckId))
    .where(and(ownedBy(pluginId), isNotNull(cards.originKey), inArray(cards.originKey, keys)))
    .all();
  return new Set(rows.map((r) => r.key as string));
}

/** Frentes já existentes num baralho (duplicados de itens sem chave). */
export async function existingFronts(db: Db, deckId: string): Promise<Set<string>> {
  const rows = await db
    .select({ card: cards })
    .from(cards)
    .where(and(eq(cards.deckId, deckId), active(cards)));
  return new Set(rows.map((r) => visibleText(r.card).front.trim().toLowerCase()));
}

/** Dado interno de um card visual, trocado pelo plugin (não conta como edição do usuário). */
export async function setPluginCardContent(db: Db, id: string, content: unknown): Promise<void> {
  await db
    .update(cards)
    .set({ content })
    .where(and(eq(cards.id, id), eq(cards.type, "plugin")));
}

/**
 * Aplica um novo texto visível (frente/verso) aceito pelo usuário numa sugestão do plugin.
 * Não marca `edited_at`: a mudança veio do plugin.
 */
export async function applyCardText(
  db: Db,
  card: Card,
  change: { front?: string; back?: string },
): Promise<void> {
  if (card.type === "plugin") {
    const fallback = { ...(card.fallback ?? { front: "", back: "" }) };
    if (change.front !== undefined) fallback.front = change.front;
    if (change.back !== undefined) fallback.back = change.back;
    await db.update(cards).set({ fallback }).where(eq(cards.id, card.id));
  } else if (card.type === "cloze") {
    const c = card.content as ClozeContent;
    const content = {
      ...c,
      ...(change.front !== undefined ? { text: change.front } : {}),
      ...(change.back !== undefined ? { extra: change.back } : {}),
    };
    await db.update(cards).set({ content }).where(eq(cards.id, card.id));
  } else {
    const c = card.content as BasicContent;
    await db
      .update(cards)
      .set({ content: { ...c, ...change } })
      .where(eq(cards.id, card.id));
  }
}

export async function deleteCards(db: Db, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const now = Date.now();
  await db.update(cards).set({ deletedAt: now, updatedAt: now }).where(inArray(cards.id, ids));
}

export async function deleteCard(db: Db, id: string): Promise<void> {
  const now = Date.now();
  await db.update(cards).set({ deletedAt: now, updatedAt: now }).where(eq(cards.id, id));
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

/** Cards que você mais erra (pelo menos `minLapses` esquecimentos), do mais errado ao menos. */
export function leechCards(
  db: Db,
  options: { minLapses?: number; limit?: number } = {},
): Promise<Card[]> {
  return db
    .select({ card: cards })
    .from(cards)
    .innerJoin(decks, eq(decks.id, cards.deckId))
    .where(and(active(cards), active(decks), gte(cards.lapses, options.minLapses ?? 3)))
    .orderBy(desc(cards.lapses), desc(cards.lastReview))
    .limit(options.limit ?? 5)
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
