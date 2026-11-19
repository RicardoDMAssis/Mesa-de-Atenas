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
  mascot: "Falar pelo seu mascote",
  "cards:own":
    "Ver os cards que este plugin criou e o seu desempenho neles, e sugerir correções ou exclusões (você confirma)",
  "notes:highlight": "Destacar palavras nas notas (sem alterar o texto)",
  "notes:create": "Criar notas novas (você confere e confirma cada uma)",
};

/** Onde o plugin está sendo exibido. */
export const SURFACES = ["page", "panel", "settings", "widget", "card"] as const;
export type Surface = (typeof SURFACES)[number];

const text = z.string().max(20_000);

/** Tamanho máximo do texto de uma nota sugerida por plugin. */
export const NOTE_TEXT_MAX = 100_000;

/** Dados próprios do plugin guardados pelo app (card visual, bloco na nota). Até 16 KB em JSON. */
export const PLUGIN_DATA_MAX = 16 * 1024;
const pluginData = z
  .unknown()
  .refine((v) => v !== undefined, "obrigatório")
  .refine((v) => {
    try {
      return JSON.stringify(v).length <= PLUGIN_DATA_MAX;
    } catch {
      return false;
    }
  }, "grande demais (máximo de 16 KB)");

/** Imagens que um plugin pode salvar, e o tamanho máximo de cada uma. */
export const ASSET_MIMES = ["image/png", "image/jpeg", "image/webp"] as const;
export const ASSET_MAX_BYTES = 2 * 1024 * 1024;

/** Id de uma imagem salva (o hash SHA-256 do conteúdo, em hexadecimal). */
const assetId = z.string().regex(/^[0-9a-f]{64}$/);

// ---------- cards em lote e próprios cards (Fase 4.1) ----------

/** Máximo de cards num lote (criar, atualizar ou excluir). */
export const BATCH_MAX = 200;

/** Chave do plugin para achar um card depois (ex.: "etanol"), única por plugin. */
const cardKey = z.string().min(1).max(120);
const cardId = z.string().min(1).max(64);

const basicItem = z.object({
  front: text.min(1).max(2000),
  back: text.min(1).max(5000),
  key: cardKey.optional(),
});
const clozeItem = z.object({
  /** Texto com lacunas `{{c1::...}}`; cada número vira um card. */
  cloze: text.min(1).max(5000),
  key: cardKey.optional(),
});
const visualItem = z.object({
  content: pluginData,
  fallback: z.object({
    front: text.min(1).max(2000),
    back: text.min(1).max(5000),
    image: assetId.optional(),
  }),
  key: cardKey.optional(),
});
export const batchCardItem = z.union([visualItem, clozeItem, basicItem]);
export type BatchCardItem = z.infer<typeof batchCardItem>;

// ---------- arquivos (Fase 4.1) ----------

