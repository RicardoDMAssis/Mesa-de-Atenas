import { countReviewsSince, graphData, leechCards, listDecks } from "@estudarella/db";
import { useEffect, useMemo, useState } from "react";
import { useDailyGoal, useStudyDay } from "../../data/hooks";
import { useLiveQuery } from "../../data/useLiveQuery";
import { useMascotStore } from "../../stores/mascot";
import { lastBackupAt } from "../backup/backup";
import { cardSummary } from "../cards/CardView";
import { useFocusStore } from "../focus/store";
import { useProgress } from "../progress/useProgress";
import { type Mascot, useAllMascots } from "./mascots";
import type { Persona, StudyContext } from "./messages";

const DAY = 86_400_000;

export interface ActiveMascot {
  mascot: Mascot;
  color: string;
  persona: Persona;
}

/** O mascote escolhido, com cor e nome finais; `undefined` se estiver desligado. */
export function useMascot(): ActiveMascot | undefined {
  const mascotId = useMascotStore((s) => s.mascotId);
  const color = useMascotStore((s) => s.color);
  const nickname = useMascotStore((s) => s.nickname);
  const all = useAllMascots();
  return useMemo(() => {
    const mascot = all.find((m) => m.id === mascotId);
    if (!mascot) return undefined;
    return {
      mascot,
      color: color ?? mascot.color,
      persona: { name: nickname.trim() || mascot.name, catchphrase: mascot.catchphrase },
    };
  }, [all, mascotId, color, nickname]);
}

/** Melhor sequência de dias já alcançada (libera os mascotes de recompensa). */
export function useBestStreak(): number {
  return useProgress()?.streak.longest ?? 0;
}

/** O que o mascote precisa saber do estudo, sempre em dia com o banco. */
export function useStudyContext(): StudyContext | undefined {
  const { start, end } = useStudyDay();
  const goal = useDailyGoal();
  const decks = useLiveQuery(["decks", "cards"], (db) => listDecks(db, end), [end]);
  const reviewed = useLiveQuery(["review_logs"], (db) => countReviewsSince(db, start), [start]);
  const leeches = useLiveQuery(["decks", "cards"], (db) => leechCards(db, { limit: 1 }));
  const graph = useLiveQuery(["notes", "links", "subjects"], graphData);
  const progress = useProgress();
  const focusRunning = useFocusStore(
    (s) => s.timer.status === "running" && s.timer.phase === "focus",
  );
  // Hora e dia da semana mudam as mensagens (ex.: aviso da sequência à noite).
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  return useMemo(() => {
    if (!decks.data || reviewed.data === undefined || !progress) return undefined;
    const linked = new Set(graph.data?.links.flatMap((l) => [l.source, l.target]));
    const orphan = graph.data?.notes.find((n) => n.title.trim() && !linked.has(n.id));
    const leech = leeches.data?.[0];
    const last7 = (series: { value: number }[]) => series.slice(-7).map((p) => p.value);
    const reviews7 = last7(progress.reviews30);
    const focus7 = last7(progress.focus30);
    const backup = lastBackupAt();
    return {
      due: decks.data.reduce((n, d) => n + d.due, 0),
      fresh: decks.data.reduce((n, d) => n + d.fresh, 0),
      reviewedToday: reviewed.data,
      streak: progress.streak.current,
      studiedToday: progress.streak.studiedToday,
      focusMinutesToday: progress.today.focusMinutes,
      focusRunning,
      deckCount: decks.data.length,
      hour: now.getHours(),
      weekday: now.getDay(),
      goal,
      leech: leech
        ? {
            front: cardSummary(leech).front || "sem título",
            lapses: leech.lapses,
            deckId: leech.deckId,
          }
        : null,
      orphan: orphan ? { id: orphan.id, title: orphan.title } : null,
      backupDays: backup === null ? null : Math.floor((now.getTime() - backup) / DAY),
      items: (graph.data?.notes.length ?? 0) + decks.data.reduce((n, d) => n + d.total, 0),
      week: {
        reviews: reviews7.reduce((a, b) => a + b, 0),
        focusMinutes: focus7.reduce((a, b) => a + b, 0),
        daysStudied: reviews7.filter((r, i) => r > 0 || (focus7[i] ?? 0) > 0).length,
      },
    };
  }, [decks.data, reviewed.data, progress, focusRunning, goal, leeches.data, graph.data, now]);
}
