import { compileHighlights, type Highlighter } from "@estudarella/core";
import { type Db, pluginStorageGet } from "@estudarella/db";
import type { HighlightRule } from "@estudarella/plugin-api";
import { useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useDatabase } from "../data/DatabaseProvider";
import { type LoadedPluginInfo, usePlugins } from "./registry";

/**
 * Chave reservada em `plugin_data` onde o app guarda as regras de destaque de cada plugin.
 * O plugin não alcança essa chave por `storage.*` (só por `highlights.*`).
 */
export const HIGHLIGHTS_KEY = "__destaques";

/** Uma regra com o plugin de onde veio. */
export interface ActiveRule extends HighlightRule {
  pluginId: string;
  pluginName: string;
}

interface HighlightState {
  /** Regras por plugin, na ordem de ativação (a primeira vence nos empates). */
  byPlugin: Map<string, ActiveRule[]>;
  highlighter: Highlighter<ActiveRule>;
  set: (pluginId: string, rules: ActiveRule[]) => void;
  replaceAll: (byPlugin: Map<string, ActiveRule[]>) => void;
}

const build = (byPlugin: Map<string, ActiveRule[]>) =>
  compileHighlights(
    [...byPlugin.values()].flat().map((rule) => ({
      term: rule.term,
      ignoreAccents: rule.ignoreAccents,
      rule,
    })),
  );

export const useHighlights = create<HighlightState>((set, get) => ({
  byPlugin: new Map(),
  highlighter: build(new Map()),
  set: (pluginId, rules) => {
    const byPlugin = new Map(get().byPlugin);
    if (rules.length) byPlugin.set(pluginId, rules);
    else byPlugin.delete(pluginId);
    set({ byPlugin, highlighter: build(byPlugin) });
  },
  replaceAll: (byPlugin) => set({ byPlugin, highlighter: build(byPlugin) }),
}));

/** Preferência do aparelho: mostrar os destaques nas notas. */
export const useHighlightPrefs = create<{ show: boolean; setShow: (show: boolean) => void }>()(
  persist((set) => ({ show: true, setShow: (show) => set({ show }) }), {
    name: "estudarella:destaques",
  }),
);

/** Plugins que podem destacar: ativos, com a permissão e declarando `contributes.highlights`. */
export const canHighlight = (p: LoadedPluginInfo) =>
  p.record.enabled &&
  p.manifest.contributes.highlights &&
  p.record.grantedPermissions.includes("notes:highlight");

export async function readRules(db: Db, plugin: LoadedPluginInfo): Promise<ActiveRule[]> {
  const saved = await pluginStorageGet(db, plugin.manifest.id, HIGHLIGHTS_KEY);
  if (!Array.isArray(saved)) return [];
  return (saved as HighlightRule[]).map((rule) => ({
    ...rule,
    pluginId: plugin.manifest.id,
    pluginName: plugin.manifest.name,
  }));
}

/**
 * Mantém as regras de todos os plugins que destacam em dia: ativar, desativar ou remover um
 * plugin faz os destaques aparecerem ou sumirem na hora. Montado uma vez, no layout.
 */
export function HighlightsSync() {
  const { db } = useDatabase();
  const plugins = usePlugins((s) => s.plugins);
  const key = plugins
    .filter(canHighlight)
    .map((p) => `${p.manifest.id}@${p.record.version}`)
    .join(",");

  // biome-ignore lint/correctness/useExhaustiveDependencies: recarrega quando o conjunto muda
  useEffect(() => {
    let cancelled = false;
    const active = plugins.filter(canHighlight);
    Promise.all(active.map(async (p) => [p.manifest.id, await readRules(db, p)] as const)).then(
      (entries) => {
        if (!cancelled) useHighlights.getState().replaceAll(new Map(entries));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [db, key]);

  return null;
}
