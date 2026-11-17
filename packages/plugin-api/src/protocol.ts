import { z } from "zod";

/**
 * Mensagem de `window.postMessage` com que o app entrega ao plugin a porta do
 * canal privado. Depois dela, toda a conversa acontece pela `MessagePort`.
 */
export const INIT_MESSAGE_TYPE = "estudarella:init";

export interface RpcError {
  code: "unknown_method" | "forbidden" | "invalid_params" | "internal";
  message: string;
}

/** Mensagens que o plugin envia. Nunca confie nelas sem passar por este schema. */
export const pluginMessageSchema = z.object({
  type: z.literal("request"),
  id: z.number().int().nonnegative(),
  method: z.string().min(1).max(64),
  params: z.unknown().optional(),
});

export type PluginMessage = z.infer<typeof pluginMessageSchema>;

/** Mensagens que o app envia ao plugin. */
export type HostMessage =
  | { type: "response"; id: number; ok: true; result: unknown }
  | { type: "response"; id: number; ok: false; error: RpcError }
  | { type: "event"; event: string; payload: unknown };
