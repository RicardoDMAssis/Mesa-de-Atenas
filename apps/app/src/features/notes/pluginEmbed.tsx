import type { Node as PMNode } from "@tiptap/pm/model";
import {
  mergeAttributes,
  Node,
  type NodeViewProps,
  NodeViewWrapper,
  ReactNodeViewRenderer,
} from "@tiptap/react";
import { Puzzle, X } from "lucide-react";
import { useAssetUrl } from "../../data/hooks";
import { iconFor, usePlugins } from "../../plugin-host/registry";
import { usePluginPanel } from "../../plugin-host/stores";

/** Nome do nó no documento da nota. */
export const PLUGIN_EMBED = "pluginEmbed";
export const MAX_EMBEDS_PER_NOTE = 20;

/** Quantos blocos de plugin há no documento. */
export function countEmbeds(doc: PMNode): number {
  let n = 0;
  doc.descendants((node) => {
    if (node.type.name === PLUGIN_EMBED) n++;
  });
  return n;
}

/**
 * Bloco estático de plugin: miniatura + rótulo. Nada de iframe dentro da nota (leve,
 * rola bem e funciona sem o plugin). Tocar abre o painel do plugin naquele ponto.
 */
function PluginEmbedView({ node, editor, deleteNode, selected }: NodeViewProps) {
  const pluginId = node.attrs.pluginId as string;
  const label = node.attrs.label as string;
  const plugin = usePlugins((s) => s.plugins.find((p) => p.manifest.id === pluginId));
  const loaded = usePlugins((s) => s.loaded);
  const thumbnail = useAssetUrl((node.attrs.thumbnail as string | null) ?? undefined);
  const available = Boolean(plugin?.record.enabled && plugin.manifest.contributes.panel);
  const Icon = plugin ? iconFor(plugin.manifest.icon) : Puzzle;

  return (
    <NodeViewWrapper
      className={`my-2 flex items-center gap-1 rounded-xl border bg-surface ${
        selected ? "border-accent" : "border-line"
      }`}
      data-plugin-embed={pluginId}
    >
      <button
        type="button"
        contentEditable={false}
        disabled={!available}
        onClick={() =>
          usePluginPanel
            .getState()
            .show(pluginId, { surface: "panel", embed: { data: node.attrs.data } })
        }
        className="flex min-h-16 min-w-0 flex-1 items-center gap-3 p-2 text-left enabled:hover:bg-bg disabled:cursor-default"
      >
        {thumbnail ? (
          <img src={thumbnail} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
        ) : (
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
            <Icon size={22} aria-hidden />
          </span>
        )}
        <span className="min-w-0">
          <span className="block truncate font-medium">{label}</span>
          <span className="block text-xs text-muted">
            {available
              ? `${plugin?.manifest.name} · toque para abrir`
              : loaded
                ? "Plugin indisponível"
                : ""}
          </span>
        </span>
      </button>
      {editor.isEditable && (
        <button
          type="button"
          contentEditable={false}
          aria-label={`Remover bloco ${label}`}
          onClick={deleteNode}
          className="mr-2 grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-bg hover:text-fg"
        >
          <X size={16} aria-hidden />
        </button>
      )}
    </NodeViewWrapper>
  );
}

export const PluginEmbed = Node.create({
  name: PLUGIN_EMBED,
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      pluginId: { default: "" },
      data: { default: null },
      label: { default: "" },
      thumbnail: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-plugin-embed]" }];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-plugin-embed": node.attrs.pluginId }),
      node.attrs.label,
    ];
  },

  // O rótulo entra no texto da nota (busca e texto plano).
  renderText: ({ node }) => node.attrs.label as string,

  addNodeView() {
    return ReactNodeViewRenderer(PluginEmbedView);
  },
});
