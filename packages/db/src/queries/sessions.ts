import { and, eq, gte, isNotNull, sql } from "drizzle-orm";
import type { Db } from "../client";
import { cards, reviewLogs, studySessions } from "../schema";
import { active } from "./base";

/** Registra um bloco de foco já concluído. */
export async function recordFocusSession(
  db: Db,
  input: { startedAt: number; endedAt: number; subjectId?: string | null },
): Promise<void> {
  await db.insert(studySessions).values({ kind: "focus", ...input });
}

/** Abre uma sessão de revisão e devolve o id, para fechá-la ao terminar. */
export async function startReviewSession(
  db: Db,
  input: { startedAt: number; deckId?: string | null },
): Promise<string> {
  const [row] = await db
    .insert(studySessions)
    .values({ kind: "review", startedAt: input.startedAt, deckId: input.deckId ?? null })
    .returning({ id: studySessions.id });
  if (!row) throw new Error("Não foi possível registrar a sessão.");
  return row.id;
}

export async function endSession(db: Db, id: string, endedAt: number): Promise<void> {
  await db.update(studySessions).set({ endedAt }).where(eq(studySessions.id, id));
}

export interface ActivityData {
  /** Respostas a cards: quando e se acertou (qualquer resposta diferente de "Errei"). */
  reviews: { at: number; correct: boolean }[];
  /** Blocos de foco concluídos: quando terminaram e quantos minutos duraram. */
  focus: { at: number; minutes: number }[];
}

/** Atividade desde `since` (ms). Para a sequência de dias, use `since = 0`. */
export async function activitySince(db: Db, since: number): Promise<ActivityData> {
  const [reviews, focus] = await Promise.all([
    db
      .select({ at: reviewLogs.reviewedAt, rating: reviewLogs.rating })
      .from(reviewLogs)
      .where(and(gte(reviewLogs.reviewedAt, since), active(reviewLogs))),
    db
      .select({ start: studySessions.startedAt, end: studySessions.endedAt })
      .from(studySessions)
      .where(
        and(
          eq(studySessions.kind, "focus"),
          isNotNull(studySessions.endedAt),
          gte(studySessions.startedAt, since),
          active(studySessions),
        ),
      ),
  ]);
  return {
    reviews: reviews.map((r) => ({ at: r.at, correct: r.rating > 1 })),
    focus: focus.map((f) => ({
      at: f.end ?? f.start,
      minutes: Math.round(((f.end ?? f.start) - f.start) / 60_000),
    })),
  };
}

/** Vencimento (ms) dos cards já estudados que vencem até `until`. */
export async function upcomingDue(db: Db, until: number): Promise<number[]> {
  const rows = await db
    .select({ due: cards.due })
    .from(cards)
    .where(and(active(cards), sql`${cards.state} <> 0`, sql`${cards.due} <= ${until}`));
  return rows.map((r) => r.due);
}
