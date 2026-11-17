import type { SqlDriver, Statement } from "./driver";

type Listener = () => void;

/** Avisa quem está exibindo dados de uma tabela quando ela é alterada. */
export class ChangeBus {
  private listeners = new Map<Listener, ReadonlySet<string>>();

  /** `tables` são os nomes no banco (ex.: "notes"). Devolve a função de cancelamento. */
  subscribe(tables: readonly string[], listener: Listener): () => void {
    this.listeners.set(listener, new Set(tables));
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** `"*"` significa "não sei o que mudou": todos são avisados. */
  notify(tables: Iterable<string>): void {
    const changed = new Set(tables);
    if (changed.size === 0) return;
    for (const [listener, watched] of [...this.listeners]) {
      if (changed.has("*") || [...watched].some((t) => changed.has(t))) listener();
    }
  }
}

const WRITE =
  /^\s*(?:insert\s+(?:or\s+\w+\s+)?into|update(?:\s+or\s+\w+)?|delete\s+from)\s+["`]?(\w+)/i;
const READ = /^\s*(?:select|pragma|explain)\b/i;

/** Tabela alterada por uma instrução; `"*"` se alterar algo que não dá para identificar. */
export function writtenTable(sql: string): string | undefined {
  const match = WRITE.exec(sql);
  if (match) return match[1];
  return READ.test(sql) ? undefined : "*";
}

/**
 * Envolve um driver para que toda escrita avise o `ChangeBus` sozinha.
 * Assim nenhuma tela precisa lembrar de "invalidar" nada depois de gravar.
 */
export function trackChanges(driver: SqlDriver, bus: ChangeBus): SqlDriver {
  const tablesOf = (statements: Pick<Statement, "sql">[]) =>
    statements.map((s) => writtenTable(s.sql)).filter((t): t is string => t !== undefined);

  return {
    info: driver.info,
    async query(sql, params, method) {
      const rows = await driver.query(sql, params, method);
      bus.notify(tablesOf([{ sql }]));
      return rows;
    },
    async batch(statements) {
      const results = await driver.batch(statements);
      bus.notify(tablesOf(statements));
      return results;
    },
    async exec(sql) {
      await driver.exec(sql);
      bus.notify(["*"]);
    },
    close: () => driver.close(),
  };
}
