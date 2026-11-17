export type QueryMethod = "run" | "all" | "values" | "get";

export interface DriverInfo {
  /** Onde o banco roda: "sqlite-wasm" (navegador) ou "capacitor-sqlite" (Android). */
  backend: string;
  sqliteVersion: string;
  /** `false` quando os dados vivem só em memória e somem ao fechar o app. */
  persistent: boolean;
  /** Motivo de não estar persistindo, quando `persistent` é falso. */
  reason?: string;
}

export interface Statement {
  sql: string;
  params: unknown[];
  method: QueryMethod;
}

/**
 * Contrato mínimo que cada plataforma implementa. Todo o resto (schema, queries,
 * migrações) é compartilhado e fala apenas com esta interface.
 */
export interface SqlDriver {
  readonly info: DriverInfo;
  /** Executa uma instrução com parâmetros e devolve as linhas como arrays. */
  query(sql: string, params: unknown[], method: QueryMethod): Promise<unknown[][]>;
  /**
   * Executa várias instruções como uma unidade: ou todas valem, ou nenhuma.
   * É a única forma segura de transação — o banco tem uma conexão só, então um
   * BEGIN/COMMIT feito em chamadas separadas poderia englobar consultas de outras telas.
   */
  batch(statements: Statement[]): Promise<unknown[][][]>;
  /** Executa uma ou mais instruções sem parâmetros (migrações, PRAGMA). */
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}

/** O banco já está aberto em outra aba/janela. */
export class DbBusyError extends Error {
  constructor() {
    super("O banco de dados já está aberto em outra aba.");
    this.name = "DbBusyError";
  }
}
