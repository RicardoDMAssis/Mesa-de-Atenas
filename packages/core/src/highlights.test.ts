import { describe, expect, it } from "vitest";
import { compileHighlights, formulaParts } from "./highlights";

const words = (text: string, terms: string[], ignoreAccents = true) => {
  const h = compileHighlights(terms.map((term) => ({ term, ignoreAccents, rule: term })));
  return h.find(text).map((m) => `${text.slice(m.from, m.to)}=${m.rule}`);
};

describe("compileHighlights", () => {
  it("casa palavra inteira, sem diferenciar maiúsculas", () => {
    expect(words("Portanto, o ato é contato. PORTANTO!", ["portanto", "ato"])).toEqual([
      "Portanto=portanto",
      "ato=ato",
      "PORTANTO=portanto",
    ]);
  });

  it("acentos opcionais por regra", () => {
    expect(words("A fonética e a fonetica", ["fonetica"])).toEqual([
      "fonética=fonetica",
      "fonetica=fonetica",
    ]);
    expect(words("A fonética e a fonetica", ["fonetica"], false)).toEqual(["fonetica=fonetica"]);
  });

  it("prefere o termo mais longo e, no empate, a regra que veio antes", () => {
    expect(words("No entanto, entanto.", ["entanto", "no entanto"])).toEqual([
      "No entanto=no entanto",
      "entanto=entanto",
    ]);
    const h = compileHighlights([
      { term: "sal", ignoreAccents: true, rule: "primeiro" },
      { term: "sal", ignoreAccents: true, rule: "segundo" },
    ]);
    expect(h.find("sal").map((m) => m.rule)).toEqual(["primeiro"]);
  });

  it("aceita fórmulas com números e sinais", () => {
    expect(words("H2O e CO2, não H2O2 nem NaCl.", ["H2O", "CO2", "NaCl"])).toEqual([
      "H2O=H2O",
      "CO2=CO2",
      "NaCl=NaCl",
    ]);
  });

  it("devolve posições do texto original, mesmo com emoji e acentos antes", () => {
    const text = "🙂 Ação: fêmur";
    const [m] = compileHighlights([{ term: "femur", ignoreAccents: true, rule: 1 }]).find(text);
    expect(m && text.slice(m.from, m.to)).toBe("fêmur");
  });

  it("respeita o limite de destaques", () => {
    const h = compileHighlights([{ term: "a", ignoreAccents: true, rule: 1 }]);
    expect(h.find("a a a a a", 3)).toHaveLength(3);
  });

  it("é rápido numa nota longa com muitas regras", () => {
    const terms = Array.from({ length: 2000 }, (_, i) => ({
      term: `termo${i}`,
      ignoreAccents: true,
      rule: i,
    }));
    const h = compileHighlights(terms);
    const text = Array.from({ length: 20_000 }, (_, i) =>
      i % 50 === 0 ? `termo${i % 2000}` : "palavra",
    ).join(" ");
    const start = performance.now();
    const found = h.find(text);
    expect(found.length).toBe(400);
    expect(performance.now() - start).toBeLessThan(500);
  });
});

describe("formulaParts", () => {
  it("quantidades em subscrito e carga em sobrescrito", () => {
    expect(formulaParts("H2SO4")).toEqual([
      { from: 1, to: 2, kind: "sub" },
      { from: 4, to: 5, kind: "sub" },
    ]);
    expect(formulaParts("Fe3+")).toEqual([{ from: 2, to: 4, kind: "sup" }]);
    expect(formulaParts("SO4 2-")).toEqual([
      { from: 2, to: 3, kind: "sub" },
      { from: 4, to: 6, kind: "sup" },
    ]);
    expect(formulaParts("Ca(OH)2")).toEqual([{ from: 6, to: 7, kind: "sub" }]);
    expect(formulaParts("NaCl")).toEqual([]);
  });
});
