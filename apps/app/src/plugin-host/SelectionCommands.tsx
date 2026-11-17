import { useEffect, useRef, useState } from "react";
import { usePlugins } from "./registry";
import { usePluginPanel } from "./stores";

const EDITOR_SELECTOR = '[aria-label="Conteúdo da nota"]';
/** Quanto tempo a barra fica depois que a seleção some (o toque no botão pode desfazê-la). */
const LINGER = 600;

/** Texto selecionado dentro do conteúdo da nota (vale nos modos edição e leitura). */
function useNoteSelection(): string {
  const [text, setText] = useState("");
  const hide = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    const update = () => {
      const sel = document.getSelection();
      const node = sel?.anchorNode;
      const el = node instanceof Element ? node : node?.parentElement;
      const inside = Boolean(el?.closest(EDITOR_SELECTOR));
      const value = inside && sel ? sel.toString().trim() : "";
      clearTimeout(hide.current);
      if (value) setText(value);
      else hide.current = setTimeout(() => setText(""), LINGER);
    };
    document.addEventListener("selectionchange", update);
    return () => {
      document.removeEventListener("selectionchange", update);
      clearTimeout(hide.current);
    };
  }, []);
  return text;
}

/**
 * Barra com os comandos de plugins que agem sobre o texto selecionado na nota.
 * Fica no rodapé (acima da barra de navegação no celular) para não disputar
 * espaço com o menu nativo de copiar/colar, que aparece junto da seleção.
 */
export function SelectionCommands({ note }: { note: { id: string; title: string } }) {
  const selection = useNoteSelection();
  const panelOpen = usePluginPanel((s) => s.open !== null);
  const show = usePluginPanel((s) => s.show);
  const plugins = usePlugins((s) => s.plugins);
  const commands = plugins
    .filter((p) => p.record.enabled && p.manifest.contributes.panel)
    .flatMap((p) =>
      p.manifest.contributes.commands
        .filter((c) => c.context === "selection")
        .map((c) => ({ pluginId: p.manifest.id, pluginName: p.manifest.name, ...c })),
    );

  if (!selection || commands.length === 0 || selection.length > 500) return null;
  return (
    <div
      role="toolbar"
      aria-label="Ações para o texto selecionado"
      className={`fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 flex justify-center px-4 md:bottom-6 ${
        panelOpen ? "md:right-96" : ""
      }`}
    >
      <div className="flex max-w-full gap-1 overflow-x-auto rounded-full border border-line bg-surface p-1 shadow-lg">
        {commands.map((c) => (
          <button
            key={`${c.pluginId}:${c.id}`}
            type="button"
            // Não tira a seleção do texto ao tocar.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() =>
              show(c.pluginId, { surface: "panel", command: { id: c.id, selection }, note })
            }
            className="min-h-10 shrink-0 rounded-full px-4 text-sm font-medium text-accent hover:bg-accent-soft"
            title={c.pluginName}
          >
            {c.title}
          </button>
        ))}
      </div>
    </div>
  );
}
