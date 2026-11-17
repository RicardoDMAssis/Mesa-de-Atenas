import { DefaultScheduler } from "ts-fsrs";

/** 1 = Errei, 2 = Difícil, 3 = Bom, 4 = Fácil. */
export type Rating = 1 | 2 | 3 | 4;
export const RATINGS: readonly Rating[] = [1, 2, 3, 4];

/**
 * Agendamento de um card. `srs` é o estado interno do algoritmo, em formato
 * próprio para guardar no banco; os demais campos são cópias para consulta e exibição.
 * Datas em milissegundos.
 */
export interface Scheduling {
  srs: Record<string, unknown>;
  due: number;
  /** 0 novo, 1 aprendendo, 2 revisão, 3 reaprendendo. */
  state: number;
  reps: number;
  lapses: number;
  lastReview: number | null;
}

export interface ReviewOutcome {
  next: Scheduling;
  /** Estado do card antes da resposta. */
  previousState: number;
  /** Registro completo da resposta, para guardar no histórico. */
  log: Record<string, unknown>;
}

/**
 * Intervalos definidos pelo usuário (por baralho), em minutos, para cada resposta.
 * A cada acerto seguido, o intervalo de Difícil/Bom/Fácil é multiplicado por `growth`
 * (1 = sempre o mesmo intervalo). Errar volta a contagem de acertos a zero.
 */
export interface CustomIntervals {
  again: number;
  hard: number;
  good: number;
  easy: number;
  growth: number;
}

export const DEFAULT_CUSTOM_INTERVALS: CustomIntervals = {
  again: 10,
  hard: 24 * 60,
  good: 3 * 24 * 60,
  easy: 7 * 24 * 60,
  growth: 2,
};

/** Maior intervalo permitido no modo personalizado: 5 anos. */
const MAX_CUSTOM_MINUTES = 5 * 365 * 24 * 60;

/** Acertos seguidos guardados junto do estado (fora do que a biblioteca do FSRS vê). */
const STREAK_KEY = "__acertosSeguidos";

/** Quando o card volta no modo personalizado, e a nova contagem de acertos seguidos. */
export function customDue(
  rating: Rating,
  now: number,
  intervals: CustomIntervals,
  previousStreak: number,
): { due: number; streak: number } {
  if (rating === 1) return { due: now + intervals.again * 60_000, streak: 0 };
  const streak = previousStreak + 1;
  const base = rating === 2 ? intervals.hard : rating === 3 ? intervals.good : intervals.easy;
  const minutes = Math.min(base * intervals.growth ** (streak - 1), MAX_CUSTOM_MINUTES);
  return { due: now + Math.round(minutes * 60_000), streak };
}

export interface Scheduler {
  /** Agendamento de um card recém-criado: disponível para estudo desde já. */
  newCard(now: Date): Scheduling;
  /** Quando o card venceria para cada resposta possível, sem alterar nada. */
  /** `custom` presente = intervalos definidos pelo usuário em vez do automático (FSRS). */
  preview(current: Scheduling, now: Date, custom?: CustomIntervals | null): Record<Rating, number>;
  review(
    current: Scheduling,
    rating: Rating,
    now: Date,
    custom?: CustomIntervals | null,
  ): ReviewOutcome;
}

const DATE_FIELDS = ["dueAt", "lastReviewAt", "reviewTime"] as const;

/** Troca datas por milissegundos, para o estado poder ser guardado como JSON. */
function pack(value: object): Record<string, unknown> {
  const out: Record<string, unknown> = { ...value };
  for (const key of DATE_FIELDS) {
    if (out[key] instanceof Date) out[key] = (out[key] as Date).getTime();
  }
  return out;
}

function unpack(value: Record<string, unknown>): Record<string, unknown> {
  const out = { ...value };
  for (const key of DATE_FIELDS) {
    if (typeof out[key] === "number") out[key] = new Date(out[key] as number);
  }
  return out;
}

/**
 * Cria o agendador (FSRS, parâmetros padrão). Este arquivo é o único ponto do
 * projeto que conhece a biblioteca: trocar de versão ou de algoritmo fica restrito a ele.
 */
export async function createScheduler(): Promise<Scheduler> {
  const fsrs = await DefaultScheduler();
  type FsrsCard = ReturnType<typeof fsrs.newCard>;

  const toScheduling = (card: FsrsCard): Scheduling => ({
    srs: pack(card),
    due: card.dueAt.getTime(),
    state: card.state,
    reps: card.reps,
    lapses: card.lapses,
    lastReview: card.lastReviewAt ? card.lastReviewAt.getTime() : null,
  });
  const toCard = (current: Scheduling) => {
    const { [STREAK_KEY]: _streak, ...rest } = unpack(current.srs);
    return rest as unknown as FsrsCard;
  };
  const streakOf = (current: Scheduling) => Number(current.srs[STREAK_KEY] ?? 0) || 0;

  return {
    newCard: (now) => toScheduling(fsrs.newCard({ now })),
    preview(current, now, custom) {
      const out = {} as Record<Rating, number>;
      if (custom) {
        for (const r of RATINGS)
          out[r] = customDue(r, now.getTime(), custom, streakOf(current)).due;
        return out;
      }
      for (const item of fsrs.preview({ card: toCard(current), now })) {
        out[item.grade as Rating] = item.card.dueAt.getTime();
      }
      return out;
    },
    review(current, rating, now, custom) {
      // O FSRS sempre acompanha a memória do card, mesmo no modo personalizado:
      // assim, voltar ao automático continua de onde o card está.
      const result = fsrs.review({ card: toCard(current), grade: rating, now });
      const next = toScheduling(result.card);
      const { due, streak } = custom
        ? customDue(rating, now.getTime(), custom, streakOf(current))
        : { due: next.due, streak: rating === 1 ? 0 : streakOf(current) + 1 };
      return {
        next: { ...next, due, srs: { ...next.srs, [STREAK_KEY]: streak } },
        previousState: current.state,
        log: { ...pack(result.revlog), modo: custom ? "personalizado" : "automatico" },
      };
    },
  };
}

/** Intervalo curto para os botões de resposta: "10 min", "3 h", "5 d", "2 meses", "1 ano". */
export function formatInterval(ms: number): string {
  const minutes = ms / 60_000;
  if (minutes < 1) return "<1 min";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.round(hours)} h`;
  const days = hours / 24;
  if (days < 30) return `${Math.round(days)} d`;
  if (days < 365) {
    const months = Math.round(days / 30);
    return months === 1 ? "1 mês" : `${months} meses`;
  }
  const years = Math.round((days / 365) * 10) / 10;
  return years === 1 ? "1 ano" : `${String(years).replace(".", ",")} anos`;
}
