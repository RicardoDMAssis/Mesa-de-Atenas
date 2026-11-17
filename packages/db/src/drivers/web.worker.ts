// Roda em um Web Worker: o SQLite (WASM) fica fora da thread da interface e
// persiste no OPFS (sistema de arquivos privado da origem), que só oferece
// acesso síncrono dentro de workers.
import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import {
  dbLockName,
  type OpenResult,
  type WorkerRequest,
  type WorkerResponse,
} from "./web-protocol";

// A tipagem do pacote não cobre toda a API usada aqui (pool OPFS).
// biome-ignore lint/suspicious/noExplicitAny: API externa sem tipos completos
type Sqlite = any;

let db: Sqlite | undefined;

class BusyError extends Error {}

/** Segura um lock exclusivo enquanto o worker viver: uma aba por vez. */
function acquireLock(name: string): Promise<boolean> {
  if (!navigator.locks) return Promise.resolve(true);
  return new Promise((resolve) => {
    navigator.locks.request(dbLockName(name), { ifAvailable: true }, (lock) => {
      resolve(lock !== null);
      // Promise que nunca resolve: o lock só é liberado quando o worker termina.
      return lock ? new Promise<void>(() => {}) : undefined;
    });
  });
}

async function open(name: string): Promise<OpenResult> {
  const sqlite3: Sqlite = await sqlite3InitModule();
  const base = { backend: "sqlite-wasm", sqliteVersion: String(sqlite3.version.libVersion) };

  const hasOpfs = typeof navigator.storage?.getDirectory === "function";
  if (!hasOpfs) {
    db = new sqlite3.oo1.DB(":memory:");
    db.exec("PRAGMA foreign_keys = ON");
    return {
      ...base,
      persistent: false,
      reason: "Este navegador não oferece armazenamento OPFS (ou a página não está em HTTPS).",
    };
  }

  if (!(await acquireLock(name))) throw new BusyError();

  const pool = await sqlite3.installOpfsSAHPoolVfs({ name: `estudarella-${name}` });
  db = new pool.OpfsSAHPoolDb(`/${name}.sqlite3`);
  db.exec("PRAGMA foreign_keys = ON");
  return { ...base, persistent: true };
}

function run(sql: string, params: unknown[]): unknown[][] {
  return db.exec({
    sql,
    bind: params.length > 0 ? params : undefined,
    rowMode: "array",
    returnValue: "resultRows",
  });
}

function handle(req: WorkerRequest): unknown {
  if (req.type === "open") return open(req.name);
  if (!db) throw new Error("Banco não aberto.");
  switch (req.type) {
    case "query":
      return run(req.sql, req.params);
    case "batch": {
      // Tudo acontece dentro deste único tratamento de mensagem, sem pausas:
      // nenhuma outra consulta consegue entrar no meio da transação.
      db.exec("BEGIN");
      try {
        const results = req.statements.map((s) => run(s.sql, s.params));
        db.exec("COMMIT");
        return results;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    }
    case "exec":
      db.exec(req.sql);
      return null;
    case "close":
      db.close();
      db = undefined;
      return null;
  }
}

addEventListener("message", async (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;
  let res: WorkerResponse;
  try {
    res = { id: req.id, ok: true, result: await handle(req) };
  } catch (error) {
    res = {
      id: req.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      busy: error instanceof BusyError,
    };
  }
  postMessage(res);
});
