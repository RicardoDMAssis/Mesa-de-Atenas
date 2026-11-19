import { describe, expect, it } from "vitest";
import { guessTitle, layoutText, tidyOcrText } from "./cleanup";

describe("tidyOcrText", () => {
  it("junta linhas do mesmo parágrafo e desfaz a hifenização", () => {
    const raw =
      "A mitocôndria é a orga-\nnela responsável pela\nrespiração celular.\n\nOutro parágrafo.";
    expect(tidyOcrText(raw)).toBe(
      "A mitocôndria é a organela responsável pela respiração celular.\n\nOutro parágrafo.",
    );
  });

  it("mantém o hífen de palavra composta antes de maiúscula", () => {
    expect(tidyOcrText("Guerra Hispano-\nAmericana")).toBe("Guerra Hispano-Americana");
  });

  it("transforma marcadores em lista e mantém itens numerados em linhas próprias", () => {
    const raw =
      "Funções:\n• proteção\n– sustentação\n· movimento\n\n1. Fase G1\n2) Fase S\na) item";
    expect(tidyOcrText(raw)).toBe(
      "Funções:\n- proteção\n- sustentação\n- movimento\n\n1. Fase G1\n2) Fase S\na) item",
    );
  });

  it("tira linhas de sujeira", () => {
    expect(tidyOcrText("Texto bom\n___\n|\n. ,\n\n~~~")).toBe("Texto bom");
  });

  it("mantém as quebras quando pedido", () => {
    expect(tidyOcrText("verso um\nverso dois", { keepLines: true })).toBe("verso um\nverso dois");
  });
});

describe("guessTitle", () => {
  it("usa a primeira linha curta e sozinha", () => {
    expect(guessTitle("Citologia\n\nA célula é...")).toEqual({
      title: "Citologia",
      rest: "A célula é...",
    });
  });

  it("não inventa título quando o texto começa por um parágrafo", () => {
    const text =
      "A célula é a unidade básica da vida, presente em todos os seres vivos conhecidos.";
    expect(guessTitle(text)).toEqual({ title: "", rest: text });
  });
});

describe("layoutText", () => {
  let y = 0;
  /** Linhas seguidas, 40 px uma da outra; `gap` acrescenta espaço antes da linha. */
  const line = (text: string, width: number, gap = 0, indent = 0) => {
    y += 40 + gap;
    return { text, x0: 100 + indent, x1: 100 + indent + width, y0: y, y1: y + 30 };
  };

  it("separa parágrafos, título e lista pelas linhas curtas", () => {
    const text = layoutText([
      {
        paragraphs: [
          {
            lines: [
              line("Capítulo 3 — Citologia", 300),
              line("A célula é a unidade estrutural e funcional", 1000),
              line("dos seres vivos.", 300),
              line("Toda célula tem membrana, citoplasma e", 1000),
              line("material genético.", 320),
              line("Funções da membrana:", 400),
              line("• proteção;", 200),
              line("• controle da entrada e saída;", 500),
              line("• reconhecimento.", 260),
              line("Depois da lista vem outro parágrafo,", 1000),
              line("que termina aqui.", 300),
            ],
          },
        ],
      },
    ]);
    expect(text).toBe(
      "Capítulo 3 — Citologia\n\n" +
        "A célula é a unidade estrutural e funcional\ndos seres vivos.\n\n" +
        "Toda célula tem membrana, citoplasma e\nmaterial genético.\n\n" +
        "Funções da membrana:\n\n" +
        "• proteção;\n• controle da entrada e saída;\n• reconhecimento.\n\n" +
        "Depois da lista vem outro parágrafo,\nque termina aqui.",
    );
    const { title, rest } = guessTitle(tidyOcrText(text));
    expect(title).toBe("Capítulo 3 — Citologia");
    expect(rest).toContain("A célula é a unidade estrutural e funcional dos seres vivos.\n\n");
    expect(rest).toContain("- proteção;\n- controle da entrada e saída;\n- reconhecimento.");
  });
});

describe("layoutText: espaço e recuo", () => {
  it("separa parágrafos cuja última linha é cheia, pelo espaço ou pelo recuo", () => {
    const l = (text: string, y0: number, x0 = 100) => ({ text, x0, x1: 1100, y0, y1: y0 + 30 });
    const text = layoutText([
      {
        paragraphs: [
          {
            lines: [
              l("primeira linha cheia do parágrafo um", 0),
              l("última linha também cheia do parágrafo um", 40),
              l("parágrafo dois depois de um espaço maior", 120),
              l("continua o parágrafo dois até a margem", 160),
              l("parágrafo três começa com recuo na linha", 200, 160),
              l("e segue na margem normal até o fim", 240),
            ],
          },
        ],
      },
    ]);
    expect(text.split("\n\n")).toHaveLength(3);
  });

  it("não separa a continuação recuada de um item de lista", () => {
    const l = (text: string, y0: number, x0 = 100) => ({ text, x0, x1: 1100, y0, y1: y0 + 30 });
    const text = layoutText([
      {
        paragraphs: [
          {
            lines: [
              l("• um item comprido que ocupa a linha toda e", 0),
              l("continua aqui, recuado sob o texto do item", 40, 130),
            ],
          },
        ],
      },
    ]);
    expect(tidyOcrText(text)).toBe(
      "- um item comprido que ocupa a linha toda e continua aqui, recuado sob o texto do item",
    );
  });
});
