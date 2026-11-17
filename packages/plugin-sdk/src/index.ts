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
    },
    decks: {
      list: () => call("decks.list") as Promise<{ id: string; name: string }[]>,
    },
    cards: {
      /** O app mostra o card ao usuário, que escolhe o baralho e confirma. */
      propose: (card: { front: string; back: string }) =>
        call("cards.propose", card) as Promise<{ created: boolean }>,
    },
    storage: {
      get: <T = unknown>(key: string) => call("storage.get", { key }) as Promise<T | undefined>,
      set: (key: string, value: unknown) => call("storage.set", { key, value }) as Promise<void>,
      delete: (key: string) => call("storage.delete", { key }) as Promise<void>,
      keys: () => call("storage.keys") as Promise<string[]>,
    },
  };
}

export const app = createClient();
export type App = typeof app;
