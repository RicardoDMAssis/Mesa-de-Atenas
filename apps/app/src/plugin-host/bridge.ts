import {
  API_VERSION,
  type HostMessage,
  INIT_MESSAGE_TYPE,
  pluginMessageSchema,
  type RpcError,
} from "@estudarella/plugin-api";

export type RpcHandler = (params: unknown) => unknown | Promise<unknown>;

/** Erro que um handler lança para devolver ao plugin um código específico. */
export class RpcFailure extends Error {
  constructor(
    readonly code: RpcError["code"],
    message: string,
  ) {
    super(message);
  }
}

export interface PluginConnection {
  /** Envia um evento do app para o plugin. */
  emit(event: string, payload: unknown): void;
  dispose(): void;
}

/**
 * Abre o canal privado com um iframe de plugin já carregado.
 *
 * O plugin só alcança os métodos que `getHandlers()` devolver: é aqui, no app, que
 * a lista de métodos (e depois as permissões) é aplicada — nunca no código do plugin.
 * Os handlers são lidos a cada chamada, então mudanças de estado do app valem na hora.
 */
export function connectPlugin(
  iframe: HTMLIFrameElement,
  getHandlers: () => Readonly<Record<string, RpcHandler>>,
): PluginConnection {
  const { port1, port2 } = new MessageChannel();
  const send = (message: HostMessage, transfer: Transferable[] = []) =>
    port1.postMessage(message, transfer);

  port1.onmessage = async (event) => {
    const parsed = pluginMessageSchema.safeParse(event.data);
    if (!parsed.success) return; // Mensagem fora do protocolo: ignorada.
    const { id, method, params } = parsed.data;

    const handlers = getHandlers();
    const handler = Object.hasOwn(handlers, method) ? handlers[method] : undefined;
    if (!handler) {
      send({
        type: "response",
        id,
        ok: false,
        error: { code: "unknown_method", message: `Método desconhecido: ${method}` },
      });
      return;
    }
    try {
      const result = await handler(params);
      // Arquivos vão por transferência (sem cópia): importante para modelos grandes.
      send(
        { type: "response", id, ok: true, result },
        result instanceof ArrayBuffer ? [result] : [],
      );
    } catch (error) {
      const failure =
        error instanceof RpcFailure
          ? { code: error.code, message: error.message }
          : // Detalhes de erros internos não vazam para o plugin.
            { code: "internal" as const, message: "Erro interno do app." };
      if (!(error instanceof RpcFailure)) console.error(`[plugin] ${method}`, error);
      send({ type: "response", id, ok: false, error: failure });
    }
  };

  // O iframe tem origem opaca, então o destino precisa ser "*". A porta transferida
  // é o que torna o canal privado: só este iframe a recebe.
  iframe.contentWindow?.postMessage({ type: INIT_MESSAGE_TYPE, apiVersion: API_VERSION }, "*", [
    port2,
  ]);

  return {
    emit: (event, payload) => send({ type: "event", event, payload }),
    dispose: () => port1.close(),
  };
}
