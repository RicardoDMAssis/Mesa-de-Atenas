/**
 * Kit para escrever plugins do Estudarella. Esconde a troca de mensagens com o app:
 *
 *   import { app } from "@estudarella/plugin-sdk";
 *   const ctx = await app.ready();
 *   const nota = await app.notes.getCurrent();
 *
 * Só tipos vêm de `@estudarella/plugin-api`; nada de validação entra no plugin final.
 */
import type {
  HostMessage,
  MethodName,
  MethodParams,
  PluginContext,
  PluginEvents,
  RpcError,
  ThemePayload,
} from "@estudarella/plugin-api";

const INIT = "estudarella:init";

/** Erro devolvido pelo app (ex.: `forbidden` quando falta permissão). */
export class PluginError extends Error {
  constructor(
    readonly code: RpcError["code"],
    message: string,
  ) {
    super(message);
    this.name = "PluginError";
  }
}

type Listener<T> = (payload: T) => void;

/** Card criado por este plugin, como `cards.listOwn` devolve. */
export interface OwnCard {
  id: string;
  key: string | null;
  deckId: string;
  deckName: string;
  type: "basic" | "cloze" | "plugin";
  front: string;
  back: string;
  content: unknown;
  createdAt: number;
  /** Quando o usuário editou o card pelo app (`null` se nunca). */
  editedAt: number | null;
}

export interface CardStats {
  id: string;
  state: "novo" | "aprendendo" | "revisão" | "reaprendendo";
  reps: number;
  /** Quantas vezes o usuário esqueceu (errou) o card depois de aprender. */
  lapses: number;
  lastReview: number | null;
  due: number;
}

export interface StoredFile {
  fileId: string;
  name: string;
  mime: string;
  size: number;
  createdAt: number;
}

