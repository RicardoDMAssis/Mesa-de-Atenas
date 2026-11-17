import { drizzle } from "drizzle-orm/sqlite-proxy";
import { ChangeBus, trackChanges } from "./changes";
import type { QueryMethod, SqlDriver } from "./driver";
import { migrate } from "./migrate";
import { migrations } from "./migrations.generated";
import * as schema from "./schema";

export type Db = ReturnType<typeof createDb>;

// No método "get" o Drizzle espera uma única linha (ou nada).
const shape = (rows: unknown[][], method: QueryMethod) => ({
  rows: (method === "get" ? rows[0] : rows) as unknown[],
});

/**
 * Liga o Drizzle a um driver de plataforma.
 *
 * Para gravar várias coisas de forma atômica use `db.batch([...])`.
 * Não use `db.transaction()`: ela faria BEGIN/COMMIT em chamadas separadas, e
 * consultas de outras telas poderiam cair dentro da transação.
 */
export function createDb(driver: SqlDriver) {
  return drizzle(
    async (sql, params, method) => shape(await driver.query(sql, params, method), method),
    async (queries) => {
      const results = await driver.batch(queries);
      return queries.map((q, i) => shape(results[i] ?? [], q.method));
    },
    { schema },
  );
}

export interface OpenedDb {
  db: Db;
  /** Migrações aplicadas nesta abertura (vazio quando o banco já estava em dia). */
  applied: string[];
  /** Avisos de alteração por tabela, alimentados automaticamente por toda escrita. */
  changes: ChangeBus;
}

/** Abre o banco já migrado para a versão atual do schema. */
export async function openDb(driver: SqlDriver): Promise<OpenedDb> {
  const applied = await migrate(driver, migrations);
  const changes = new ChangeBus();
  return { db: createDb(trackChanges(driver, changes)), applied, changes };
}
