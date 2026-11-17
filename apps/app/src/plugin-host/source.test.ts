import { describe, expect, it } from "vitest";
import { normalizePluginPath, resolvePluginPath } from "./source";

describe("normalizePluginPath", () => {
  it("aceita caminhos dentro da pasta do plugin", () => {
    expect(normalizePluginPath("plugin.js")).toBe("plugin.js");
    expect(normalizePluginPath("./models/heart.glb")).toBe("models/heart.glb");
    expect(normalizePluginPath("a//b/./c.bin")).toBe("a/b/c.bin");
  });

  it("recusa tudo que pode sair da pasta", () => {
    for (const path of [
      "",
      ".",
      "/etc/passwd",
      "../outro-plugin/dados.json",
      "a/../../b",
      "https://exemplo.com/x.js",
      "//exemplo.com/x.js",
      "a\\..\\b",
      "x.js?v=1",
      "x.js#frag",
    ]) {
      expect(() => normalizePluginPath(path), path).toThrow();
    }
  });
});

describe("resolvePluginPath", () => {
  it("resolve em relação à pasta da página de entrada", () => {
    expect(resolvePluginPath("index.html", "plugin.js")).toBe("plugin.js");
    expect(resolvePluginPath("ui/index.html", "app.js")).toBe("ui/app.js");
    expect(() => resolvePluginPath("ui/index.html", "../../segredo.js")).toThrow();
  });
});
