import type { PluginContext, Surface } from "@estudarella/plugin-api";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useDatabase } from "../data/DatabaseProvider";
import { useAppearanceStore } from "../stores/appearance";
import { useThemeStore } from "../stores/theme";
import { buildHandlers } from "./handlers";
import { PluginFrame, type PluginFrameHandle } from "./PluginFrame";
import { usePlugins } from "./registry";
import { themePayload } from "./theme";

/** Tempo para o plugin dar sinal de vida depois de carregar. */
const READY_TIMEOUT = 10_000;

/**
 * Mostra um plugin em uma das suas superfícies (tela, painel ou configurações),
 * com as permissões que o usuário concedeu. Se o plugin não responder, mostra um
 * aviso no lugar dele, sem afetar o resto do app.
 */
export function PluginSurface({
  pluginId,
  surface,
  context,
  className = "h-full w-full",
  fallback,
}: {
  pluginId: string;
  surface: Surface;
  context?: Omit<PluginContext, "surface">;
  className?: string;
  /**
   * O que mostrar quando o plugin não está disponível (não instalado, desativado,
   * travado ou com erro). Sem ele, aparece uma mensagem. Usado pelos cards visuais.
   */
  fallback?: React.ReactNode;
}) {
  const plugin = usePlugins((s) => s.plugins.find((p) => p.manifest.id === pluginId));
  const loaded = usePlugins((s) => s.loaded);
  const database = useDatabase();
  const navigate = useNavigate();
  const frame = useRef<PluginFrameHandle>(null);
  const fullContext = useMemo<PluginContext>(() => ({ ...context, surface }), [context, surface]);
  const contextRef = useRef(fullContext);
  contextRef.current = fullContext;
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<"waiting" | "alive" | "stuck">("waiting");
  const theme = useThemeStore((s) => s.preference);
  const palette = useAppearanceStore((s) => `${s.palette}|${s.customAccent}`);

  const handlers = useMemo(
    () =>
      plugin
        ? buildHandlers(plugin, { database, navigate, getContext: () => contextRef.current })
        : {},
    [plugin, database, navigate],
  );

  // Plugin que não chama o app logo depois de carregar é considerado travado.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` reinicia a espera
  useEffect(() => {
    setStatus("waiting");
    const timer = setTimeout(
      () => setStatus((s) => (s === "waiting" ? "stuck" : s)),
      READY_TIMEOUT,
    );
    return () => clearTimeout(timer);
  }, [attempt, pluginId]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: tema e paleta são os gatilhos
  useEffect(() => {
    frame.current?.emit("theme.changed", themePayload());
  }, [theme, palette]);

  const contextKey = JSON.stringify(fullContext);
  // biome-ignore lint/correctness/useExhaustiveDependencies: compara pelo conteúdo
  useEffect(() => {
    frame.current?.emit("context.changed", fullContext);
  }, [contextKey]);

  if (!plugin) {
    if (!loaded) return null;
    return fallback ?? <Message>Este plugin não está instalado.</Message>;
  }
  if (fallback && (!plugin.record.enabled || status === "stuck")) return fallback;
  if (!plugin.record.enabled) {
    return (
      <Message>
        {plugin.manifest.name} está desativado.{" "}
        <Link to="/plugins" className="font-medium text-accent">
          Ativar em Plugins
        </Link>
      </Message>
    );
  }
  if (status === "stuck") {
    return (
      <Message>
        {plugin.manifest.name} não respondeu.{" "}
        <button
          type="button"
          className="font-medium text-accent"
          onClick={() => setAttempt((n) => n + 1)}
        >
          Tentar de novo
        </button>
      </Message>
    );
  }
  return (
    <PluginFrame
      key={`${attempt}:${plugin.record.version}:${plugin.record.grantedPermissions.join(",")}`}
      ref={frame}
      source={plugin.source}
      title={plugin.manifest.name}
      handlers={handlers}
      initData={{ context: contextRef.current }}
      onCall={() => setStatus((s) => (s === "alive" ? s : "alive"))}
      errorFallback={fallback}
      className={`${className} bg-surface`}
    />
  );
}

function Message({ children }: { children: React.ReactNode }) {
  return <p className="p-6 text-center text-sm text-muted">{children}</p>;
}
