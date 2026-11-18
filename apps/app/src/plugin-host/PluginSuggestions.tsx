import { inheritedTags } from "@estudarella/db";
import { useSubjects } from "../data/hooks";
import { suggestedPlugins } from "./activation";
import { iconFor, usePlugins } from "./registry";
import { usePluginPanel } from "./stores";

/**
 * Sugestão discreta no topo da nota: "Abrir <plugin>" quando a matéria da nota (ou uma
 * acima dela) tem uma etiqueta que o plugin usa. O painel só abre se o usuário tocar.
 */
export function PluginSuggestions({
  note,
}: {
  note: { id: string; title: string; subjectId: string | null };
}) {
  const { list } = useSubjects();
  const plugins = usePlugins((s) => s.plugins);
  const open = usePluginPanel((s) => s.open);
  const tags = inheritedTags(list, note.subjectId);
  const suggested = tags.length ? suggestedPlugins(plugins, tags) : [];
  if (suggested.length === 0) return null;
  return (
    <div className="mb-4 flex flex-wrap gap-2" data-testid="plugin-suggestions">
      {suggested.map((p) => {
        const Icon = iconFor(p.manifest.icon);
        const isOpen = open?.pluginId === p.manifest.id;
        return (
          <button
            key={p.manifest.id}
            type="button"
            disabled={isOpen}
            onClick={() =>
              usePluginPanel.getState().show(p.manifest.id, {
                surface: "panel",
                note: { id: note.id, title: note.title },
              })
            }
            className="inline-flex min-h-9 items-center gap-2 rounded-full border border-line bg-surface px-3 text-sm text-muted hover:border-accent hover:text-fg disabled:opacity-60"
          >
            <Icon size={16} aria-hidden className="text-accent" />
            Abrir {p.manifest.contributes.panel?.title ?? p.manifest.name}
          </button>
        );
      })}
    </div>
  );
}
