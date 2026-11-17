import { DatabaseSync } from "node:sqlite";
import type { SqlDriver } from "./driver";

/** Driver para testes: o SQLite embutido no Node, em memória. */
export function nodeDriver(): SqlDriver {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  const run = (sql: string, params: unknown[]) => {
    const statement = db.prepare(sql);
    statement.setReturnArrays(true);
    return statement.all(...(params as never[])) as unknown as unknown[][];
  };
  return {
    info: { backend: "node:sqlite", sqliteVersion: "test", persistent: false },
    async query(sql, params) {
      return run(sql, params);
    },
    async batch(statements) {
      db.exec("BEGIN");
      try {
        const results = statements.map((s) => run(s.sql, s.params));
        db.exec("COMMIT");
        return results;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
    async exec(sql) {
      db.exec(sql);
    },
    async close() {
      db.close();
    },
  };
}
