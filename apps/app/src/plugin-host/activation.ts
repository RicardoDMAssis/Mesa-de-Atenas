import { normalizeTag } from "@estudarella/db";
import type { LoadedPluginInfo } from "./registry";

const PREFIX = "onSubjectTag:";

/** Etiquetas de matéria que fazem cada plugin ativo ser sugerido (`activation`). */
export function subjectTagActivations(
  plugins: LoadedPluginInfo[],
): { tag: string; plugin: string; pluginId: string }[] {
  return plugins
    .filter((p) => p.record.enabled)
    .flatMap((p) =>
      p.manifest.activation
        .filter((a) => a.startsWith(PREFIX))
        .map((a) => ({
          tag: normalizeTag(a.slice(PREFIX.length)),
          plugin: p.manifest.name,
          pluginId: p.manifest.id,
        })),
    )
    .filter((a) => a.tag);
}

/**
 * Plugins a sugerir numa nota cuja matéria (ou matéria acima) tem estas etiquetas.
 * Só plugins ativos e com painel; nunca abrem sozinhos.
 */
export function suggestedPlugins(plugins: LoadedPluginInfo[], tags: string[]): LoadedPluginInfo[] {
  const wanted = new Set(tags);
  const ids = new Set(
    subjectTagActivations(plugins)
      .filter((a) => wanted.has(a.tag))
      .map((a) => a.pluginId),
  );
  return plugins.filter((p) => ids.has(p.manifest.id) && p.manifest.contributes.panel);
}
