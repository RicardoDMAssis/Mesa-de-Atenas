import type { SqlDriver } from "./driver";

export interface Migration {
  /** Nome do arquivo gerado pelo drizzle-kit, sem extensão (ex.: "0000_inicial"). */
  id: string;
  sql: string;
}

const BREAKPOINT = "--> statement-breakpoint";

/**
 * Aplica, em ordem, as migrações ainda não registradas. Cada uma roda em um
 * lote atômico: ou entra inteira, ou o banco fica como estava.
 * Devolve os ids aplicados nesta chamada.
 */
export async function migrate(driver: SqlDriver, migrations: Migration[]): Promise<string[]> {
  await driver.exec(
    "CREATE TABLE IF NOT EXISTS __migrations (id TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)",
  );
  const rows = await driver.query("SELECT id FROM __migrations", [], "all");
  const done = new Set(rows.map((r) => String(r[0])));

  const applied: string[] = [];
  for (const m of [...migrations].sort((a, b) => a.id.localeCompare(b.id))) {
    if (done.has(m.id)) continue;
    const statements = m.sql
      .split(BREAKPOINT)
      .filter((sql) => sql.trim())
      .map((sql) => ({ sql, params: [] as unknown[], method: "run" as const }));
    statements.push({
      sql: "INSERT INTO __migrations (id, applied_at) VALUES (?, ?)",
      params: [m.id, Date.now()],
      method: "run",
    });
    try {
      await driver.batch(statements);
    } catch (error) {
      throw new Error(`Falha na migração ${m.id}: ${String(error)}`, { cause: error });
    }
    applied.push(m.id);
  }
  return applied;
}
