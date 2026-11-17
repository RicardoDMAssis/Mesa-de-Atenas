import { studyDay } from "@estudarella/core";
import { ArrowDown, ArrowUp, Plus, Settings2, X } from "lucide-react";
import { useState } from "react";
import { Card, PageTitle } from "../components/Card";
import { Button, Dialog, DialogActions, IconButton } from "../components/ui";
import { useDatabase } from "../data/DatabaseProvider";
import { useRolloverHour } from "../data/hooks";
import { type HomeItem, MAX_PLUGIN_WIDGETS, useHomeLayout } from "../features/home/layout";
import { useWidgetDefs, type WidgetDef } from "../features/home/registry";
import { useScreens } from "../navigation/screens";

export function Inicio() {
  const { info } = useDatabase();
  const hour = useRolloverHour();
  const today = new Date(`${studyDay(new Date(), hour)}T12:00:00`).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const { items, add, remove, move, configure, reset } = useHomeLayout();
  const defs = useWidgetDefs();
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [configuring, setConfiguring] = useState<HomeItem | null>(null);

  // Widgets cujo plugin foi desativado/removido somem sozinhos (e voltam se reativado).
  const shown = items
    .map((item) => ({ item, def: defs.find((d) => d.key === item.key) }))
    .filter((x): x is { item: HomeItem; def: WidgetDef } => Boolean(x.def));
  const pluginCount = shown.filter((x) => x.def.plugin).length;
  const available = defs.filter((d) => !items.some((i) => i.key === d.key));

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <PageTitle subtitle={today}>Início</PageTitle>
        <Button
          size="sm"
          variant={editing ? "primary" : "ghost"}
          onClick={() => setEditing(!editing)}
        >
          {editing ? "Pronto" : "Personalizar"}
        </Button>
      </div>

      <div className="grid gap-4">
        {!info.persistent && (
          <Card title="Seus dados não estão sendo salvos">
            <p className="text-sm text-danger">{info.reason}</p>
          </Card>
        )}

        {shown.length === 0 && !editing && (
          <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
            O Início está vazio. Toque em “Personalizar” para adicionar widgets.
          </p>
        )}

        {shown.map(({ item, def }, index) =>
          editing ? (
            <div
              key={item.key}
              className="flex items-center gap-2 rounded-xl border border-line bg-surface p-3"
              data-testid={`edit-${item.key}`}
            >
              <def.icon size={20} className="shrink-0 text-accent" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{def.title}</p>
                <p className="truncate text-xs text-muted">{def.description}</p>
              </div>
              {def.configurable && (
                <IconButton label={`Configurar ${def.title}`} onClick={() => setConfiguring(item)}>
                  <Settings2 size={18} aria-hidden />
                </IconButton>
              )}
              <IconButton
                label={`Subir ${def.title}`}
                disabled={index === 0}
                onClick={() => move(item.key, -1)}
              >
                <ArrowUp size={18} aria-hidden />
              </IconButton>
              <IconButton
                label={`Descer ${def.title}`}
                disabled={index === shown.length - 1}
                onClick={() => move(item.key, 1)}
              >
                <ArrowDown size={18} aria-hidden />
              </IconButton>
              <IconButton label={`Remover ${def.title}`} onClick={() => remove(item.key)}>
                <X size={18} aria-hidden />
              </IconButton>
            </div>
          ) : (
            <div key={item.key}>{def.render(item)}</div>
          ),
        )}

        {editing && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              onClick={() => setAdding(true)}
              disabled={available.length === 0}
            >
              <Plus size={18} aria-hidden />
              Adicionar widget
            </Button>
            <Button variant="ghost" onClick={reset}>
              Restaurar padrão
            </Button>
          </div>
        )}
      </div>

      <Dialog open={adding} onClose={() => setAdding(false)} title="Adicionar widget">
        {available.length === 0 ? (
          <p className="text-sm text-muted">Todos os widgets já estão no Início.</p>
        ) : (
          <ul className="grid gap-2" aria-label="Widgets disponíveis">
            {available.map((def) => {
              const blocked = Boolean(def.plugin) && pluginCount >= MAX_PLUGIN_WIDGETS;
              return (
                <li key={def.key}>
                  <button
                    type="button"
                    disabled={blocked}
                    onClick={() => {
                      add({
                        key: def.key,
                        ...(def.configurable ? { config: { screens: [] } } : {}),
                      });
                      setAdding(false);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl border border-line p-3 text-left hover:border-accent disabled:opacity-50"
                  >
                    <def.icon size={20} className="shrink-0 text-accent" aria-hidden />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{def.title}</span>
                      <span className="block text-xs text-muted">
                        {blocked
                          ? `Limite de ${MAX_PLUGIN_WIDGETS} widgets de plugins no Início`
                          : def.plugin
                            ? `Plugin: ${def.plugin}`
                            : def.description}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <DialogActions>
          <Button onClick={() => setAdding(false)}>Fechar</Button>
        </DialogActions>
      </Dialog>

      <ShortcutsDialog
        item={configuring}
        onClose={() => setConfiguring(null)}
        onSave={(screens) => configuring && configure(configuring.key, { screens })}
      />
    </>
  );
}

/** Escolha das telas do widget Atalhos (do app e de plugins), na ordem dos toques. */
function ShortcutsDialog({
  item,
  onClose,
  onSave,
}: {
  item: HomeItem | null;
  onClose: () => void;
  onSave: (screens: string[]) => void;
}) {
  const screens = useScreens().filter((s) => s.id !== "inicio");
  const [chosen, setChosen] = useState<string[]>([]);
  const [lastItem, setLastItem] = useState<HomeItem | null>(null);
  if (item !== lastItem) {
    setLastItem(item);
    setChosen(item?.config?.screens ?? []);
  }
  return (
    <Dialog open={item !== null} onClose={onClose} title="Telas dos atalhos">
      <ul className="grid gap-1" aria-label="Telas">
        {screens.map((s) => (
          <li key={s.id}>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-bg">
              <input
                type="checkbox"
                checked={chosen.includes(s.id)}
                onChange={(e) =>
                  setChosen((c) => (e.target.checked ? [...c, s.id] : c.filter((x) => x !== s.id)))
                }
              />
              <s.icon size={18} className="text-muted" aria-hidden />
              <span className="text-sm">{s.label}</span>
              {s.group === "plugin" && <span className="text-xs text-muted">plugin</span>}
            </label>
          </li>
        ))}
      </ul>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          variant="primary"
          onClick={() => {
            onSave(chosen);
            onClose();
          }}
        >
          Salvar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
