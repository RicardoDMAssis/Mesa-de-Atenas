/** Instante em que o dia de estudo de `at` começou (a última virada). */
export function studyDayStart(at: Date, rolloverHour = 4): Date {
  const start = new Date(at);
  start.setHours(rolloverHour, 0, 0, 0);
  if (start.getTime() > at.getTime()) start.setDate(start.getDate() - 1);
  return start;
}

/** Instante em que o dia de estudo de `at` termina (a próxima virada). */
export function studyDayEnd(at: Date, rolloverHour = 4): Date {
  const end = studyDayStart(at, rolloverHour);
  end.setDate(end.getDate() + 1);
  return end;
}

/**
 * Dia de estudo (AAAA-MM-DD, horário local) ao qual um instante pertence.
 *
 * O dia só "vira" em `rolloverHour`: com o padrão 4, uma revisão feita às 02:00
 * ainda conta para o dia anterior. É a base do streak e do agendamento do SRS.
 */
export function studyDay(at: Date, rolloverHour = 4): string {
  const start = studyDayStart(at, rolloverHour);
  const y = start.getFullYear();
  const m = String(start.getMonth() + 1).padStart(2, "0");
  const d = String(start.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
