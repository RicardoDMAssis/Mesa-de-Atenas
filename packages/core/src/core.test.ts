import { describe, expect, it } from "vitest";
import { clozeIndexes, nextClozeIndex, renderCloze } from "./cloze";
import { createScheduler, customDue, DEFAULT_CUSTOM_INTERVALS, formatInterval } from "./srs";
import { studyDayEnd, studyDayStart } from "./study-day";
import { buildTree, flattenTree } from "./tree";

describe("dia de estudo", () => {
  it("começa na última virada e termina na próxima", () => {
    const madrugada = new Date(2026, 10, 17, 2, 30);
    expect(studyDayStart(madrugada)).toEqual(new Date(2026, 10, 16, 4, 0));
    expect(studyDayEnd(madrugada)).toEqual(new Date(2026, 10, 17, 4, 0));
    const tarde = new Date(2026, 10, 17, 15, 0);
    expect(studyDayStart(tarde)).toEqual(new Date(2026, 10, 17, 4, 0));
    expect(studyDayEnd(tarde, 0)).toEqual(new Date(2026, 10, 18, 0, 0));
  });
});

describe("agendador", () => {
  const now = new Date("2026-01-01T12:00:00Z");

  it("card novo fica disponível na hora e o estado sobrevive a ir e voltar do banco", async () => {
    const scheduler = await createScheduler();
    const fresh = scheduler.newCard(now);
    expect(fresh).toMatchObject({ due: now.getTime(), state: 0, reps: 0, lastReview: null });

    // Simula gravar e ler do banco (JSON).
    const stored = JSON.parse(JSON.stringify(fresh));
    const { next, previousState, log } = scheduler.review(stored, 3, now);
    expect(previousState).toBe(0);
    expect(next.reps).toBe(1);
    expect(next.due).toBeGreaterThan(now.getTime());
    expect(next.lastReview).toBe(now.getTime());
    expect(log.rating).toBe(3);
    expect(() => JSON.stringify(next.srs)).not.toThrow();

    const again = scheduler.review(JSON.parse(JSON.stringify(next)), 3, new Date(next.due));
    expect(again.next.reps).toBe(2);
    expect(again.next.due).toBeGreaterThan(next.due);
  });

  it("respostas melhores agendam para mais longe, e a prévia bate com o resultado", async () => {
    const scheduler = await createScheduler();
    const fresh = scheduler.newCard(now);
    const preview = scheduler.preview(fresh, now);
    expect(preview[1]).toBeLessThan(preview[2]);
    expect(preview[2]).toBeLessThan(preview[3]);
    expect(preview[3]).toBeLessThan(preview[4]);
    for (const rating of [1, 2, 3, 4] as const) {
      expect(scheduler.review(fresh, rating, now).next.due).toBe(preview[rating]);
    }
  });

  it("errar um card já aprendido conta como lapso e o traz de volta logo", async () => {
    const scheduler = await createScheduler();
    let card = scheduler.review(scheduler.newCard(now), 4, now).next;
    expect(card.state).toBe(2);
    const later = new Date(card.due);
    card = scheduler.review(card, 1, later).next;
    expect(card.lapses).toBe(1);
    expect(card.due - later.getTime()).toBeLessThan(24 * 3_600_000);
  });
});

describe("formatInterval", () => {
  it("escolhe a unidade pela ordem de grandeza", () => {
    const min = 60_000;
    expect(formatInterval(20_000)).toBe("<1 min");
    expect(formatInterval(10 * min)).toBe("10 min");
    expect(formatInterval(3 * 60 * min)).toBe("3 h");
    expect(formatInterval(5 * 24 * 60 * min)).toBe("5 d");
    expect(formatInterval(30 * 24 * 60 * min)).toBe("1 mês");
    expect(formatInterval(90 * 24 * 60 * min)).toBe("3 meses");
    expect(formatInterval(365 * 24 * 60 * min)).toBe("1 ano");
    expect(formatInterval(550 * 24 * 60 * min)).toBe("1,5 anos");
  });
});