function createClient() {
  let port: MessagePort | undefined;
  let nextId = 1;
  const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  const listeners = new Map<string, Set<Listener<unknown>>>();
  let context: PluginContext | undefined;

  const connected = new Promise<void>((resolve) => {
    addEventListener("message", (event: MessageEvent) => {
      if (event.data?.type !== INIT || !event.ports[0] || port) return;
      port = event.ports[0];
      context = event.data.context as PluginContext | undefined;
      port.onmessage = ({ data }: MessageEvent<HostMessage>) => {
        if (data.type === "response") {
          const waiter = pending.get(data.id);
          pending.delete(data.id);
          if (!waiter) return;
          if (data.ok) waiter.resolve(data.result);
          else waiter.reject(new PluginError(data.error.code, data.error.message));
        } else if (data.type === "event") {
          if (data.event === "context.changed") context = data.payload as PluginContext;
          for (const fn of listeners.get(data.event) ?? []) fn(data.payload);
        }
      };
      resolve();
    });
  });

  async function call<M extends MethodName>(
    method: M,
    ...params: MethodParams<M> extends undefined ? [] : [MethodParams<M>]
  ): Promise<unknown> {
    await connected;
    return new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      port?.postMessage({ type: "request", id, method, params: params[0] });
    });
  }

  function on<E extends keyof PluginEvents>(event: E, fn: Listener<PluginEvents[E]>) {
    const set = listeners.get(event) ?? new Set();
    set.add(fn as Listener<unknown>);
    listeners.set(event, set);
    return () => set.delete(fn as Listener<unknown>);
  }

  /** Aplica as cores do app como variáveis CSS (`--bg`, `--text`, `--accent`…). */
  function applyTheme(theme: ThemePayload) {
    const root = document.documentElement;
    root.dataset.theme = theme.theme;
    root.style.colorScheme = theme.theme;
    for (const [name, value] of Object.entries(theme.tokens)) root.style.setProperty(name, value);
  }

  return {
    /**
     * Espera a conexão com o app, aplica o tema (e acompanha mudanças) e devolve
     * o contexto: onde o plugin está e o que o abriu.
     */
    async ready(): Promise<PluginContext> {
      await connected;
      applyTheme((await call("host.getTheme")) as ThemePayload);
      on("theme.changed", applyTheme);
      return (context ?? (await call("host.getContext"))) as PluginContext;
    },
    /** Contexto atual (atualizado pelo evento `context.changed`). */
    get context() {
      return context;
    },
    on,
    ui: {
      toast: (message: string) => call("ui.toast", { message }) as Promise<void>,
      openPage: () => call("ui.openPage") as Promise<void>,
      closePanel: () => call("ui.closePanel") as Promise<void>,
    },
    notes: {
      getCurrent: () =>
        call("notes.getCurrent") as Promise<{ id: string; title: string; text: string } | null>,
      insertText: (text: string) => call("notes.insertText", { text }) as Promise<void>,
      /**
       * Insere na nota aberta um bloco do plugin: miniatura + rótulo (pede `notes:write` e
       * `contributes.noteEmbed`). Tocar no bloco abre o painel com `context.embed.data`.
       */
      insertEmbed: (embed: MethodParams<"notes.insertEmbed">) =>
        call("notes.insertEmbed", embed) as Promise<void>,
      /**
       * Sugere uma nota nova (pede `notes:create`). O usuário confere, edita, escolhe a matéria e
       * confirma; o app abre a nota criada. Devolve o id, ou `null` se ele cancelar.
       * Texto puro: `## `/`### ` viram títulos, `- ` vira lista, linha em branco separa parágrafos.
       */
      propose: (note: {
        title?: string;
        text: string;
        embed?: MethodParams<"notes.insertEmbed">;
      }) => call("notes.propose", { title: "", ...note }) as Promise<{ noteId: string | null }>,
    },
    files: {
      /** Lê um arquivo da pasta do próprio plugin (ex.: um modelo 3D). */
      read: (path: string) => call("files.read", { path }) as Promise<ArrayBuffer>,
    },
    assets: {
      /** Salva uma imagem (PNG, JPEG ou WebP, até 2 MB; pede `assets:write`) e devolve o id. */
      save: (image: { data: ArrayBuffer; mime: "image/png" | "image/jpeg" | "image/webp" }) =>
        call("assets.save", image) as Promise<{ assetId: string }>,
    },
    mascot: {
      /** O mascote do usuário diz a frase (pede a permissão "mascot"). Sem mascote, nada acontece. */
      say: (message: string, mood: "idle" | "thinking" | "happy" = "idle") =>
        call("mascot.say", { message, mood }) as Promise<{ shown: boolean }>,
    },
    decks: {
      list: () => call("decks.list") as Promise<{ id: string; name: string }[]>,
    },
    cards: {
      /** O app mostra o card ao usuário, que escolhe o baralho e confirma. */
      propose: (card: { front: string; back: string }) =>
        call("cards.propose", card) as Promise<{ created: boolean }>,
      /**
       * Card visual, desenhado pelo plugin na revisão (`contributes.cardRenderer`). A reserva
       * (`fallback`) é obrigatória: aparece na confirmação, na busca e quando o plugin falta.
       */
      proposeVisual: (card: MethodParams<"cards.proposeVisual">) =>
        call("cards.proposeVisual", card) as Promise<{ created: boolean }>,
      /**
       * Vários cards de uma vez (até 200). O usuário escolhe o baralho, marca, edita e confirma;
       * devolve só os ids dos aceitos. Use `key` para o app reconhecer cards que já existem.
       */
      proposeBatch: (batch: MethodParams<"cards.proposeBatch">) =>
        call("cards.proposeBatch", batch) as Promise<{ created: number; ids: string[] }>,
      /** Cards criados por este plugin (pede `cards:own`). Páginas de até 200; use `after`. */
      listOwn: (filter: Partial<MethodParams<"cards.listOwn">> = {}) =>
        call("cards.listOwn", { limit: 200, ...filter }) as Promise<OwnCard[]>,
      /** Desempenho nos próprios cards (só leitura). */
      statsOwn: (ids: string[]) => call("cards.statsOwn", { ids }) as Promise<CardStats[]>,
      /** Troca os dados internos de um card visual próprio, sem pedir (não muda o texto visto). */
      updateContent: (id: string, content: MethodParams<"cards.updateContent">["content"]) =>
        call("cards.updateContent", { id, content }) as Promise<void>,
      /** Sugere mudar frente/verso dos próprios cards; o usuário vê antes e depois e confirma. */
      proposeUpdate: (changes: MethodParams<"cards.proposeUpdate">["changes"]) =>
        call("cards.proposeUpdate", { changes }) as Promise<{ updated: number }>,
      /** Sugere excluir próprios cards; o usuário confirma. */
      proposeDelete: (ids: string[]) =>
        call("cards.proposeDelete", { ids }) as Promise<{ deleted: number }>,
    },
    storage: {
      get: <T = unknown>(key: string) => call("storage.get", { key }) as Promise<T | undefined>,
      set: (key: string, value: unknown) => call("storage.set", { key, value }) as Promise<void>,
      delete: (key: string) => call("storage.delete", { key }) as Promise<void>,
      keys: () => call("storage.keys") as Promise<string[]>,
      /** Guarda um arquivo (até 10 MB; 100 MB por plugin). Tipos em `FILE_MIMES`. */
      saveFile: (file: MethodParams<"storage.saveFile">) =>
        call("storage.saveFile", file) as Promise<{ fileId: string }>,
      readFile: (fileId: string) => call("storage.readFile", { fileId }) as Promise<ArrayBuffer>,
      listFiles: () => call("storage.listFiles") as Promise<StoredFile[]>,
      deleteFile: (fileId: string) => call("storage.deleteFile", { fileId }) as Promise<void>,
      /** Entrega o arquivo ao usuário (download ou compartilhar). */
      exportFile: (fileId: string) => call("storage.exportFile", { fileId }) as Promise<void>,
      /** Pede ao usuário um arquivo; devolve `null` se ele cancelar. */
      pickFile: (accept?: string[]) =>
        call("storage.pickFile", { accept }) as Promise<{
          name: string;
          mime: string;
          data: ArrayBuffer;
        } | null>,
    },
    highlights: {
      /**
       * Substitui as regras de destaque do plugin (pede `notes:highlight` e
       * `contributes.highlights`). O app pinta as palavras em todas as notas, sem mudar o texto.
       */
      set: (rules: MethodParams<"highlights.set">["rules"]) =>
        call("highlights.set", { rules }) as Promise<void>,
      get: () => call("highlights.get") as Promise<MethodParams<"highlights.set">["rules"]>,
      clear: () => call("highlights.clear") as Promise<void>,
    },
  };
}

export const app = createClient();
export type App = typeof app;
