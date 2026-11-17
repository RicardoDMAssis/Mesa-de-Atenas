import { describe, expect, it } from "vitest";
import { activityDays, addDays, computeStreak, dailySeries } from "./progress";

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();

describe("addDays", () => {
  it("atravessa mês, ano e fevereiro bissexto", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });
});

describe("activityDays", () => {
  it("usa a virada do dia: madrugada conta para o dia anterior", () => {
    const days = activityDays([at(2026, 11, 17, 2), at(2026, 11, 17, 10)]);
    expect([...days].sort()).toEqual(["2026-11-16", "2026-11-17"]);
  });
});

describe("computeStreak", () => {
  const days = (...list: string[]) => new Set(list);

  it("conta dias seguidos até hoje", () => {
    expect(computeStreak(days("2026-11-15", "2026-11-16", "2026-11-17"), "2026-11-17")).toEqual({
      current: 3,
      longest: 3,
      studiedToday: true,
    });
  });

  it("não quebra de manhã: se hoje ainda não teve estudo, vale a sequência até ontem", () => {
    expect(computeStreak(days("2026-11-15", "2026-11-16"), "2026-11-17")).toMatchObject({
      current: 2,
      studiedToday: false,
    });
  });

  it("quebra depois de um dia inteiro sem estudo, mas guarda a maior", () => {
    const s = computeStreak(
      days("2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-11-14"),
      "2026-11-17",
    );
    expect(s).toEqual({ current: 0, longest: 4, studiedToday: false });
  });

  it("sequência atravessando a virada do mês", () => {
    expect(computeStreak(days("2026-10-31", "2026-11-01"), "2026-11-01").current).toBe(2);
  });

  it("sem nenhum estudo", () => {
    expect(computeStreak(new Set(), "2026-11-17")).toEqual({
      current: 0,
      longest: 0,
      studiedToday: false,
    });
  });
});

describe("dailySeries", () => {
  it("soma por dia de estudo, com dias vazios em zero e hoje por último", () => {
    const series = dailySeries(
      [
        { at: at(2026, 11, 17, 9), value: 1 },
        { at: at(2026, 11, 17, 20), value: 1 },
        { at: at(2026, 11, 16, 3), value: 5 }, // madrugada do dia 16 = dia 15
        { at: at(2026, 10, 1), value: 99 }, // fora da janela
      ],
      { now: new Date(2026, 10, 17, 21), count: 3 },
    );
    expect(series).toEqual([
      { day: "2026-11-15", value: 5 },
      { day: "2026-11-16", value: 0 },
      { day: "2026-11-17", value: 2 },
    ]);
  });
});
