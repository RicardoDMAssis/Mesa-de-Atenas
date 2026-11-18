import { describe, expect, it } from "vitest";
import {
  focusPhaseMessage,
  pickMessage,
  type StudyContext,
  sessionMessage,
  weekMessage,
} from "./messages";

const persona = { name: "Sapinho", catchphrase: "Croac!" };
const options = { reminders: true, tips: true, celebrate: true, random: () => 0 };
const base: StudyContext = {
  due: 0,
  fresh: 0,
  reviewedToday: 0,
  streak: 0,
  studiedToday: false,
  focusMinutesToday: 0,
  focusRunning: false,
  deckCount: 1,
  hour: 10,
  weekday: 3,
  goal: null,
  leech: null,
  orphan: null,
  backupDays: 1,
  items: 0,
  week: { reviews: 0, focusMinutes: 0, daysStudied: 0 },
};

describe("pickMessage", () => {
  it("não atrapalha durante o foco", () => {
    expect(pickMessage({ ...base, due: 5, focusRunning: true }, persona, options).kind).toBe(
      "focus",
    );
  });

  it("lembra dos cards vencidos, com a contagem e o quiz", () => {
    const m = pickMessage({ ...base, due: 3 }, persona, options);
    expect(m.kind).toBe("due");
    expect(m.text).toContain("3 cards");
    expect(m.actions).toEqual(["study", "quiz"]);
  });

  it("diz quanto falta para a meta", () => {
    const m = pickMessage({ ...base, due: 20, goal: 20, reviewedToday: 5 }, persona, options);
    expect(m.text).toContain("Faltam 15 para a sua meta de 20");
  });

  it("avisa quando não há cards suficientes para a meta", () => {
    const one = pickMessage({ ...base, fresh: 1, goal: 20 }, persona, options);
    expect(one.text).toContain("Hoje só há 1 card disponível, então a meta de 20 não fecha");
    const few = pickMessage({ ...base, due: 3, goal: 20, reviewedToday: 5 }, persona, options);
    expect(few.text).toContain("Hoje só há 3 cards disponíveis");
    const none = pickMessage(
      { ...base, goal: 20, reviewedToday: 5, studiedToday: true },
      persona,
      options,
    );
    expect(none.text).toContain("Não há mais cards hoje para a meta de 20");
  });

  it("comemora a meta batida", () => {
    const m = pickMessage(
      { ...base, goal: 10, reviewedToday: 12, studiedToday: true },
      persona,
      options,
    );
    expect(m.kind).toBe("goal-done");
    expect(m.text).toContain("12 de 10");
  });

  it("avisa à noite que a sequência está em risco", () => {
    const m = pickMessage({ ...base, due: 2, streak: 4, hour: 20 }, persona, options);
    expect(m.kind).toBe("streak-risk");
    expect(m.text).toContain("4 dias");
  });

  it("comemora quando tudo foi revisado", () => {
    const m = pickMessage({ ...base, reviewedToday: 12, studiedToday: true }, persona, options);
    expect(m.kind).toBe("done");
    expect(m.mood).toBe("happy");
  });

  it("às segundas, mostra o resumo da semana", () => {
    const week = { reviews: 80, focusMinutes: 50, daysStudied: 5 };
    const m = pickMessage({ ...base, weekday: 1, week }, persona, options);
    expect(m.kind).toBe("week");
    expect(m.text).toContain("80 respostas, 50 min de foco e 5 dias");
  });

  it("sem lembretes, dá dica em vez de avisar dos cards", () => {
    expect(pickMessage({ ...base, due: 3 }, persona, { ...options, reminders: false }).kind).toBe(
      "tip",
    );
  });

  it("dá boas-vindas a quem ainda não tem baralho", () => {
    const m = pickMessage({ ...base, deckCount: 0 }, persona, options);
    expect(m.kind).toBe("welcome");
    expect(m.text).toContain("Sapinho");
  });

  it("sem nada urgente, sugere backup, card difícil e nota solta", () => {
    const ctx: StudyContext = {
      ...base,
      items: 10,
      backupDays: null,
      leech: { front: "Mitocôndria", lapses: 6, deckId: "d1" },
      orphan: { id: "n1", title: "Fotossíntese" },
    };
    // `random` escolhe entre as sugestões disponíveis (backup, card difícil, nota solta, dica).
    const at = (r: number) => pickMessage(ctx, persona, { ...options, random: () => r });
    expect(at(0).kind).toBe("backup");
    expect(at(0.3)).toMatchObject({ kind: "leech", actions: ["open-deck"], target: "d1" });
    expect(at(0.3).text).toContain("6 vezes");
    expect(at(0.6)).toMatchObject({ kind: "orphan", actions: ["open-note"], target: "n1" });
    expect(at(0.9).kind).toBe("tip");
  });

  it("não lembra de backup recente nem sem conteúdo", () => {
    const leech = { front: "x", lapses: 3, deckId: "d" };
    const recent = pickMessage({ ...base, items: 10, backupDays: 3, leech }, persona, {
      ...options,
      tips: false,
    });
    expect(recent.kind).toBe("start");
    const empty = pickMessage({ ...base, backupDays: null }, persona, options);
    expect(empty.kind).toBe("tip");
  });

  it("sem dicas e sem nada pendente, só cumprimenta", () => {
    expect(pickMessage(base, persona, { ...options, tips: false }).kind).toBe("start");
  });
});

describe("outras mensagens", () => {
  it("ajusta o tom da sessão ao desempenho", () => {
    expect(sessionMessage({ again: 0, total: 10 }, persona, () => 0).text).toContain("100%");
    expect(sessionMessage({ again: 8, total: 10 }, persona).text).toContain("errar faz parte");
  });

  it("reage ao fim do foco e da pausa", () => {
    expect(focusPhaseMessage("focus", persona, () => 0)).toMatchObject({
      kind: "focus-done",
      mood: "happy",
    });
    expect(focusPhaseMessage("focus", persona, () => 0).text).toContain("beba um copo d’água");
    expect(focusPhaseMessage("short", persona).actions).toEqual(["focus"]);
  });

  it("resumo de uma semana sem estudo incentiva a começar", () => {
    expect(weekMessage(base).text).toContain("ainda não houve estudo");
  });
});
