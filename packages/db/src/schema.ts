import {
  type AnySQLiteColumn,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { v7 as uuidv7 } from "uuid";

export const newId = (): string => uuidv7();

/**
 * Colunas presentes em todas as tabelas. Preparam o sync entre dispositivos:
 * id gerado no cliente, carimbo de alteração e exclusão lógica (nunca DELETE).
 * Datas são inteiros em milissegundos (epoch).
 */
const syncColumns = {
  id: text("id").primaryKey().$defaultFn(newId),
  createdAt: integer("created_at")
    .notNull()
    .$defaultFn(() => Date.now()),
  updatedAt: integer("updated_at")
    .notNull()
    .$defaultFn(() => Date.now())
    .$onUpdateFn(() => Date.now()),
  deletedAt: integer("deleted_at"),
};

/** Árvore matéria > tópico > subtópico. */
export const subjects = sqliteTable(
  "subjects",
  {
    ...syncColumns,
    parentId: text("parent_id").references((): AnySQLiteColumn => subjects.id),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    tags: text("tags", { mode: "json" }).$type<string[]>().notNull().default([]),
  },
  (t) => [index("subjects_parent_idx").on(t.parentId)],
);

export const notes = sqliteTable(
  "notes",
  {
    ...syncColumns,
    subjectId: text("subject_id").references(() => subjects.id),
    title: text("title").notNull().default(""),
    /** Documento do editor (JSON do TipTap). */
    content: text("content", { mode: "json" }).$type<unknown>(),
    /** Texto sem formatação, para busca. */
    plainText: text("plain_text").notNull().default(""),
  },
  (t) => [index("notes_subject_idx").on(t.subjectId)],
);

/** Arestas do grafo: links [[...]] e embeds de plugin, extraídos ao salvar a nota. */
export const links = sqliteTable(
  "links",
  {
    ...syncColumns,
    sourceNoteId: text("source_note_id")
      .notNull()
      .references(() => notes.id),
    targetNoteId: text("target_note_id")
      .notNull()
      .references(() => notes.id),
    kind: text("kind", { enum: ["link", "embed"] })
      .notNull()
      .default("link"),
  },
  (t) => [
    index("links_source_idx").on(t.sourceNoteId),
    index("links_target_idx").on(t.targetNoteId),
  ],
);

/** Como o baralho agenda as revisões. */
export interface DeckSettings {
  /** "auto" = FSRS; "custom" = intervalos definidos pelo usuário. */
  mode: "auto" | "custom";
  /** Minutos por resposta e crescimento a cada acerto (ver `CustomIntervals` no core). */
  intervals?: { again: number; hard: number; good: number; easy: number; growth: number };
}

export const decks = sqliteTable("decks", {
  ...syncColumns,
  subjectId: text("subject_id").references(() => subjects.id),
  name: text("name").notNull(),
  settings: text("settings", { mode: "json" })
    .$type<DeckSettings>()
    .notNull()
    .default({ mode: "auto" }),
});

export const cards = sqliteTable(
  "cards",
  {
    ...syncColumns,
    deckId: text("deck_id")
      .notNull()
      .references(() => decks.id),
    noteId: text("note_id").references(() => notes.id),
    type: text("type", { enum: ["basic", "cloze", "plugin"] }).notNull(),
    /** Conteúdo do card. Em cards de plugin, só o plugin sabe interpretar. */
    content: text("content", { mode: "json" }).$type<unknown>().notNull(),
    pluginId: text("plugin_id"),
    /** Versão estática (texto + imagem) usada quando o plugin não está disponível. */
    fallback: text("fallback", { mode: "json" }).$type<{
      front: string;
      back: string;
      imageAssetId?: string;
    }>(),

    // Agendamento. `srs` é o estado interno do algoritmo (FSRS), guardado como veio:
    // só `packages/core/srs` sabe interpretá-lo. As colunas abaixo são cópias usadas
    // para consultar e exibir.
    srs: text("srs", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
    due: integer("due").notNull(),
    /** 0 novo, 1 aprendendo, 2 revisão, 3 reaprendendo. */
    state: integer("state").notNull().default(0),
    reps: integer("reps").notNull().default(0),
    lapses: integer("lapses").notNull().default(0),
    lastReview: integer("last_review"),

    /** Plugin que criou o card (pode ser diferente de `plugin_id`, que é quem o desenha). */
    originPluginId: text("origin_plugin_id"),
    /** Chave dada pelo plugin para achar o card depois (ex.: "etanol"). */
    originKey: text("origin_key"),
    /** Última vez que o usuário editou o texto do card pelo app. */
    editedAt: integer("edited_at"),
  },
  (t) => [
    index("cards_deck_due_idx").on(t.deckId, t.due),
    index("cards_origin_idx").on(t.originPluginId, t.originKey),
  ],
);

/** Uma linha por resposta. Necessário para otimizar os parâmetros do FSRS. */
export const reviewLogs = sqliteTable(
  "review_logs",
  {
    ...syncColumns,
    cardId: text("card_id")
      .notNull()
      .references(() => cards.id),
    rating: integer("rating").notNull(),
    /** Estado do card antes desta resposta. */
    state: integer("state").notNull(),
    reviewedAt: integer("reviewed_at").notNull(),
    durationMs: integer("duration_ms"),
    /** Registro completo gerado pelo algoritmo, para otimizar parâmetros depois. */
    data: text("data", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
  },
  (t) => [
    index("review_logs_card_idx").on(t.cardId),
    index("review_logs_reviewed_idx").on(t.reviewedAt),
  ],
);

/** Pomodoros e sessões de revisão — base do streak e do progresso diário. */
export const studySessions = sqliteTable(
  "study_sessions",
  {
    ...syncColumns,
    kind: text("kind", { enum: ["focus", "review"] }).notNull(),
    startedAt: integer("started_at").notNull(),
    endedAt: integer("ended_at"),
    subjectId: text("subject_id").references(() => subjects.id),
    deckId: text("deck_id").references(() => decks.id),
  },
  (t) => [index("study_sessions_started_idx").on(t.startedAt)],
);

export const assets = sqliteTable(
  "assets",
  {
    ...syncColumns,
    hash: text("hash").notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    /** Plugin que criou o arquivo, se houver. */
    pluginId: text("plugin_id"),
    /** Nome dado pelo plugin a um arquivo guardado (`storage.saveFile`); imagens não têm. */
    name: text("name"),
  },
  (t) => [index("assets_hash_idx").on(t.hash)],
);

export const plugins = sqliteTable(
  "plugins",
  {
    ...syncColumns,
    pluginId: text("plugin_id").notNull(),
    version: text("version").notNull(),
    manifest: text("manifest", { mode: "json" }).$type<unknown>().notNull(),
    grantedPermissions: text("granted_permissions", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default([]),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    /** De onde veio: com o app, de um arquivo .zip ou de um link. */
    source: text("source", { enum: ["builtin", "file", "link"] })
      .notNull()
      .default("builtin"),
    /** Endereço de onde foi baixado (origem "link"). */
    sourceUrl: text("source_url"),
  },
  (t) => [uniqueIndex("plugins_plugin_id_uq").on(t.pluginId)],
);

/** Armazenamento chave-valor isolado por plugin. */
export const pluginData = sqliteTable(
  "plugin_data",
  {
    ...syncColumns,
    pluginId: text("plugin_id").notNull(),
    key: text("key").notNull(),
    value: text("value", { mode: "json" }).$type<unknown>(),
  },
  (t) => [uniqueIndex("plugin_data_key_uq").on(t.pluginId, t.key)],
);

export const settings = sqliteTable(
  "settings",
  {
    ...syncColumns,
    key: text("key").notNull(),
    value: text("value", { mode: "json" }).$type<unknown>(),
  },
  (t) => [uniqueIndex("settings_key_uq").on(t.key)],
);
