import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { InstallError, readPackage } from "./installed";

const manifest = {
  id: "teste",
  name: "Teste",
  version: "1.0.0",
  apiVersion: "1",
  entry: "index.html",
};
const json = (v: unknown) => strToU8(JSON.stringify(v));

describe("readPackage", () => {
  it("lê manifesto e arquivos na raiz", () => {
    const pkg = readPackage(
      zipSync({
        "manifest.json": json(manifest),
        "index.html": strToU8("<p>oi</p>"),
        "a/b.js": strToU8("x"),
      }),
    );
    expect(pkg.manifest.id).toBe("teste");
    expect([...pkg.files.keys()].sort()).toEqual(["a/b.js", "index.html", "manifest.json"]);
  });

  it("aceita tudo dentro de uma pasta (zip do GitHub)", () => {
    const pkg = readPackage(
      zipSync({
        "teste-main/manifest.json": json(manifest),
        "teste-main/index.html": strToU8("x"),
      }),
    );
    expect([...pkg.files.keys()].sort()).toEqual(["index.html", "manifest.json"]);
  });

  it("recusa pacotes inválidos com mensagens claras", () => {
    expect(() => readPackage(strToU8("não é zip"))).toThrow(InstallError);
    expect(() => readPackage(zipSync({ "index.html": strToU8("x") }))).toThrow("manifest.json");
    expect(() =>
      readPackage(zipSync({ "manifest.json": json({ ...manifest, apiVersion: "9" }) })),
    ).toThrow("inválido");
    expect(() => readPackage(zipSync({ "manifest.json": json(manifest) }))).toThrow("index.html");
    expect(() =>
      readPackage(
        zipSync({
          "manifest.json": json(manifest),
          "index.html": strToU8("x"),
          "../fora.js": strToU8("x"),
        }),
      ),
    ).toThrow("Caminho inválido");
  });
});
