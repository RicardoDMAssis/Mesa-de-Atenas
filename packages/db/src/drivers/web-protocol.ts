import type { DriverInfo, QueryMethod, Statement } from "../driver";

export type WorkerRequest =
  | { id: number; type: "open"; name: string }
  | { id: number; type: "query"; sql: string; params: unknown[]; method: QueryMethod }
  | { id: number; type: "batch"; statements: Statement[] }
  | { id: number; type: "exec"; sql: string }
  | { id: number; type: "close" };

export type WorkerResponse =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; error: string; busy?: boolean };

export type OpenResult = DriverInfo;

/** Nome do lock que garante uma única aba com o banco aberto. */
export const dbLockName = (name: string) => `estudarella-db:${name}`;
