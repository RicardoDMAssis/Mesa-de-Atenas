import { listPluginRecords, type PluginRecord, upsertPlugin } from "@estudarella/db";
import { type Manifest, manifestSchema } from "@estudarella/plugin-api";
import {
  BookA,
  Box,
  GraduationCap,
  Languages,
  type LucideIcon,
  Puzzle,
  Sparkles,
} from "lucide-react";
import { useEffect } from "react";
import { create } from "zustand";
import { useDatabase } from "../data/DatabaseProvider";
import { useLiveQuery } from "../data/useLiveQuery";
import { type Screen, usePluginScreens } from "../navigation/screens";
import { installedSource } from "./installed";
import { type PluginSource, urlSource } from "./source";

export interface LoadedPluginInfo {
  manifest: Manifest;
  record: PluginRecord;
  source: PluginSource;
}

const ICONS: Record<string, LucideIcon> = {
  "book-a": BookA,
  languages: Languages,
  "graduation-cap": GraduationCap,
  sparkles: Sparkles,
  box: Box,
};
export const iconFor = (name?: string): LucideIcon => (name && ICONS[name]) || Puzzle;

/** Plugins conhecidos neste aparelho, com o manifesto validado e de onde ler os arquivos. */
export const usePlugins = create<{ plugins: LoadedPluginInfo[]; loaded: boolean }>(() => ({
  plugins: [],
  loaded: false,
}));

export const findPlugin = (id: string) =>
  usePlugins.getState().plugins.find((p) => p.manifest.id === id);

// As fontes são reaproveitadas entre renderizações (o iframe recarrega se a fonte mudar).
const sources = new Map<string, PluginSource>();
function sourceFor(record: PluginRecord): PluginSource {
  const key = `${record.source}:${record.pluginId}:${record.version}`;
  let source = sources.get(key);
  if (!source) {
    source =
      record.source === "builtin"
        ? urlSource(`/builtin-plugins/${record.pluginId}`)
        : installedSource(record.pluginId);
    sources.set(key, source);
  }
  return source;
}

/** Registra os plugins oficiais distribuídos com o app (novos começam desativados). */
async function syncBuiltins(db: ReturnType<typeof useDatabase>["db"]) {
  try {
    const ids = (await (await fetch("/builtin-plugins/index.json")).json()) as string[];
    for (const id of ids) {
      const res = await fetch(`/builtin-plugins/${id}/manifest.json`);
      const parsed = manifestSchema.safeParse(await res.json());
      if (!parsed.success) continue;
      await upsertPlugin(db, {
        pluginId: parsed.data.id,
        version: parsed.data.version,
        manifest: parsed.data,
        source: "builtin",
      });
    }
  } catch (error) {
    console.warn("[plugins] não foi possível ler os plugins oficiais", error);
  }
}

/**
 * Mantém a lista de plugins em dia com o banco e publica as telas dos plugins
 * ativos na navegação. Montado uma vez, no layout do app.
 */
export function PluginsSync() {
  const { db } = useDatabase();
  const records = useLiveQuery(["plugins"], listPluginRecords);

  useEffect(() => {
    void syncBuiltins(db);
  }, [db]);

  useEffect(() => {
    if (!records.data) return;
    const plugins: LoadedPluginInfo[] = [];
    for (const record of records.data) {
      const parsed = manifestSchema.safeParse(record.manifest);
      if (parsed.success)
        plugins.push({ manifest: parsed.data, record, source: sourceFor(record) });
    }
    plugins.sort((a, b) => a.manifest.name.localeCompare(b.manifest.name, "pt-BR"));
    usePlugins.setState({ plugins, loaded: true });

    const screens: Screen[] = plugins
      .filter((p) => p.record.enabled && p.manifest.contributes.page)
      .map((p) => ({
        id: `plugin:${p.manifest.id}`,
        label: p.manifest.contributes.page?.title ?? p.manifest.name,
        to: `/plugins/${p.manifest.id}`,
        icon: iconFor(p.manifest.icon),
        group: "plugin",
        keywords: `${p.manifest.name} ${p.manifest.description}`,
      }));
    usePluginScreens.setState({ screens });
  }, [records.data]);

  return null;
}
