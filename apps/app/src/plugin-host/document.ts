/**
 * Monta o documento que roda dentro do iframe do plugin, prefixando uma
 * Content-Security-Policy que o plugin não consegue remover (ela é lida antes
 * de qualquer código dele).
 *
 * `network` vem do manifesto já validado: apenas origens https, sem caminho.
 */
export function buildPluginDocument(html: string, network: readonly string[] = []): string {
  const policy = [
    "default-src 'none'",
    "script-src 'unsafe-inline' blob:",
    "style-src 'unsafe-inline'",
    "img-src data: blob:",
    "media-src data: blob:",
    "font-src data:",
    "worker-src blob:",
    // blob: e data: são conteúdo que o próprio plugin já tem em mãos; não saem do aparelho.
    ["connect-src", "blob:", "data:", ...network].join(" "),
    "form-action 'none'",
    "base-uri 'none'",
  ].join("; ");

  const body = html.replace(/^\s*<!doctype[^>]*>/i, "");
  return `<!doctype html><meta http-equiv="Content-Security-Policy" content="${policy}">${body}`;
}
