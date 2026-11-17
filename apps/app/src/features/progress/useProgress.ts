import {
  activityDays,
  computeStreak,
  type DayPoint,
  dailySeries,
  type Streak,
  studyDay,
} from "@estudarella/core";
import { activitySince, upcomingDue } from "@estudarella/db";
import { useMemo } from "react";
import { useRolloverHour, useStudyDay } from "../../data/hooks";
import { useLiveQuery } from "../../data/useLiveQuery";

export interface Progress {
  streak: Streak;
  today: { reviews: number; focusMinutes: number };
  /** Últimos 30 dias (hoje por último). */
  reviews30: DayPoint[];
  focus30: DayPoint[];
  /** Acertos / respostas nos últimos 30 dias; `null` sem respostas. */
  accuracy30: number | null;
  /** Cards a vencer em cada um dos próximos 7 dias (o primeiro é hoje, incluindo atrasados). */
  forecast7: DayPoint[];
}

const DAY = 86_400_000;

/**
 * Números de progresso, sempre em dia com o banco. Um dia conta como estudado se
 * teve ao menos uma resposta a card ou um bloco de foco concluído.
 */
export function useProgress(): Progress | undefined {
  const hour = useRolloverHour();
  const { end } = useStudyDay();
  const activity = useLiveQuery(["review_logs", "study_sessions"], (db) => activitySince(db, 0));
  const due = useLiveQuery(["cards"], (db) => upcomingDue(db, end + 6 * DAY), [end]);

  return useMemo(() => {
    if (!activity.data || !due.data) return undefined;
    const now = new Date();
    const { reviews, focus } = activity.data;
    const days = activityDays([...reviews.map((r) => r.at), ...focus.map((f) => f.at)], hour);
    const series = (events: { at: number; value: number }[]) =>
      dailySeries(events, { now, count: 30, rolloverHour: hour });
    const reviews30 = series(reviews.map((r) => ({ at: r.at, value: 1 })));
    const focus30 = series(focus.map((f) => ({ at: f.at, value: f.minutes })));
    const since = now.getTime() - 30 * DAY;
    const recent = reviews.filter((r) => r.at >= since);
    const today = studyDay(now, hour);

    const forecast7 = dailySeries(
      due.data.map((at) => ({ at: Math.max(at, now.getTime()), value: 1 })),
      { now: new Date(now.getTime() + 6 * DAY), count: 7, rolloverHour: hour },
    );

    return {
      streak: computeStreak(days, today),
      today: {
        reviews: reviews30.at(-1)?.value ?? 0,
        focusMinutes: focus30.at(-1)?.value ?? 0,
      },
      reviews30,
      focus30,
      accuracy30: recent.length ? recent.filter((r) => r.correct).length / recent.length : null,
      forecast7,
    };
  }, [activity.data, due.data, hour]);
}
