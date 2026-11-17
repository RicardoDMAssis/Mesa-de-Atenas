/*
 * Regras do timer de foco (Pomodoro), sem interface. O tempo é sempre derivado do
 * horário de término (`endsAt`), nunca de contagem: assim o timer continua certo
 * com a aba em segundo plano, o celular bloqueado ou o app fechado.
 */

export type Phase = "focus" | "short" | "long";
export type Status = "idle" | "running" | "paused";

export interface TimerSettings {
  focusMinutes: number;
  shortMinutes: number;
  longMinutes: number;
  /** Pausa longa a cada N blocos de foco. */
  longEvery: number;
}

export const DEFAULT_SETTINGS: TimerSettings = {
  focusMinutes: 25,
  shortMinutes: 5,
  longMinutes: 15,
  longEvery: 4,
};

export interface TimerState {
  phase: Phase;
  status: Status;
  /** Quando a fase em andamento termina (status `running`). */
  endsAt: number | null;
  /** Tempo que faltava ao pausar (status `paused`). */
  remaining: number | null;
  /** Quando o bloco de foco atual começou (para registrar a sessão). */
  focusStartedAt: number | null;
  /** Blocos de foco concluídos na rodada atual. */
  completed: number;
  subjectId: string | null;
}

export const INITIAL_STATE: TimerState = {
  phase: "focus",
  status: "idle",
  endsAt: null,
  remaining: null,
  focusStartedAt: null,
  completed: 0,
  subjectId: null,
};

export const phaseLength = (phase: Phase, s: TimerSettings) =>
  (phase === "focus" ? s.focusMinutes : phase === "short" ? s.shortMinutes : s.longMinutes) *
  60_000;

/** Milissegundos restantes da fase atual. */
export function remainingMs(state: TimerState, s: TimerSettings, now: number): number {
  if (state.status === "running" && state.endsAt) return Math.max(0, state.endsAt - now);
  if (state.status === "paused" && state.remaining !== null) return state.remaining;
  return phaseLength(state.phase, s);
}

export function start(state: TimerState, s: TimerSettings, now: number): TimerState {
  if (state.status === "running") return state;
  const remaining =
    state.status === "paused" ? (state.remaining ?? 0) : phaseLength(state.phase, s);
  return {
    ...state,
    status: "running",
    endsAt: now + remaining,
    remaining: null,
    // Pausar e retomar mantém o início original do bloco.
    focusStartedAt: state.phase === "focus" ? (state.focusStartedAt ?? now) : null,
  };
}

export function pause(state: TimerState, now: number): TimerState {
  if (state.status !== "running" || !state.endsAt) return state;
  return { ...state, status: "paused", remaining: Math.max(0, state.endsAt - now), endsAt: null };
}

/** Volta ao começo da fase atual, sem registrar nada. */
export function reset(state: TimerState): TimerState {
  return { ...state, status: "idle", endsAt: null, remaining: null, focusStartedAt: null };
}

export interface Completion {
  next: TimerState;
  /** Bloco de foco concluído, para registrar (ausente ao terminar uma pausa ou ao pular). */
  focus?: { startedAt: number; endedAt: number; subjectId: string | null };
}

/**
 * Encerra a fase atual e prepara a seguinte (que começa parada, à espera do usuário).
 * `skipped` = o usuário pulou: um foco pulado não conta nem é registrado.
 */
export function complete(
  state: TimerState,
  s: TimerSettings,
  now: number,
  skipped = false,
): Completion {
  const base = {
    ...state,
    status: "idle" as const,
    endsAt: null,
    remaining: null,
    focusStartedAt: null,
  };
  if (state.phase !== "focus") return { next: { ...base, phase: "focus" } };
  if (skipped) return { next: { ...base, phase: "short" } };
  const completed = state.completed + 1;
  const long = completed % s.longEvery === 0;
  return {
    next: { ...base, phase: long ? "long" : "short", completed: long ? 0 : completed },
    focus: {
      startedAt: state.focusStartedAt ?? now - phaseLength("focus", s),
      endedAt: state.endsAt ?? now,
      subjectId: state.subjectId,
    },
  };
}

/** Se a fase em andamento já deveria ter terminado (ex.: o app ficou fechado). */
export const isDue = (state: TimerState, now: number) =>
  state.status === "running" && state.endsAt !== null && now >= state.endsAt;

/** "24:59" */
export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
