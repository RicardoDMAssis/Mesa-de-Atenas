import { type Manifest, manifestSchema } from "@estudarella/plugin-api";
import { buildPluginDocument } from "./document";
import { type PluginSource, resolvePluginPath } from "./source";

export interface LoadedPlugin {
  manifest: Manifest;
  /** Documento pronto para o `srcdoc` do iframe, já com a política de segurança. */
  document: string;
}

const isRelative = (ref: string) => !/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(ref);

/**
 * Lê o manifesto e monta o documento do plugin.
 *
 * Um plugin é uma pasta. O código e o estilo referenciados pela página de entrada
 * (`<script src>` e `<link rel="stylesheet">`) são embutidos aqui, porque o iframe
 * isolado não consegue buscar arquivos por conta própria. Os demais arquivos
 * (modelos 3D, imagens, dados) o plugin pede em tempo de uso por `plugin.readFile`,
 * e só então eles são carregados.
 *
 * Consequência para quem escreve plugins: o JavaScript precisa estar empacotado
 * (um arquivo por `<script>`, sem `import` de caminhos relativos).
 */
export async function loadPlugin(source: PluginSource): Promise<LoadedPlugin> {
  const manifest = manifestSchema.parse(JSON.parse(await source.readText("manifest.json")));
  const html = await source.readText(manifest.entry);
  const doc = new DOMParser().parseFromString(html, "text/html");

  const scripts = [...doc.querySelectorAll<HTMLScriptElement>("script[src]")];
  const styles = [...doc.querySelectorAll<HTMLLinkElement>('link[rel~="stylesheet"][href]')];

  await Promise.all([
    ...scripts.map(async (script) => {
      const ref = script.getAttribute("src") ?? "";
      if (!isRelative(ref)) return; // Externo: fica como está e é barrado pela política.
      const code = await source.readText(resolvePluginPath(manifest.entry, ref));
      script.removeAttribute("src");
      // Impede que um "</script>" dentro do código feche a tag antes da hora.
      script.textContent = code.replace(/<\/(script)/gi, "<\\/$1");
    }),
    ...styles.map(async (link) => {
      const ref = link.getAttribute("href") ?? "";
      if (!isRelative(ref)) return;
      const css = await source.readText(resolvePluginPath(manifest.entry, ref));
      const style = doc.createElement("style");
      style.textContent = css.replace(/<\/(style)/gi, "<\\/$1");
      link.replaceWith(style);
    }),
  ]);

  return {
    manifest,
    document: buildPluginDocument(doc.documentElement.outerHTML, manifest.network),
  };
}
