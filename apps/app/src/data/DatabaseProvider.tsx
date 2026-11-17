import { DbBusyError } from "@estudarella/db";
import { waitForDbRelease } from "@estudarella/db/web";
import { createContext, type ReactNode, use, useEffect, useState } from "react";
import { type Database, getDatabase } from "./db";

const DatabaseContext = createContext<Database | null>(null);

export function useDatabase(): Database {
  const value = use(DatabaseContext);
  if (!value) throw new Error("useDatabase fora do DatabaseProvider");
  return value;
}

type State =
  | { status: "loading" }
  | { status: "ready"; database: Database }
  | { status: "error"; error: unknown };

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    getDatabase().then(
      (database) => !cancelled && setState({ status: "ready", database }),
      (error) => !cancelled && setState({ status: "error", error }),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  // O banco aceita uma aba por vez. Quando a outra fechar, esta assume sozinha.
  const busy = state.status === "error" && state.error instanceof DbBusyError;
  useEffect(() => {
    if (!busy) return;
    let cancelled = false;
    waitForDbRelease().then(() => !cancelled && location.reload());
    return () => {
      cancelled = true;
    };
  }, [busy]);

  if (state.status === "loading") {
    return <FullScreenMessage title="Abrindo seus estudos…" />;
  }
  if (state.status === "error") {
    return (
      <FullScreenMessage
        title={
          busy ? "O Estudarella já está aberto em outra aba" : "Não foi possível abrir o banco"
        }
        detail={
          busy
            ? "Para proteger seus dados, só uma aba fica ativa por vez. Esta aba continua sozinha assim que a outra for fechada."
            : state.error instanceof Error
              ? state.error.message
              : String(state.error)
        }
      />
    );
  }
  return <DatabaseContext value={state.database}>{children}</DatabaseContext>;
}

function FullScreenMessage({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
      <p className="text-lg font-medium">{title}</p>
      {detail && <p className="max-w-md text-sm text-muted">{detail}</p>}
    </div>
  );
}
