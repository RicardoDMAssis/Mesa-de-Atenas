/** De onde vêm os arquivos de um plugin (pasta do app, pacote instalado, etc.). */
export interface PluginSource {
  readText(path: string): Promise<string>;
  readBytes(path: string): Promise<ArrayBuffer>;
}

/**
 * Valida e normaliza um caminho dentro da pasta do plugin. Recusa qualquer coisa
 * que possa apontar para fora dela (absoluto, "..", URL, barra invertida).
 */
export function normalizePluginPath(path: string): string {
  const invalid = () => new Error(`Caminho de plugin inválido: ${path}`);
  if (typeof path !== "string" || path.length === 0 || path.length > 200) throw invalid();
  if (/[\\?#:\0]/.test(path) || path.startsWith("/")) throw invalid();
  const segments = path.split("/").filter((s) => s !== "." && s !== "");
  if (segments.length === 0 || segments.includes("..")) throw invalid();
  return segments.join("/");
}

/** Resolve `ref` em relação à pasta do arquivo `from` (ex.: "ui/index.html" + "app.js"). */
export function resolvePluginPath(from: string, ref: string): string {
  const dir = from.includes("/") ? from.slice(0, from.lastIndexOf("/") + 1) : "";
  return normalizePluginPath(dir + ref);
}

/** Plugins distribuídos junto com o app, servidos como arquivos estáticos. */
export function urlSource(baseUrl: string): PluginSource {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const get = async (path: string) => {
    const res = await fetch(base + normalizePluginPath(path));
    // Em modo de desenvolvimento um arquivo inexistente devolve o HTML do app.
    if (!res.ok) throw new Error(`Arquivo de plugin não encontrado: ${path}`);
    return res;
  };
  return {
    readText: async (path) => (await get(path)).text(),
    readBytes: async (path) => (await get(path)).arrayBuffer(),
  };
}
