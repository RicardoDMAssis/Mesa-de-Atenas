import {
  getPluginFile,
  listDecks,
  listOwnCards,
  listPluginFiles,
  ownCardsByIds,
  pluginFilesUsage,
  pluginStorageDelete,
  pluginStorageGet,
  pluginStorageKeys,
  pluginStorageSet,
  registerAsset,
  registerPluginFile,
  removePluginFile,
  setPluginCardContent,
} from "@estudarella/db";
import {
  FILE_MAX_BYTES,
  FILES_QUOTA_BYTES,
  METHODS,
  type MethodParams,
  type PluginContext,
  STORAGE_VALUE_MAX,
} from "@estudarella/plugin-api";
import { useToast } from "../components/Toast";
import type { Database } from "../data/db";
import { shrinkImage } from "../features/cards/images";
import { countEmbeds, MAX_EMBEDS_PER_NOTE, PLUGIN_EMBED } from "../features/notes/pluginEmbed";
import { useMascotEvents, useMascotStore } from "../stores/mascot";
import { RpcFailure, type RpcHandler } from "./bridge";
import { canHighlight, HIGHLIGHTS_KEY, readRules, useHighlights } from "./highlights";
import type { LoadedPluginInfo } from "./registry";
import { normalizePluginPath } from "./source";
import { useActiveNote, useCardProposal, usePluginPanel, usePluginRequest } from "./stores";
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
    "notes.insertEmbed": (p: { data: unknown; label: string; thumbnail?: string }) => {
      if (!plugin.manifest.contributes.noteEmbed) {
        throw new RpcFailure("invalid_params", "O manifesto não declara contributes.noteEmbed.");
      }
      const { editor } = useActiveNote.getState();
      if (!editor) throw new RpcFailure("invalid_params", "Nenhuma nota aberta.");
      if (!editor.isEditable)
        throw new RpcFailure("invalid_params", "A nota está em modo leitura.");
      if (countEmbeds(editor.state.doc) >= MAX_EMBEDS_PER_NOTE) {
        throw new RpcFailure(
          "invalid_params",
          `Limite de ${MAX_EMBEDS_PER_NOTE} blocos de plugin por nota.`,
        );
      }
      editor
        .chain()
        .focus()
        .insertContent({
          type: PLUGIN_EMBED,
          attrs: { pluginId: id, data: p.data, label: p.label, thumbnail: p.thumbnail ?? null },
        })
        .run();
      return null;
    },
    "files.read": async (p: { path: string }) => {
      let path: string;
      try {
        path = normalizePluginPath(p.path);
      } catch {
        throw new RpcFailure("forbidden", "Caminho fora da pasta do plugin.");
      }
      try {
        return await plugin.source.readBytes(path);
      } catch {
        throw new RpcFailure("invalid_params", "Arquivo não encontrado.");
      }
    },
    "assets.save": async (p: { data: ArrayBuffer; mime: string }) => {
      let blob: Blob;
      try {
        // Reduz para no máximo 1600 px, como as imagens de cards.
        blob = await shrinkImage(new Blob([p.data], { type: p.mime }));
      } catch {
        throw new RpcFailure("invalid_params", "Não foi possível ler a imagem.");
      }
      const stored = await deps.database.assets.put(blob);
      await registerAsset(db, { ...stored, pluginId: id });
      return { assetId: stored.hash };
    },
    "cards.proposeVisual": async (p: {
      content: unknown;
      fallback: { front: string; back: string; image?: string };
    }) => {
      if (!plugin.manifest.contributes.cardRenderer) {
        throw new RpcFailure("invalid_params", "O manifesto não declara contributes.cardRenderer.");
      }
      return {
        created: await useCardProposal.getState().propose({
          pluginId: id,
          pluginName: plugin.manifest.name,
          front: p.fallback.front,
          back: p.fallback.back,
          visual: { pluginId: id, content: p.content, image: p.fallback.image },
        }),
      };
    },
    "cards.propose": async (p: { front: string; back: string }) => ({
      created: await useCardProposal
        .getState()
        .propose({ pluginId: id, pluginName: plugin.manifest.name, front: p.front, back: p.back }),
    }),
    "mascot.say": (p: { message: string; mood: "idle" | "thinking" | "happy" }) => {
      // Sem mascote escolhido, a fala é descartada (o plugin fica sabendo).
      if (!useMascotStore.getState().mascotId) return { shown: false };
      useMascotEvents
        .getState()
        .push({ kind: "plugin", text: p.message, mood: p.mood, actions: [] }, plugin.manifest.name);
      return { shown: true };
    },
    "cards.proposeBatch": async (p: MethodParams<"cards.proposeBatch">) => {
      if (p.cards.some((c) => "content" in c) && !plugin.manifest.contributes.cardRenderer) {
        throw new RpcFailure("invalid_params", "Cards visuais exigem contributes.cardRenderer.");
      }
      const ids = await usePluginRequest.getState().ask({
        kind: "batch",
        pluginId: id,
        pluginName: plugin.manifest.name,
        items: p.cards,
        deckName: p.deckName,
      });
      return { created: ids.length, ids };
    },
    "cards.listOwn": (p: MethodParams<"cards.listOwn">) => listOwnCards(db, id, p),
    "cards.statsOwn": async (p: MethodParams<"cards.statsOwn">) =>
      (await ownCardsByIds(db, id, p.ids)).map((c) => ({
        id: c.id,
        state: (["novo", "aprendendo", "revisão", "reaprendendo"] as const)[c.state] ?? "novo",
        reps: c.reps,
        lapses: c.lapses,
        lastReview: c.lastReview,
        due: c.due,
      })),
    "cards.updateContent": async (p: MethodParams<"cards.updateContent">) => {
      const [card] = await ownCardsByIds(db, id, [p.id]);
      if (card?.type !== "plugin") {
        throw new RpcFailure("invalid_params", "Card visual deste plugin não encontrado.");
      }
      await setPluginCardContent(db, card.id, p.content);
      return null;
    },
    "cards.proposeUpdate": async (p: MethodParams<"cards.proposeUpdate">) => {
      const own = new Map(
        (
          await ownCardsByIds(
            db,
            id,
            p.changes.map((c) => c.id),
          )
        ).map((c) => [c.id, c]),
      );
      const changes = p.changes.flatMap((c) => {
        const card = own.get(c.id);
        return card ? [{ card, front: c.front, back: c.back }] : [];
      });
      if (changes.length === 0) {
        throw new RpcFailure("invalid_params", "Nenhum dos cards é deste plugin.");
      }
      const updated = await usePluginRequest
        .getState()
        .ask({ kind: "update", pluginName: plugin.manifest.name, changes });
      return { updated };
    },
    "cards.proposeDelete": async (p: MethodParams<"cards.proposeDelete">) => {
      const cards = await ownCardsByIds(db, id, p.ids);
      if (cards.length === 0) {
        throw new RpcFailure("invalid_params", "Nenhum dos cards é deste plugin.");
      }
      const deleted = await usePluginRequest
        .getState()
        .ask({ kind: "delete", pluginName: plugin.manifest.name, cards });
      return { deleted };
    },
    "storage.saveFile": async (p: MethodParams<"storage.saveFile">) => {
      const used = await pluginFilesUsage(db, id);
      if (used + p.data.byteLength > FILES_QUOTA_BYTES) {
        throw new RpcFailure(
          "invalid_params",
          "Espaço do plugin esgotado (100 MB). Apague arquivos antigos.",
        );
      }
      const stored = await deps.database.assets.put(new Blob([p.data], { type: p.mime }));
      await registerPluginFile(db, { ...stored, mime: p.mime, pluginId: id, name: p.name });
      return { fileId: stored.hash };
    },
    "storage.readFile": async (p: MethodParams<"storage.readFile">) => {
      const file = await getPluginFile(db, id, p.fileId);
      const blob = file && (await deps.database.assets.get(file.fileId));
      if (!blob) throw new RpcFailure("invalid_params", "Arquivo não encontrado.");
      return blob.arrayBuffer();
    },
    "storage.listFiles": () => listPluginFiles(db, id),
    "storage.deleteFile": async (p: MethodParams<"storage.deleteFile">) => {
      if (!(await getPluginFile(db, id, p.fileId))) {
        throw new RpcFailure("invalid_params", "Arquivo não encontrado.");
      }
      if (await removePluginFile(db, id, p.fileId)) await deps.database.assets.delete(p.fileId);
      return null;
    },
    "storage.exportFile": async (p: MethodParams<"storage.exportFile">) => {
      const file = await getPluginFile(db, id, p.fileId);
      const blob = file && (await deps.database.assets.get(file.fileId));
      if (!file || !blob) throw new RpcFailure("invalid_params", "Arquivo não encontrado.");
      deliverFile(new Blob([blob], { type: file.mime }), file.name);
      return null;
    },
    "storage.pickFile": async (p: MethodParams<"storage.pickFile">) => {
      const file = await usePluginRequest
        .getState()
        .ask({ kind: "pickFile", pluginName: plugin.manifest.name, accept: p.accept });
      if (!file) return null;
      if (file.size > FILE_MAX_BYTES) {
        throw new RpcFailure("invalid_params", "Arquivo grande demais (máximo de 10 MB).");
      }
      return { name: file.name, mime: file.type, data: await file.arrayBuffer() };
    },
    "highlights.set": async (p: MethodParams<"highlights.set">) => {
      if (!plugin.manifest.contributes.highlights) {
        throw new RpcFailure("invalid_params", "O manifesto não declara contributes.highlights.");
      }
      await pluginStorageSet(db, id, HIGHLIGHTS_KEY, p.rules);
      if (canHighlight(plugin)) useHighlights.getState().set(id, await readRules(db, plugin));
      return null;
    },
    "highlights.get": async () =>
      (await readRules(db, plugin)).map(({ pluginId: _id, pluginName: _name, ...rule }) => rule),
    "highlights.clear": async () => {
      await pluginStorageDelete(db, id, HIGHLIGHTS_KEY);
      useHighlights.getState().set(id, []);
      return null;
    },
    "storage.get": (p: { key: string }) => pluginStorageGet(db, id, reserved(p.key)),
    "storage.set": async (p: { key: string; value: unknown }) => {
      const size = JSON.stringify(p.value ?? null).length;
      if (size > STORAGE_VALUE_MAX) {
        throw new RpcFailure("invalid_params", "Valor grande demais (máximo de 256 KB por chave).");
      }
      await pluginStorageSet(db, id, reserved(p.key), p.value ?? null);
      return null;
    },
    "storage.delete": async (p: { key: string }) => {
      await pluginStorageDelete(db, id, reserved(p.key));
      return null;
    },
    // Chaves reservadas do app (ex.: as regras de destaque) não aparecem para o plugin.
    "storage.keys": async () =>
      (await pluginStorageKeys(db, id)).filter((k) => !k.startsWith("__")),
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

/** Chaves começando com "__" são do app (ex.: regras de destaque): o plugin não as alcança. */
function reserved(key: string): string {
  if (key.startsWith("__")) throw new RpcFailure("invalid_params", "Chaves com __ são reservadas.");
  return key;
}

/** Entrega um arquivo ao usuário (download no computador; no Android, a pasta de downloads). */
function deliverFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
