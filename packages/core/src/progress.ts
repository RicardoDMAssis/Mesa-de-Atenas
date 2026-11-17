import { studyDay, studyDayStart } from "./study-day";

/** Soma `n` dias a uma data AAAA-MM-DD (calendário, sem fuso). */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d + n));
  return date.toISOString().slice(0, 10);
}

/** Dias de estudo (AAAA-MM-DD) em que houve alguma atividade. */
export function activityDays(timestamps: Iterable<number>, rolloverHour = 4): Set<string> {
  const days = new Set<string>();
  for (const t of timestamps) days.add(studyDay(new Date(t), rolloverHour));
  return days;
}

export interface Streak {
  /** Dias seguidos com estudo até hoje (ou até ontem, se hoje ainda não teve). */
  current: number;
  longest: number;
  /** Se o dia de hoje já conta. */
  studiedToday: boolean;
}

/**
 * Sequência de dias estudados. Se hoje ainda não houve estudo, a sequência que
 * terminou ontem continua valendo: ela só "quebra" quando o dia vira sem estudo.
 */
export function computeStreak(days: Set<string>, today: string): Streak {
  const studiedToday = days.has(today);
  let current = 0;
  for (let d = studiedToday ? today : addDays(today, -1); days.has(d); d = addDays(d, -1)) {
    current++;
  }
  let longest = 0;
  for (const day of days) {
    if (days.has(addDays(day, -1))) continue; // só começa a contar no início de cada sequência
    let length = 1;
    while (days.has(addDays(day, length))) length++;
    longest = Math.max(longest, length);
  }
  return { current, longest, studiedToday };
}

export interface DayPoint {
  day: string;
  value: number;
}

/**
 * Série diária dos últimos `count` dias de estudo (o último é hoje), somando
 * `value` de cada evento no dia em que ele aconteceu.
 */
export function dailySeries(
  events: Iterable<{ at: number; value: number }>,
  options: { now: Date; count: number; rolloverHour?: number },
): DayPoint[] {
  const hour = options.rolloverHour ?? 4;
  const today = studyDay(options.now, hour);
  const series = Array.from({ length: options.count }, (_, i) => ({
    day: addDays(today, i - options.count + 1),
    value: 0,
  }));
  const index = new Map(series.map((p, i) => [p.day, i]));
  for (const e of events) {
    const i = index.get(studyDay(new Date(e.at), hour));
    if (i !== undefined) (series[i] as DayPoint).value += e.value;
  }
  return series;
}

/** Início do dia de estudo que fica `days` dias antes de hoje (para limitar consultas). */
export function studyDaysAgo(now: Date, days: number, rolloverHour = 4): number {
  const start = studyDayStart(now, rolloverHour);
  start.setDate(start.getDate() - days);
  return start.getTime();
}
