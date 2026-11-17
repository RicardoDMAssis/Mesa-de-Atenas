import { recordFocusSession } from "@estudarella/db";
import { useCallback, useEffect, useState } from "react";
import { useDatabase } from "../../data/DatabaseProvider";
import {
  cancelScheduled,
  MESSAGES,
  notifyNow,
  requestNotifyPermission,
  scheduleEnd,
} from "./notify";
import { useFocusStore } from "./store";
import {
  complete,
  isDue,
  pause as pauseTimer,
  remainingMs,
  reset as resetTimer,
  start as startTimer,
} from "./timer";

/**
 * Mantém o timer andando enquanto o app estiver aberto: confere o horário a cada
 * segundo e, ao chegar a hora, encerra a fase, grava o bloco de foco e avisa.
 * Montado uma única vez, no layout do app.
 */
export function FocusTicker() {
  const { db } = useDatabase();
  useEffect(() => {
    const tick = () => {
      const { timer, settings, setTimer, notify } = useFocusStore.getState();
      const now = Date.now();
      if (!isDue(timer, now)) return;
      const { next, focus } = complete(timer, settings, now);
      setTimer(next);
      if (focus) void recordFocusSession(db, focus);
      // Só avisa se a fase acabou há pouco (não ao reabrir o app horas depois).
      if (notify && timer.endsAt && now - timer.endsAt < 60_000) notifyNow(MESSAGES[timer.phase]);
    };
    tick();
    const interval = setInterval(tick, 1000);
    const onVisible = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [db]);
  return null;
}

/** Estado e ações do timer para as telas. Atualiza a cada segundo enquanto roda. */
export function useFocusTimer() {
  const { db } = useDatabase();
  const timer = useFocusStore((s) => s.timer);
  const settings = useFocusStore((s) => s.settings);
  const notify = useFocusStore((s) => s.notify);
  const setTimer = useFocusStore((s) => s.setTimer);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (timer.status !== "running") return;
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [timer.status]);

  const start = useCallback(async () => {
    const current = useFocusStore.getState().timer;
    const next = startTimer(current, settings, Date.now());
    setTimer(next);
    setNow(Date.now());
    if (notify) {
      await requestNotifyPermission();
      if (next.endsAt) await scheduleEnd(next.endsAt, MESSAGES[next.phase]);
    }
  }, [settings, notify, setTimer]);

  const pause = useCallback(() => {
    setTimer(pauseTimer(useFocusStore.getState().timer, Date.now()));
    void cancelScheduled();
  }, [setTimer]);

  const reset = useCallback(() => {
    setTimer(resetTimer(useFocusStore.getState().timer));
    void cancelScheduled();
  }, [setTimer]);

  /** Encerra a fase agora. Um foco encerrado antes da hora não é registrado. */
  const skip = useCallback(async () => {
    const current = useFocusStore.getState().timer;
    const { next, focus } = complete(current, settings, Date.now(), true);
    setTimer(next);
    void cancelScheduled();
    if (focus) await recordFocusSession(db, focus);
  }, [db, settings, setTimer]);

  const setSubject = useCallback(
    (subjectId: string | null) => setTimer({ ...useFocusStore.getState().timer, subjectId }),
    [setTimer],
  );

  return {
    timer,
    settings,
    remaining: remainingMs(timer, settings, now),
    start,
    pause,
    reset,
    skip,
    setSubject,
  };
}
