import { z } from "zod";
import type { Permission } from "./manifest";

/** O que cada permissão libera, em linguagem de usuário (mostrado ao ativar o plugin). */
export const PERMISSION_LABELS: Record<Permission, string> = {
  "notes:read": "Ler a nota aberta e o texto selecionado",
  "notes:write": "Inserir texto na nota aberta",
  "cards:read": "Ver a lista de baralhos",
  "cards:write": "Criar flashcards (você confirma cada um)",
  "assets:write": "Salvar imagens e arquivos",
  storage: "Guardar os próprios dados neste aparelho",
  ai: "Usar a inteligência artificial do app",
};

/** Onde o plugin está sendo exibido. */
export const SURFACES = ["page", "panel", "settings", "widget"] as const;
export type Surface = (typeof SURFACES)[number];

const text = z.string().max(20_000);

/**
 * Métodos que o plugin pode chamar, com o formato dos parâmetros e a permissão
 * exigida. O app recusa chamadas a métodos fora desta lista ou sem a permissão
 * concedida pelo usuário — a verificação é sempre do lado do app.
 */
export const METHODS = {
  /** Cores e modo do tema atual. */
  "host.getTheme": { permission: null, params: z.undefined() },
  /** Onde o plugin está e o que o abriu (comando, palavra selecionada…). */
  "host.getContext": { permission: null, params: z.undefined() },
  /** Mostra um aviso curto na tela. */
  "ui.toast": { permission: null, params: z.object({ message: z.string().min(1).max(200) }) },
  /** Abre a tela própria do plugin. */
  "ui.openPage": { permission: null, params: z.undefined() },
  /** Fecha o painel do plugin. */
  "ui.closePanel": { permission: null, params: z.undefined() },

  /** Nota aberta: id, título e texto. `null` se nenhuma nota estiver aberta. */
  "notes.getCurrent": { permission: "notes:read", params: z.undefined() },
  /** Insere texto na posição do cursor da nota aberta. */
  "notes.insertText": { permission: "notes:write", params: z.object({ text: text.min(1) }) },

  /** Lista de baralhos (id e nome). */
  "decks.list": { permission: "cards:read", params: z.undefined() },
  /** Propõe um card: o app mostra a frente e o verso e o usuário escolhe o baralho e confirma. */
  "cards.propose": {
    permission: "cards:write",
    params: z.object({ front: text.min(1).max(2000), back: text.min(1).max(5000) }),
  },

  "storage.get": { permission: "storage", params: z.object({ key: z.string().min(1).max(200) }) },
  "storage.set": {
    permission: "storage",
    params: z.object({ key: z.string().min(1).max(200), value: z.unknown() }),
  },
  "storage.delete": {
    permission: "storage",
    params: z.object({ key: z.string().min(1).max(200) }),
  },
  "storage.keys": { permission: "storage", params: z.undefined() },
} as const satisfies Record<string, { permission: Permission | null; params: z.ZodType }>;

export type MethodName = keyof typeof METHODS;
export type MethodParams<M extends MethodName> = z.infer<(typeof METHODS)[M]["params"]>;

/** Eventos que o app envia ao plugin. */
export interface PluginEvents {
  "theme.changed": ThemePayload;
  /** Contexto mudou (ex.: outra palavra selecionada com o painel aberto). */
  "context.changed": PluginContext;
}

export interface ThemePayload {
  theme: "light" | "dark";
  tokens: Record<string, string>;
}

export interface PluginContext {
  surface: Surface;
  /** Comando que abriu o painel, se houver. */
  command?: { id: string; selection: string };
  note?: { id: string; title: string } | null;
  /** Qual widget (superfície `widget`) e o tamanho do quadro. */
  widget?: { id: string; size: "small" | "medium" | "large" };
}

/** Limite de tamanho de um valor guardado por `storage.set` (JSON). */
export const STORAGE_VALUE_MAX = 256 * 1024;
