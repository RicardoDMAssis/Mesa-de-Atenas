import { describe, expect, it } from "vitest";
import { buildPluginDocument } from "./document";

describe("buildPluginDocument", () => {
  it("coloca a política antes de qualquer conteúdo do plugin", () => {
    const doc = buildPluginDocument(
      "<!DOCTYPE html><html><head><script>x()</script></head></html>",
    );
    expect(doc.indexOf("Content-Security-Policy")).toBeLessThan(doc.indexOf("<script>"));
    expect(doc.match(/<!doctype/gi)).toHaveLength(1);
  });

  it("bloqueia toda a rede quando o manifesto não declara origens", () => {
    expect(buildPluginDocument("<p>oi</p>")).toContain("connect-src blob: data:;");
  });

  it("libera somente as origens declaradas", () => {
    const doc = buildPluginDocument("<p>oi</p>", ["https://api.dicionario.dev"]);
    expect(doc).toContain("connect-src blob: data: https://api.dicionario.dev;");
    expect(doc).toContain("default-src 'none'");
  });
});
