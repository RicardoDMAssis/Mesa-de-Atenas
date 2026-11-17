import { describe, expect, it } from "vitest";
import { manifestSchema } from "./manifest";

const base = { id: "anatomy-3d", name: "Esqueleto 3D", version: "1.0.0", apiVersion: "1" };

describe("manifestSchema", () => {
  it("preenche os padrões de um manifesto mínimo", () => {
    const m = manifestSchema.parse(base);
    expect(m.entry).toBe("index.html");
    expect(m.permissions).toEqual([]);
    expect(m.network).toEqual([]);
    expect(m.contributes.cardRenderer).toBe(false);
    expect(m.contributes.commands).toEqual([]);
  });

  it("aceita o manifesto do caso de referência", () => {
    const m = manifestSchema.parse({
      ...base,
      contributes: { panel: { title: "Anatomia 3D" }, cardRenderer: true, noteEmbed: true },
      activation: ["onSubjectTag:anatomia"],
      permissions: ["notes:read", "notes:write", "cards:write", "assets:write", "storage"],
    });
    expect(m.contributes.panel?.title).toBe("Anatomia 3D");
  });

  it("aceita widgets com tamanho padrão médio e limita a quantidade", () => {
    const m = manifestSchema.parse({
      ...base,
      contributes: {
        widgets: [
          { id: "busca", title: "Busca rápida", size: "small" },
          { id: "x", title: "X" },
        ],
      },
    });
    expect(m.contributes.widgets.map((w) => w.size)).toEqual(["small", "medium"]);
    const many = Array.from({ length: 6 }, (_, i) => ({ id: `w${i}`, title: "W" }));
    expect(manifestSchema.safeParse({ ...base, contributes: { widgets: many } }).success).toBe(
      false,
    );
  });

  it("recusa permissão desconhecida", () => {
    expect(manifestSchema.safeParse({ ...base, permissions: ["db:all"] }).success).toBe(false);
  });

  it("recusa rede sem https ou com caminho", () => {
    expect(manifestSchema.safeParse({ ...base, network: ["http://api.x.com"] }).success).toBe(
      false,
    );
    expect(manifestSchema.safeParse({ ...base, network: ["https://api.x.com/v1"] }).success).toBe(
      false,
    );
    expect(manifestSchema.safeParse({ ...base, network: ["https://api.x.com"] }).success).toBe(
      true,
    );
  });

  it("recusa versão de API diferente e entrada fora da pasta", () => {
    expect(manifestSchema.safeParse({ ...base, apiVersion: "2" }).success).toBe(false);
    expect(manifestSchema.safeParse({ ...base, entry: "../outro/index.html" }).success).toBe(false);
  });
});
