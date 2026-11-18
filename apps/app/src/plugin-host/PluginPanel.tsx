import { X } from "lucide-react";
import { useEffect } from "react";
import { PluginSurface } from "./PluginSurface";
import { usePlugins } from "./registry";
import { usePluginPanel } from "./stores";

/**
 * Painel de plugin: coluna à direita no computador, folha inferior no celular.
 * Não bloqueia a tela: dá para continuar lendo e selecionando na nota.
 */
export function PluginPanel() {
  const open = usePluginPanel((s) => s.open);
  const close = usePluginPanel((s) => s.close);
  const plugin = usePlugins((s) => s.plugins.find((p) => p.manifest.id === open?.pluginId));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open) return null;
  const { context } = open;
  return (
    <aside
      data-plugin-panel
      aria-label={plugin?.manifest.contributes.panel?.title ?? "Plugin"}
      className="fixed inset-x-0 bottom-0 z-40 flex h-[60dvh] flex-col rounded-t-2xl border border-line bg-surface shadow-2xl md:inset-x-auto md:top-0 md:right-0 md:h-full md:w-96 md:rounded-none md:border-y-0 md:border-r-0"
    >
      <header className="flex items-center gap-2 border-b border-line px-4 py-2">
        <p className="min-w-0 flex-1 truncate text-sm font-medium">
          {plugin?.manifest.contributes.panel?.title ?? plugin?.manifest.name}
        </p>
        <button
          type="button"
          aria-label="Fechar painel"
          onClick={close}
          className="inline-flex size-9 items-center justify-center rounded-lg text-muted hover:bg-bg hover:text-fg"
        >
          <X size={18} aria-hidden />
        </button>
      </header>
      <div className="min-h-0 flex-1 pb-[env(safe-area-inset-bottom)]">
        <PluginSurface
          pluginId={open.pluginId}
          surface="panel"
          context={{ command: context.command, note: context.note, embed: context.embed }}
        />
      </div>
    </aside>
  );
}
