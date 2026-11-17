import { getSetting, newId, setSetting } from "@estudarella/db";
import { Check, X } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { Card, PageTitle } from "../components/Card";
import { useDatabase } from "../data/DatabaseProvider";
import { useLiveQuery } from "../data/useLiveQuery";
import { RpcFailure, type RpcHandler } from "../plugin-host/bridge";
import { PluginFrame, type PluginFrameHandle } from "../plugin-host/PluginFrame";
import { urlSource } from "../plugin-host/source";
import { useThemeStore } from "../stores/theme";

export function Diagnostico() {
  return (
    <>
      <PageTitle subtitle="Provas de risco da Fase 0, rodando neste aparelho.">
        Diagnóstico
      </PageTitle>
      <div className="grid gap-4">
        <BancoDeDados />
        <IsolamentoDePlugins />
      </div>
    </>
  );
}

const COUNTER_KEY = "diagnostico.contador";

function BancoDeDados() {
  const { db, info, assets } = useDatabase();
  const counter = useLiveQuery(["settings"], async (db) => {
    return (await getSetting<number>(db, COUNTER_KEY)) ?? 0;
  });
  const [filesOk, setFilesOk] = useState<boolean>();

  // Grava, lê de volta e apaga um arquivo pequeno no armazenamento de arquivos.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const content = `diagnostico ${Date.now()}`;
      const stored = await assets.put(new Blob([content], { type: "text/plain" }));
      const back = await assets.get(stored.hash);
      const same = (await back?.text()) === content;
      await assets.delete(stored.hash);
      return same && assets.persistent;
    })().then(
      (ok) => !cancelled && setFilesOk(ok),
      () => !cancelled && setFilesOk(false),
    );
    return () => {
      cancelled = true;
    };
  }, [assets]);

  return (
    <Card title="Banco de dados local">
      <ul className="grid gap-1.5 text-sm">
        <Result ok testId="db-backend">
          {info.backend} · SQLite {info.sqliteVersion}
        </Result>
        <Result ok={info.persistent} testId="db-persistent">
          {info.persistent
            ? "Os dados ficam salvos neste aparelho"
            : `Dados apenas em memória. ${info.reason ?? ""}`}
        </Result>
        {filesOk !== undefined && (
          <Result ok={filesOk} testId="db-files">
            {filesOk
              ? "Arquivos (imagens, modelos) ficam salvos neste aparelho"
              : "Arquivos não estão sendo salvos neste aparelho"}
          </Result>
        )}
      </ul>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={async () => {
            await setSetting(db, COUNTER_KEY, (counter.data ?? 0) + 1);
          }}
          disabled={counter.loading}
          className="min-h-11 shrink-0 whitespace-nowrap rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg disabled:opacity-50"
        >
          Gravar +1
        </button>
        <p className="text-sm text-muted">
          Gravações: <strong data-testid="db-count">{counter.data ?? "…"}</strong> — recarregue a
          página; o número deve continuar.
        </p>
      </div>
    </Card>
  );
}

const reportSchema = z.object({
  webgl: z.boolean(),
  storageBlocked: z.boolean(),
  cookiesBlocked: z.boolean(),
  parentBlocked: z.boolean(),
  networkBlocked: z.boolean(),
  fileLoaded: z.boolean(),
  outsideBlocked: z.boolean(),
});

const cardSchema = z.object({
  front: z.string().min(1).max(500),
  back: z.string().min(1).max(500),
  content: z.unknown(),
});

/** Tokens de tema que o app entrega aos plugins. */
function themePayload() {
  const style = getComputedStyle(document.documentElement);
  const names = [
    "--bg",
    "--surface",
    "--text",
    "--muted",
    "--border",
    "--accent",
    "--accent-contrast",
  ];
  return {
    theme: document.documentElement.dataset.theme ?? "light",
    tokens: Object.fromEntries(names.map((name) => [name, style.getPropertyValue(name).trim()])),
  };
}

function parseParams<T>(schema: z.ZodType<T>, params: unknown): T {
  const parsed = schema.safeParse(params);
  if (!parsed.success) throw new RpcFailure("invalid_params", "Parâmetros inválidos.");
  return parsed.data;
}

function IsolamentoDePlugins() {
  const frame = useRef<PluginFrameHandle>(null);
  const source = useMemo(() => urlSource("/builtin-plugins/spike"), []);
  const [report, setReport] = useState<z.infer<typeof reportSchema>>();
  const [unknownCode, setUnknownCode] = useState<string>();
  const [cards, setCards] = useState(0);
  const preference = useThemeStore((s) => s.preference);

  // Reenvia o tema ao plugin quando a preferência muda (o documento já foi atualizado).
  // biome-ignore lint/correctness/useExhaustiveDependencies: `preference` é o gatilho
  useEffect(() => {
    frame.current?.emit("theme.changed", themePayload());
  }, [preference]);

  const handlers = useMemo<Record<string, RpcHandler>>(
    () => ({
      "host.getTheme": () => themePayload(),
      "spike.report": (params) => {
        setReport(parseParams(reportSchema, params));
        return null;
      },
      "spike.unknownMethodResult": (params) => {
        setUnknownCode(parseParams(z.object({ code: z.string().max(40) }), params).code);
        return null;
      },
      // Simulado: valida a entrada como o método real fará, mas ainda não grava.
      "cards.create": (params) => {
        parseParams(cardSchema, params);
        setCards((n) => n + 1);
        return { id: newId() };
      },
    }),
    [],
  );

  return (
    <Card title="Isolamento de plugins">
      <PluginFrame
        ref={frame}
        source={source}
        title="Plugin de prova"
        handlers={handlers}
        className="h-64 w-full rounded-lg border border-line"
      />
      {report ? (
        <ul className="mt-4 grid gap-1.5 text-sm" data-testid="plugin-report">
          <Result ok={report.webgl} testId="plugin-webgl">
            Gráficos 3D (WebGL) funcionando dentro do plugin
          </Result>
          <Result ok={report.fileLoaded} testId="plugin-files">
            Plugin com vários arquivos: página, estilo, código e modelo binário
          </Result>
          <Result ok={report.outsideBlocked} testId="plugin-outside">
            Plugin não lê arquivos fora da própria pasta
          </Result>
          <Result ok={report.storageBlocked && report.cookiesBlocked} testId="plugin-storage">
            Plugin sem acesso ao armazenamento e aos cookies do app
          </Result>
          <Result ok={report.parentBlocked} testId="plugin-dom">
            Plugin sem acesso à tela do app
          </Result>
          <Result ok={report.networkBlocked} testId="plugin-network">
            Rede bloqueada para plugin sem permissão
          </Result>
          <Result ok={unknownCode === "unknown_method"} testId="plugin-rpc">
            Chamada não autorizada recusada pelo app
          </Result>
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted">Aguardando o plugin…</p>
      )}
      <p className="mt-3 text-sm text-muted">
        Cards pedidos pelo plugin: <strong data-testid="plugin-cards">{cards}</strong>
      </p>
    </Card>
  );
}

function Result({ ok, testId, children }: { ok: boolean; testId: string; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2" data-testid={testId} data-ok={ok}>
      {ok ? (
        <Check size={16} className="mt-0.5 shrink-0 text-ok" aria-label="OK" />
      ) : (
        <X size={16} className="mt-0.5 shrink-0 text-danger" aria-label="Falhou" />
      )}
      <span>{children}</span>
    </li>
  );
}