/** Tipos de arquivo que um plugin pode guardar. Nunca HTML nem scripts. */
export const FILE_MIMES = [
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/json",
  "application/xml",
  "chemical/x-mdl-molfile",
  "chemical/x-pdb",
  "model/gltf-binary",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "application/octet-stream",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const FILE_MAX_BYTES = 10 * 1024 * 1024;
export const FILES_QUOTA_BYTES = 100 * 1024 * 1024;
const fileId = assetId;

// ---------- destaques (Fase 4.1, plano da Fase 3.1) ----------

/** Cores dos destaques: só a paleta do tema (versões para claro e escuro feitas pelo app). */
export const HIGHLIGHT_COLORS = [
  "purple",
  "pink",
  "green",
  "orange",
  "blue",
  "cyan",
  "brown",
  "gray",
] as const;
export const HIGHLIGHT_STYLES = ["marker", "text", "underline", "formula"] as const;
export const HIGHLIGHT_RULES_MAX = 500;

export const highlightRule = z.object({
  /** Palavra ou expressão (casa palavra inteira, sem diferenciar maiúsculas). */
  term: z.string().trim().min(1).max(60),
  color: z.enum(HIGHLIGHT_COLORS).default("purple"),
  /** `formula`: números como subscrito e cargas como sobrescrito (ex.: H2SO4 → H₂SO₄). */
  style: z.enum(HIGHLIGHT_STYLES).default("marker"),
  /** Explicação curta, mostrada ao tocar e segurar (e para leitores de tela). */
  label: z.string().max(80).optional(),
  /** Comando do próprio plugin aberto ao tocar na palavra. */
  command: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-.]{0,63}$/)
    .optional(),
  ignoreAccents: z.boolean().default(true),
});
export type HighlightRule = z.infer<typeof highlightRule>;

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

  /** Insere um bloco do plugin na nota aberta (miniatura + rótulo). Só em modo edição. */
  "notes.insertEmbed": {
    permission: "notes:write",
    params: z.object({
      data: pluginData,
      label: z.string().min(1).max(120),
      thumbnail: assetId.optional(),
    }),
  },

  /**
   * Sugere uma nota nova. O usuário vê, edita, escolhe a matéria e confirma. O texto é puro,
   * com marcações simples por linha: `## ` e `### ` (títulos), `- ` (lista); linha em branco
   * separa parágrafos. `embed` (opcional, pede `contributes.noteEmbed`) entra no topo da nota.
   */
  "notes.propose": {
    permission: "notes:create",
    params: z.object({
      title: z.string().trim().max(200).default(""),
      text: z.string().max(NOTE_TEXT_MAX),
      embed: z
        .object({
          data: pluginData,
          label: z.string().min(1).max(120),
          thumbnail: assetId.optional(),
        })
        .optional(),
    }),
  },

  /** Lê um arquivo da pasta do próprio plugin (ex.: um modelo 3D). */
  "files.read": { permission: null, params: z.object({ path: z.string().min(1).max(200) }) },

  /** Salva uma imagem (PNG, JPEG ou WebP, até 2 MB) e devolve o id para usar em cards e blocos. */
  "assets.save": {
    permission: "assets:write",
    params: z.object({
      data: z.instanceof(ArrayBuffer).refine((b) => b.byteLength <= ASSET_MAX_BYTES, "até 2 MB"),
      mime: z.enum(ASSET_MIMES),
    }),
  },

  /** Lista de baralhos (id e nome). */
  "decks.list": { permission: "cards:read", params: z.undefined() },
  /** Propõe um card: o app mostra a frente e o verso e o usuário escolhe o baralho e confirma. */
  "cards.propose": {
    permission: "cards:write",
    params: z.object({ front: text.min(1).max(2000), back: text.min(1).max(5000) }),
  },
  /**
   * Propõe um card visual: a frente e o verso são desenhados pelo plugin na revisão
   * (`contributes.cardRenderer`). A reserva (`fallback`) é obrigatória: é o que aparece na
   * confirmação, na busca e quando o plugin não está disponível.
   */
  "cards.proposeVisual": {
    permission: "cards:write",
    params: z.object({
      content: pluginData,
      fallback: z.object({
        front: text.min(1).max(2000),
        back: text.min(1).max(5000),
        image: assetId.optional(),
      }),
    }),
  },

  /**
   * Propõe vários cards de uma vez. O app mostra a lista; o usuário escolhe o baralho, marca,
   * edita e confirma. Devolve só os ids dos cards aceitos.
   */
  "cards.proposeBatch": {
    permission: "cards:write",
    params: z.object({
      cards: z.array(batchCardItem).min(1).max(BATCH_MAX),
      /** Nome sugerido se o usuário quiser criar um baralho novo. */
      deckName: z.string().trim().min(1).max(80).optional(),
    }),
  },

  /** Cards criados por este plugin (páginas de até 200). */
  "cards.listOwn": {
    permission: "cards:own",
    params: z
      .object({
        deckId: cardId.optional(),
        key: cardKey.optional(),
        /** Continua depois deste id (o último da página anterior). */
        after: cardId.optional(),
        limit: z.number().int().min(1).max(BATCH_MAX).default(BATCH_MAX),
      })
      .default({ limit: BATCH_MAX }),
  },
  /** Desempenho nos próprios cards (só leitura). */
  "cards.statsOwn": {
    permission: "cards:own",
    params: z.object({ ids: z.array(cardId).min(1).max(BATCH_MAX) }),
  },
  /** Troca o `content` de um card visual próprio (dado interno do plugin). Sem confirmação. */
  "cards.updateContent": {
    permission: "cards:own",
    params: z.object({ id: cardId, content: pluginData }),
  },
  /** Sugere mudar o texto que o usuário vê; o app mostra antes/depois e ele confirma. */
  "cards.proposeUpdate": {
    permission: "cards:own",
    params: z.object({
      changes: z
        .array(
          z.object({
            id: cardId,
            front: text.min(1).max(2000).optional(),
            back: text.min(1).max(5000).optional(),
          }),
        )
        .min(1)
        .max(BATCH_MAX),
    }),
  },
  /** Sugere excluir cards próprios; o usuário confirma. */
  "cards.proposeDelete": {
    permission: "cards:own",
    params: z.object({ ids: z.array(cardId).min(1).max(BATCH_MAX) }),
  },

  /** O mascote do usuário diz uma frase (com o nome do plugin junto). */
  "mascot.say": {
    permission: "mascot",
    params: z.object({
      message: z.string().min(1).max(280),
      mood: z.enum(["idle", "thinking", "happy"]).default("idle"),
    }),
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

  /** Guarda um arquivo (até 10 MB; 100 MB por plugin) e devolve o id. */
  "storage.saveFile": {
    permission: "storage",
    params: z.object({
      name: z.string().trim().min(1).max(120),
      mime: z.enum(FILE_MIMES),
      data: z.instanceof(ArrayBuffer).refine((b) => b.byteLength <= FILE_MAX_BYTES, "até 10 MB"),
    }),
  },
  "storage.readFile": { permission: "storage", params: z.object({ fileId }) },
  "storage.listFiles": { permission: "storage", params: z.undefined() },
  "storage.deleteFile": { permission: "storage", params: z.object({ fileId }) },
  /** Entrega o arquivo ao usuário (download no computador, compartilhar no Android). */
  "storage.exportFile": { permission: "storage", params: z.object({ fileId }) },
  /** Abre o seletor de arquivos; o plugin recebe só o arquivo que o usuário escolher. */
  "storage.pickFile": {
    permission: "storage",
    params: z.object({ accept: z.array(z.string().max(80)).max(20).optional() }).default({}),
  },

  /** Substitui todas as regras de destaque do plugin. */
  "highlights.set": {
    permission: "notes:highlight",
    params: z.object({ rules: z.array(highlightRule).max(HIGHLIGHT_RULES_MAX) }),
  },
  "highlights.get": { permission: "notes:highlight", params: z.undefined() },
  "highlights.clear": { permission: "notes:highlight", params: z.undefined() },
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
  /** Card visual sendo revisado (superfície `card`): os dados do plugin e o lado mostrado. */
  card?: { content: unknown; side: "front" | "back" };
  /** Bloco do plugin tocado na nota (painel aberto a partir dele). */
  embed?: { data: unknown };
}

/** Limite de tamanho de um valor guardado por `storage.set` (JSON). */
export const STORAGE_VALUE_MAX = 256 * 1024;
