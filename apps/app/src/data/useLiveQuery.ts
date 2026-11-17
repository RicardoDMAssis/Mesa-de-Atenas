import type { Db } from "@estudarella/db";
import { useEffect, useRef, useState } from "react";
import { useDatabase } from "./DatabaseProvider";

interface LiveQuery<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
}

/**
 * Lê do banco e mantém o resultado em dia: a consulta roda de novo sempre que
 * alguma das `tables` (nomes no banco, ex.: "notes") é alterada, por qualquer tela.
 * `deps` são os valores externos de que a consulta depende (ex.: o id da nota).
 */
export function useLiveQuery<T>(
  tables: readonly string[],
  query: (db: Db) => Promise<T>,
  deps: readonly unknown[] = [],
): LiveQuery<T> {
  const { db, changes } = useDatabase();
  const [state, setState] = useState<LiveQuery<T>>({
    data: undefined,
    error: undefined,
    loading: true,
  });
  const latestQuery = useRef(query);
  latestQuery.current = query;
  const tablesKey = tables.join(",");

  useEffect(() => {
    let run = 0;
    let cancelled = false;
    const load = () => {
      const mine = ++run;
      latestQuery.current(db).then(
        (data) => {
          // Descarta respostas de execuções antigas que chegarem fora de ordem.
          if (!cancelled && mine === run) setState({ data, error: undefined, loading: false });
        },
        (error) => {
          if (!cancelled && mine === run) setState((s) => ({ ...s, error, loading: false }));
        },
      );
    };
    load();
    const unsubscribe = changes.subscribe(tablesKey.split(","), load);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [db, changes, tablesKey, ...deps]);

  return state;
}
