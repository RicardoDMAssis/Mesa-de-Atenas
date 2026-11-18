import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { boneLabel, loadBones, matches } from "./bones";

const raw = readFileSync(new URL("../public/modelo/ossos.json", import.meta.url));

describe("ossos", () => {
  it("lê o ossos.json do modelo", async () => {
    const data = await loadBones(async () => raw.buffer.slice(raw.byteOffset) as ArrayBuffer);
    expect(data.regioes).toContain("Membro inferior");
    expect(data.provisorio).toBe(false);
    expect(Object.keys(data.ossos).length).toBeGreaterThan(200);
    expect(data.ossos["femur-esquerdo"]).toMatchObject({
      pt: "Fêmur (lado esquerdo)",
      la: "Os femoris",
      regiao: "Membro inferior",
      lado: "esquerdo",
    });
    expect(data.ossos["vertebra-l1"]).toMatchObject({ pt: "Vértebra L1", lado: null });
    expect(boneLabel(data, "femur-esquerdo")).toBe("Fêmur (lado esquerdo) · Os femoris");
    expect(boneLabel(data, "nao-existe")).toBe("nao-existe");
  });

  it("busca sem acento, em português ou latim", () => {
    const femur = {
      pt: "Fêmur (lado esquerdo)",
      la: "Os femoris",
      regiao: "Membro inferior",
      lado: null,
    };
    expect(matches(femur, "femur")).toBe(true);
    expect(matches(femur, "FEMORIS")).toBe(true);
    expect(matches(femur, "tibia")).toBe(false);
    expect(matches(femur, "  ")).toBe(false);
  });
});
