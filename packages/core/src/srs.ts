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

export interface Scheduler {
  /** Agendamento de um card recém-criado: disponível para estudo desde já. */
  newCard(now: Date): Scheduling;
  /** Quando o card venceria para cada resposta possível, sem alterar nada. */
  preview(current: Scheduling, now: Date): Record<Rating, number>;
  review(current: Scheduling, rating: Rating, now: Date): ReviewOutcome;
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
  const toCard = (current: Scheduling) => unpack(current.srs) as unknown as FsrsCard;

  return {
    newCard: (now) => toScheduling(fsrs.newCard({ now })),
    preview(current, now) {
      const out = {} as Record<Rating, number>;
      for (const item of fsrs.preview({ card: toCard(current), now })) {
        out[item.grade as Rating] = item.card.dueAt.getTime();
      }
      return out;
    },
    review(current, rating, now) {
      const result = fsrs.review({ card: toCard(current), grade: rating, now });
      return {
        next: toScheduling(result.card),
        previousState: current.state,
        log: pack(result.revlog),
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
