import type { Manifest } from "@estudarella/plugin-api";
import { type Ref, useEffect, useImperativeHandle, useRef, useState } from "react";
import { z } from "zod";
import { connectPlugin, type PluginConnection, RpcFailure, type RpcHandler } from "./bridge";
import { loadPlugin } from "./loader";
import { normalizePluginPath, type PluginSource } from "./source";

export interface PluginFrameHandle {
  emit(event: string, payload: unknown): void;
}

interface PluginFrameProps {
  /** Pasta do plugin. Mantenha a mesma referência entre renderizações (useMemo). */
  source: PluginSource;
  title: string;
  handlers: Readonly<Record<string, RpcHandler>>;
  className?: string;
  onLoaded?: (manifest: Manifest) => void;
  /** Dados extras enviados na conexão (ex.: contexto). Lidos no momento em que o iframe carrega. */
  initData?: Record<string, unknown>;
  /** Avisado a cada chamada do plugin (usado para detectar plugin travado). */
  onCall?: () => void;
  /** Mostrado se o plugin não carregar (no lugar da mensagem de erro). */
  errorFallback?: React.ReactNode;
  ref?: Ref<PluginFrameHandle>;
}

const readFileParams = z.object({ path: z.string() });

/**
 * Executa um plugin isolado: iframe sem `allow-same-origin` (origem opaca — sem
 * acesso a cookies, armazenamento ou DOM do app) e com a política de rede do
 * manifesto injetada no documento.
 */
export function PluginFrame({
  source,
  title,
  handlers,
  className,
  onLoaded,
  initData,
  onCall,
  errorFallback,
  ref,
}: PluginFrameProps) {
  const [doc, setDoc] = useState<string>();
  const [error, setError] = useState(false);
  const connection = useRef<PluginConnection | null>(null);
  const latest = useRef({ handlers, onLoaded, initData, onCall });
  latest.current = { handlers, onLoaded, initData, onCall };

  useEffect(() => {
    let cancelled = false;
    setDoc(undefined);
    setError(false);
    loadPlugin(source).then(
      (plugin) => {
        if (cancelled) return;
        setDoc(plugin.document);
        latest.current.onLoaded?.(plugin.manifest);
      },
      (e) => {
        if (cancelled) return;
        console.error("[plugin] falha ao carregar", e);
        setError(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [source]);

  useEffect(() => () => connection.current?.dispose(), []);

  useImperativeHandle(ref, () => ({
    emit: (event, payload) => connection.current?.emit(event, payload),
  }));

  if (error) {
    return (
      errorFallback ?? <p className="text-sm text-danger">Não foi possível carregar o plugin.</p>
    );
  }
  if (!doc) return <p className="text-sm text-muted">Carregando plugin…</p>;

  // Disponível para todo plugin: ler um arquivo da própria pasta.
  const builtins: Record<string, RpcHandler> = {
    "plugin.readFile": async (params) => {
      const parsed = readFileParams.safeParse(params);
      if (!parsed.success) throw new RpcFailure("invalid_params", "Informe o caminho do arquivo.");
      let path: string;
      try {
        path = normalizePluginPath(parsed.data.path);
      } catch {
        throw new RpcFailure("forbidden", "Caminho fora da pasta do plugin.");
      }
      try {
        return await source.readBytes(path);
      } catch {
        throw new RpcFailure("invalid_params", "Arquivo não encontrado.");
      }
    },
  };

  return (
    <iframe
      title={title}
      className={className}
      // allow-forms: sem ele o navegador nem dispara o evento "submit". Enviar dados
      // para fora continua impossível: a política do plugin tem form-action 'none'.
      sandbox="allow-scripts allow-forms"
      referrerPolicy="no-referrer"
      srcDoc={doc}
      onLoad={(event) => {
        connection.current?.dispose();
        connection.current = connectPlugin(
          event.currentTarget,
          () => ({ ...latest.current.handlers, ...builtins }),
          { init: latest.current.initData, onCall: () => latest.current.onCall?.() },
        );
      }}
    />
  );
}
