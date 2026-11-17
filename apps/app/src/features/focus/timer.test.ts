import { describe, expect, it } from "vitest";
import {
  complete,
  formatClock,
  INITIAL_STATE,
  isDue,
  pause,
  remainingMs,
  reset,
  DEFAULT_SETTINGS as S,
  start,
} from "./timer";

const MIN = 60_000;

describe("timer de foco", () => {
  it("começa com 25 min e termina pelo horário, mesmo sem ser consultado no meio", () => {
    const running = start(INITIAL_STATE, S, 0);
    expect(running.endsAt).toBe(25 * MIN);
    expect(remainingMs(running, S, 10 * MIN)).toBe(15 * MIN);
    expect(isDue(running, 25 * MIN - 1)).toBe(false);
    expect(isDue(running, 3 * 60 * MIN)).toBe(true); // app ficou fechado por horas
  });

  it("pausar e retomar preserva o tempo restante e o início do bloco", () => {
    let t = start(INITIAL_STATE, S, 0);
    t = pause(t, 10 * MIN);
    expect(remainingMs(t, S, 99 * MIN)).toBe(15 * MIN);
    t = start(t, S, 50 * MIN);
    expect(t.endsAt).toBe(65 * MIN);
    expect(t.focusStartedAt).toBe(0);
  });

  it("foco concluído vira pausa curta e gera o registro da sessão", () => {
    const t = { ...start(INITIAL_STATE, S, 0), subjectId: "letras" };
    const { next, focus } = complete(t, S, 25 * MIN);
    expect(next).toMatchObject({ phase: "short", status: "idle", completed: 1 });
    expect(focus).toEqual({ startedAt: 0, endedAt: 25 * MIN, subjectId: "letras" });
    expect(next.subjectId).toBe("letras");
  });

  it("a cada 4 focos, pausa longa; depois da pausa volta ao foco", () => {
    let t = INITIAL_STATE;
    for (let i = 0; i < 3; i++) {
      t = complete(start(t, S, 0), S, 25 * MIN).next;
      expect(t.phase).toBe("short");
      t = complete(t, S, 0).next;
      expect(t.phase).toBe("focus");
    }
    t = complete(start(t, S, 0), S, 25 * MIN).next;
    expect(t).toMatchObject({ phase: "long", completed: 0 });
    expect(remainingMs(t, S, 0)).toBe(15 * MIN);
  });

  it("pular o foco não registra nem conta", () => {
    const { next, focus } = complete(start(INITIAL_STATE, S, 0), S, 3 * MIN, true);
    expect(focus).toBeUndefined();
    expect(next).toMatchObject({ phase: "short", completed: 0 });
  });

  it("reiniciar volta ao começo da fase", () => {
    const t = reset(pause(start(INITIAL_STATE, S, 0), 5 * MIN));
    expect(t.status).toBe("idle");
    expect(remainingMs(t, S, 0)).toBe(25 * MIN);
  });

  it("formata o relógio", () => {
    expect(formatClock(25 * MIN)).toBe("25:00");
    expect(formatClock(59_001)).toBe("01:00");
    expect(formatClock(0)).toBe("00:00");
  });
});
