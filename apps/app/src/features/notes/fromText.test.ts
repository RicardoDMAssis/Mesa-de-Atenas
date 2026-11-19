import { describe, expect, it } from "vitest";
import { plainTextOf, textToNoteDoc } from "./fromText";

describe("textToNoteDoc", () => {
  it("separa parágrafos, títulos e listas", () => {
    const doc = textToNoteDoc(
      "## Célula\nUnidade básica\nda vida.\n\n- núcleo\n* membrana\n• citoplasma\n\n### Tipos\nProcariontes",
    );
    expect(doc.content.map((b) => b.type)).toEqual([
      "heading",
      "paragraph",
      "bulletList",
      "heading",
      "paragraph",
    ]);
    expect(doc.content[1]).toEqual({
      type: "paragraph",
      content: [
        { type: "text", text: "Unidade básica" },
        { type: "hardBreak" },
        { type: "text", text: "da vida." },
      ],
    });
    expect(plainTextOf(doc)).toBe(
      "Célula\nUnidade básica\nda vida.\nnúcleo\nmembrana\ncitoplasma\nTipos\nProcariontes",
    );
  });

  it("não interpreta HTML e aceita texto vazio", () => {
    const doc = textToNoteDoc("<b>oi</b> <script>x</script>");
    expect(doc.content[0]).toEqual({
      type: "paragraph",
      content: [{ type: "text", text: "<b>oi</b> <script>x</script>" }],
    });
    expect(textToNoteDoc("  \n\n").content).toEqual([{ type: "paragraph" }]);
  });

  it("um # só não é título (o editor usa níveis 2 e 3)", () => {
    expect(textToNoteDoc("# 1 vale").content[0]?.type).toBe("paragraph");
    expect(textToNoteDoc("##").content[0]?.type).toBe("paragraph");
  });
});
