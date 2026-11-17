/**
 * Dia de estudo (AAAA-MM-DD, horário local) ao qual um instante pertence.
 *
 * O dia só "vira" em `rolloverHour`: com o padrão 4, uma revisão feita às 02:00
 * ainda conta para o dia anterior. É a base do streak e do agendamento do SRS.
 */
export function studyDay(at: Date, rolloverHour = 4): string {
  const shifted = new Date(at.getTime() - rolloverHour * 3_600_000);
  const y = shifted.getFullYear();
  const m = String(shifted.getMonth() + 1).padStart(2, "0");
  const d = String(shifted.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
