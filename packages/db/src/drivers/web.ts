import {
  DbBusyError,
  type DriverInfo,
  type QueryMethod,
  type SqlDriver,
  type Statement,
} from "../driver";
import {
  dbLockName,
  type OpenResult,
  type WorkerRequest,
  type WorkerResponse,
} from "./web-protocol";

// Omit distributivo: preserva a união discriminada de WorkerRequest.
type RequestBody = WorkerRequest extends infer R
  ? R extends unknown
    ? Omit<R, "id">
    : never
  : never;

/** Driver do navegador: SQLite WASM em um Web Worker, persistido no OPFS. */
export async function openWebDriver(name = "estudarella"): Promise<SqlDriver> {
  const worker = new Worker(new URL("./web.worker.ts", import.meta.url), { type: "module" });
  const pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (reason: Error) => void }
  >();
  let nextId = 1;

  worker.addEventListener("message", (event: MessageEvent<WorkerResponse>) => {
    const res = event.data;
    const waiter = pending.get(res.id);
    if (!waiter) return;
    pending.delete(res.id);
    if (res.ok) waiter.resolve(res.result);
    else waiter.reject(res.busy ? new DbBusyError() : new Error(res.error));
  });
  worker.addEventListener("error", (event) => {
    const error = new Error(event.message || "Falha no worker do banco de dados.");
    for (const waiter of pending.values()) waiter.reject(error);
    pending.clear();
  });

  const call = <T>(body: RequestBody): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
      worker.postMessage({ ...body, id } as WorkerRequest);
    });

  let info: DriverInfo;
  try {
    info = await call<OpenResult>({ type: "open", name });
  } catch (error) {
    worker.terminate();
    throw error;
  }

  return {
    info,
    query: (sql: string, params: unknown[], method: QueryMethod) =>
      call<unknown[][]>({ type: "query", sql, params, method }),
    batch: (statements: Statement[]) => call<unknown[][][]>({ type: "batch", statements }),
    exec: (sql: string) => call<void>({ type: "exec", sql }),
    close: async () => {
      await call<void>({ type: "close" });
      worker.terminate();
    },
  };
}

/**
 * Resolve quando a aba que está com o banco aberto for fechada.
 * Usado pela aba que recebeu `DbBusyError` para assumir sozinha em seguida.
 */
export async function waitForDbRelease(name = "estudarella"): Promise<void> {
  if (!navigator.locks) return new Promise(() => {});
  await navigator.locks.request(dbLockName(name), () => {});
}
