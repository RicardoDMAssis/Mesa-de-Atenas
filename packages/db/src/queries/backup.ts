import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import type { Db } from "../client";
import * as schema from "../schema";

export const BACKUP_FORMAT = "estudarella-backup";
export const BACKUP_VERSION = 1;

// Ordem de inserção: quem é referenciado vem antes de quem referencia.
const TABLES = {
  subjects: schema.subjects,
  notes: schema.notes,
  links: schema.links,
  decks: schema.decks,
  cards: schema.cards,
  review_logs: schema.reviewLogs,
  study_sessions: schema.studySessions,
  assets: schema.assets,
  plugins: schema.plugins,
  plugin_data: schema.pluginData,
  settings: schema.settings,
} as const satisfies Record<string, SQLiteTable>;

type TableName = keyof typeof TABLES;
type Row = Record<string, unknown>;

export interface BackupData {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: number;
  tables: Partial<Record<TableName, Row[]>>;
}

/** Copia todas as tabelas, inclusive registros excluídos (necessários para o sync). */
export async function exportData(db: Db): Promise<BackupData> {
  const tables: Partial<Record<TableName, Row[]>> = {};
  for (const [name, table] of Object.entries(TABLES)) {
    tables[name as TableName] = (await db.select().from(table)) as Row[];
  }
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: Date.now(), tables };
}

export function isBackupData(value: unknown): value is BackupData {
  const v = value as Partial<BackupData> | null;
  return (
    typeof v === "object" &&
    v !== null &&
    v.format === BACKUP_FORMAT &&
    typeof v.version === "number" &&
    typeof v.tables === "object" &&
    v.tables !== null
  );
}

/** Pais antes dos filhos, para respeitar a referência de `parent_id`. */
function parentsFirst(rows: Row[]): Row[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const done = new Set<unknown>();
  const out: Row[] = [];
  const visit = (row: Row) => {
    if (done.has(row.id)) return;
    done.add(row.id);
    const parent = byId.get(row.parentId);
    if (parent) visit(parent);
    out.push(row);
  };
  rows.forEach(visit);
  return out;
}

const chunk = <T>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, (i + 1) * size),
  );

/**
 * Substitui todo o conteúdo do banco pelo do backup, em um único lote:
 * se algo falhar, o banco fica exatamente como estava.
 */
export async function importData(db: Db, data: BackupData): Promise<void> {
  if (!isBackupData(data)) throw new Error("Este arquivo não é um backup do Estudarella.");
  if (data.version > BACKUP_VERSION) {
    throw new Error("Este backup foi feito por uma versão mais nova do app.");
  }
  const names = Object.keys(TABLES) as TableName[];
  const deletes = [...names].reverse().map((name) => db.delete(TABLES[name]));
  const inserts = names.flatMap((name) => {
    const rows = data.tables[name] ?? [];
    const ordered = name === "subjects" ? parentsFirst(rows) : rows;
    // Lotes pequenos para ficar bem abaixo do limite de parâmetros do SQLite.
    return chunk(ordered, 50).map((part) => db.insert(TABLES[name]).values(part as never));
  });
  const [first, ...rest] = [...deletes, ...inserts];
  if (first) await db.batch([first, ...rest]);
}