describe("cloze", () => {
  const text = "O {{c1::fonema}} é a menor unidade {{c2::distintiva::função}} da {{c1::língua}}.";

  it("lista os números de lacuna e sugere o próximo", () => {
    expect(clozeIndexes(text)).toEqual([1, 2]);
    expect(nextClozeIndex(text)).toBe(3);
    expect(nextClozeIndex("sem lacunas")).toBe(1);
  });

  it("esconde só a lacuna perguntada e mostra a dica", () => {
    expect(renderCloze(text, 2, false)).toEqual([
      { kind: "text", text: "O fonema é a menor unidade " },
      { kind: "hidden", text: "distintiva", hint: "função" },
      { kind: "text", text: " da língua." },
    ]);
  });

  it("esconde todas as ocorrências do mesmo número e revela na resposta", () => {
    const hidden = renderCloze(text, 1, false);
    expect(hidden.filter((s) => s.kind === "hidden").map((s) => s.text)).toEqual([
      "fonema",
      "língua",
    ]);
    const shown = renderCloze(text, 1, true);
    expect(shown.filter((s) => s.kind === "answer")).toHaveLength(2);
    expect(shown.map((s) => s.text).join("")).toBe(
      "O fonema é a menor unidade distintiva da língua.",
    );
  });
});

describe("árvore", () => {
  it("monta níveis e achata na ordem de exibição", () => {
    const items = [
      { id: "letras", parentId: null },
      { id: "sintaxe", parentId: "letras" },
      { id: "historia", parentId: null },
      { id: "periodo", parentId: "sintaxe" },
    ];
    const flat = flattenTree(buildTree(items));
    expect(flat.map((n) => [n.item.id, n.depth])).toEqual([
      ["letras", 0],
      ["sintaxe", 1],
      ["periodo", 2],
      ["historia", 0],
    ]);
  });

  it("não perde itens órfãos nem trava com ciclos", () => {
    const items = [
      { id: "orfao", parentId: "sumiu" },
      { id: "a", parentId: "b" },
      { id: "b", parentId: "a" },
    ];
    const flat = flattenTree(buildTree(items));
    expect(flat.map((n) => n.item.id).sort()).toEqual(["a", "b", "orfao"]);
  });
});

describe("intervalos personalizados", () => {
  const custom = { again: 10, hard: 60, good: 24 * 60, easy: 3 * 24 * 60, growth: 2 };
  const MIN = 60_000;

  it("usa o intervalo de cada resposta e cresce a cada acerto seguido", () => {
    expect(customDue(3, 0, custom, 0)).toEqual({ due: 24 * 60 * MIN, streak: 1 });
    expect(customDue(3, 0, custom, 1)).toEqual({ due: 2 * 24 * 60 * MIN, streak: 2 });
    expect(customDue(4, 0, custom, 2).due).toBe(4 * 3 * 24 * 60 * MIN);
    expect(customDue(1, 0, custom, 5)).toEqual({ due: 10 * MIN, streak: 0 });
  });

  it("com crescimento 1, o intervalo é sempre o mesmo; e há um teto de 5 anos", () => {
    expect(customDue(2, 0, { ...custom, growth: 1 }, 30).due).toBe(60 * MIN);
    const huge = customDue(4, 0, { ...custom, growth: 3 }, 50).due;
    expect(huge).toBe(5 * 365 * 24 * 60 * MIN);
  });

  it("o agendador aplica os intervalos e a prévia bate com o resultado", async () => {
    const scheduler = await createScheduler();
    const now = new Date("2026-01-01T12:00:00Z");
    let card = scheduler.newCard(now);
    const preview = scheduler.preview(card, now, DEFAULT_CUSTOM_INTERVALS);
    const first = scheduler.review(card, 3, now, DEFAULT_CUSTOM_INTERVALS);
    expect(first.next.due).toBe(preview[3]);
    expect(first.next.due - now.getTime()).toBe(3 * 24 * 60 * MIN);
    card = JSON.parse(JSON.stringify(first.next));
    const second = scheduler.review(card, 3, new Date(card.due), DEFAULT_CUSTOM_INTERVALS);
    expect(second.next.due - card.due).toBe(6 * 24 * 60 * MIN);
    // Voltar ao automático continua funcionando com o mesmo estado.
    const auto = scheduler.review(second.next, 3, new Date(second.next.due));
    expect(auto.next.reps).toBe(3);
  });
});
