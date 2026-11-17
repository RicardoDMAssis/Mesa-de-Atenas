import {
  listDecks,
  pluginStorageDelete,
  pluginStorageGet,
  pluginStorageKeys,
  pluginStorageSet,
} from "@estudarella/db";
import { METHODS, type PluginContext, STORAGE_VALUE_MAX } from "@estudarella/plugin-api";
import { useToast } from "../components/Toast";
import type { Database } from "../data/db";
import { RpcFailure, type RpcHandler } from "./bridge";
import type { LoadedPluginInfo } from "./registry";
import { useActiveNote, useCardProposal, usePluginPanel } from "./stores";
import { themePayload } from "./theme";

interface Deps {
  database: Database;
  navigate: (to: string) => void;
  getContext: () => PluginContext;
}

/**
 * Métodos que um plugin pode chamar. Cada chamada passa por: método conhecido →
 * permissão concedida pelo usuário → parâmetros válidos. Só então executa.
 */
export function buildHandlers(plugin: LoadedPluginInfo, deps: Deps): Record<string, RpcHandler> {
  const id = plugin.manifest.id;
  const { db } = deps.database;

  const impl: { [M in keyof typeof METHODS]: (params: never) => unknown } = {
    "host.getTheme": () => themePayload(),
    "host.getContext": () => deps.getContext(),
    "ui.toast": (p: { message: string }) => {
      useToast.getState().show(`${plugin.manifest.name}: ${p.message}`);
      return null;
    },
    "ui.openPage": () => {
      if (!plugin.manifest.contributes.page) {
        throw new RpcFailure("invalid_params", "Este plugin não tem tela própria.");
      }
      usePluginPanel.getState().close();
      deps.navigate(`/plugins/${id}`);
      return null;
    },
    "ui.closePanel": () => {
      if (usePluginPanel.getState().open?.pluginId === id) usePluginPanel.getState().close();
      return null;
    },
    "notes.getCurrent": () => {
      const { note, editor } = useActiveNote.getState();
      if (!note || !editor) return null;
      return { id: note.id, title: note.title, text: editor.getText({ blockSeparator: "\n" }) };
    },
    "notes.insertText": (p: { text: string }) => {
      const { editor } = useActiveNote.getState();
      if (!editor) throw new RpcFailure("invalid_params", "Nenhuma nota aberta.");
      if (!editor.isEditable)
        throw new RpcFailure("invalid_params", "A nota está em modo leitura.");
      // Sempre como texto puro: nada de HTML vindo do plugin.
      editor.chain().focus().insertContent({ type: "text", text: p.text }).run();
      return null;
    },
    "decks.list": async () =>
      (await listDecks(db, Date.now())).map((d) => ({ id: d.id, name: d.name })),
    "cards.propose": async (p: { front: string; back: string }) => ({
      created: await useCardProposal
        .getState()
        .propose({ pluginName: plugin.manifest.name, front: p.front, back: p.back }),
    }),
    "storage.get": (p: { key: string }) => pluginStorageGet(db, id, p.key),
    "storage.set": async (p: { key: string; value: unknown }) => {
      const size = JSON.stringify(p.value ?? null).length;
      if (size > STORAGE_VALUE_MAX) {
        throw new RpcFailure("invalid_params", "Valor grande demais (máximo de 256 KB por chave).");
      }
      await pluginStorageSet(db, id, p.key, p.value ?? null);
      return null;
    },
    "storage.delete": async (p: { key: string }) => {
      await pluginStorageDelete(db, id, p.key);
      return null;
    },
    "storage.keys": () => pluginStorageKeys(db, id),
  };

  const granted = new Set(plugin.record.grantedPermissions);
  const handlers: Record<string, RpcHandler> = {};
  for (const [name, spec] of Object.entries(METHODS)) {
    handlers[name] = (params) => {
      if (spec.permission && !granted.has(spec.permission)) {
        throw new RpcFailure("forbidden", `Permissão necessária: ${spec.permission}.`);
      }
      const parsed = spec.params.safeParse(params);
      if (!parsed.success) throw new RpcFailure("invalid_params", "Parâmetros inválidos.");
      return impl[name as keyof typeof METHODS](parsed.data as never);
    };
  }
  return handlers;
}
