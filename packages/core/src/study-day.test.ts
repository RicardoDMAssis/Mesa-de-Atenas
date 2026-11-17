import { describe, expect, it } from "vitest";
import { studyDay } from "./study-day";

describe("studyDay", () => {
  it("conta a madrugada como o dia anterior", () => {
    expect(studyDay(new Date(2026, 10, 17, 2, 30))).toBe("2026-11-16");
  });

  it("vira o dia exatamente na hora configurada", () => {
    expect(studyDay(new Date(2026, 10, 17, 3, 59))).toBe("2026-11-16");
    expect(studyDay(new Date(2026, 10, 17, 4, 0))).toBe("2026-11-17");
  });

  it("atravessa a virada de mês e de ano", () => {
    expect(studyDay(new Date(2027, 0, 1, 1, 0))).toBe("2026-12-31");
  });

  it("aceita virada à meia-noite", () => {
    expect(studyDay(new Date(2026, 10, 17, 0, 0), 0)).toBe("2026-11-17");
  });
});
