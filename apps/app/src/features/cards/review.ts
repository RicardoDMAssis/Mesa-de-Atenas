import type { Rating } from "@estudarella/core";
import { type Card, type DeckSettings, recordReview } from "@estudarella/db";
import type { Database } from "../../data/db";

/** Intervalos personalizados do baralho do card, se houver. */
export function customIntervals(settings: Map<string, DeckSettings>, card: Card) {
  const s = settings.get(card.deckId);
  return s?.mode === "custom" ? (s.intervals ?? null) : null;
}

/**
 * Agenda a próxima revisão do card pela resposta dada e grava no banco.
 * Devolve o card já atualizado (com o novo vencimento).
 */
export async function answerCard(
  { db, scheduler }: Pick<Database, "db" | "scheduler">,
  card: Card,
  rating: Rating,
  options: {
    shownAt: number;
    custom: ReturnType<typeof customIntervals>;
    now?: Date;
  },
): Promise<Card> {
  const now = options.now ?? new Date();
  const outcome = scheduler.review(card, rating, now, options.custom);
  await recordReview(db, card.id, outcome.next, {
    rating,
    state: outcome.previousState,
    reviewedAt: now.getTime(),
    durationMs: Math.min(now.getTime() - options.shownAt, 10 * 60_000),
    data: outcome.log,
  });
  return { ...card, ...outcome.next };
}
