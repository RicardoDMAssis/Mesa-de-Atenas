import { eq, isNull, type SQL } from "drizzle-orm";
import type { AnySQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
import type { Db } from "../client";

type SyncTable = SQLiteTable & {
  id: AnySQLiteColumn;
  updatedAt: AnySQLiteColumn;
  deletedAt: AnySQLiteColumn;
};

/**
 * Filtro "não excluído". Toda leitura de dados do usuário deve incluí-lo:
 * excluir é marcar `deleted_at`, e a linha continua no banco para o sync.
 */
export const active = (table: { deletedAt: AnySQLiteColumn }): SQL => isNull(table.deletedAt);

/**
 * Exclusão lógica.
 *
 * Grava na hora (não precisa de `await` para executar).
 */
export async function softDelete(db: Db, table: SyncTable, id: string): Promise<void> {
  const now = Date.now();
  await db
    .update(table)
    .set({ deletedAt: now, updatedAt: now } as never)
    .where(eq(table.id, id));
}
