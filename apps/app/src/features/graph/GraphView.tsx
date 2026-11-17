import Graph from "graphology";
import forceAtlas2 from "graphology-layout-forceatlas2";
import FA2Layout from "graphology-layout-forceatlas2/worker";
import { useEffect, useRef, useState } from "react";
import Sigma from "sigma";
import { useThemeStore } from "../../stores/theme";
import type { GraphEdge, GraphNode } from "./build";

/** Cores por matéria raiz; legíveis no tema claro e no escuro. */
export const PALETTE = [
  "#6d5ce8",
  "#d9486b",
  "#1f9d6b",
  "#e08a1e",
  "#2f8fd8",
  "#9b59b6",
  "#c0682f",
  "#16a2a8",
];
const NO_SUBJECT = "#8a8794";

export function colorFor(rootSubjectId: string | null, order: string[]): string {
  if (!rootSubjectId) return NO_SUBJECT;
  const i = order.indexOf(rootSubjectId);
  return PALETTE[Math.max(i, 0) % PALETTE.length] ?? NO_SUBJECT;
}

interface GraphViewProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Ordem das matérias raiz, para as cores serem estáveis. */
  subjectOrder: string[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  /** Toque em um ponto já selecionado. */
  onOpen: (id: string) => void;
  className?: string;
  /** Destaque fixo (grafo local: a nota atual). */
  centerId?: string;
}

const css = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/**
 * Mapa de conexões em WebGL (Sigma). As posições são calculadas por ForceAtlas2
 * em um Web Worker, por um tempo limitado, sem travar a tela.
 */
export function GraphView({
  nodes,
  edges,
  subjectOrder,
  selected,
  onSelect,
  onOpen,
  className,
  centerId,
}: GraphViewProps) {
  const container = useRef<HTMLDivElement>(null);
  const sigma = useRef<Sigma | null>(null);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const callbacks = useRef({ onSelect, onOpen });
  callbacks.current = { onSelect, onOpen };
  const theme = useThemeStore((s) => s.preference);
  const [failed, setFailed] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `theme` recria o grafo com as cores certas
  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const graph = new Graph({ multi: false, type: "undirected" });
    const n = nodes.length;
    nodes.forEach((node, i) => {
      // Posição inicial em espiral: determinística e já espalhada.
      const angle = i * 2.399963;
      const radius = Math.sqrt(i + 1) * 10;
      graph.addNode(node.id, {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        label: node.label,
        size: node.kind === "subject" ? 9 : Math.min(4 + Math.sqrt(node.degree) * 3, 16),
        color: colorFor(node.rootSubjectId, subjectOrder),
        kind: node.kind,
      });
    });
    for (const e of edges) {
      if (
        graph.hasNode(e.source) &&
        graph.hasNode(e.target) &&
        !graph.hasEdge(e.source, e.target)
      ) {
        graph.addEdge(e.source, e.target, { kind: e.kind, size: e.kind === "link" ? 1.2 : 0.6 });
      }
    }

    const edgeColor = css("--border") || "#ddd";
    const labelColor = css("--text") || "#111";
    const muted = css("--muted") || "#999";

    let renderer: Sigma;
    try {
      renderer = new Sigma(graph, el, {
        settings: {
          labelRenderedSizeThreshold: n > 150 ? 8 : 0,
          stagePadding: 60,
          // Tamanho dos pontos em pixels de tela (o padrão da v4 é em unidades do grafo).
          itemSizesReference: "screen",
          renderEdgeLabels: false,
        },
        nodeReducer: (key, data) => {
          const base = { ...data, labelColor };
          const current = selectedRef.current ?? centerId ?? null;
          if (!current) return base;
          const near = key === current || graph.areNeighbors(key, current);
          return near
            ? { ...base, zIndex: 1, labelVisibility: "visible", highlighted: key === current }
            : { ...base, color: muted, labelVisibility: "hidden", zIndex: 0 };
        },
        edgeReducer: (key, data) => {
          const current = selectedRef.current ?? centerId ?? null;
          const base = { ...data, color: edgeColor };
          if (!current) return base;
          const touches = graph.extremities(key).includes(current);
          return touches
            ? { ...base, color: css("--accent") || "#6d5ce8", size: 2 }
            : { ...base, visibility: "hidden" };
        },
      });
    } catch (error) {
      console.error("[grafo] WebGL indisponível", error);
      setFailed(true);
      return;
    }
    sigma.current = renderer;
    // Acesso ao renderizador para testes automatizados (os pontos são desenhados em WebGL).
    (el as HTMLDivElement & { sigma?: Sigma }).sigma = renderer;

    renderer.on("clickNode", ({ node }) => {
      if (selectedRef.current === node) callbacks.current.onOpen(node);
      else callbacks.current.onSelect(node);
    });
    renderer.on("clickStage", () => callbacks.current.onSelect(null));

    // Layout em segundo plano, por tempo proporcional ao tamanho.
    let layout: FA2Layout | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (n > 2) {
      layout = new FA2Layout(graph, {
        settings: { ...forceAtlas2.inferSettings(graph), slowDown: 4 },
      });
      layout.start();
      timer = setTimeout(() => layout?.stop(), Math.min(800 + n * 4, 4000));
    }

    return () => {
      clearTimeout(timer);
      layout?.kill();
      renderer.kill();
      sigma.current = null;
    };
  }, [nodes, edges, subjectOrder, centerId, theme]);

  // Seleção muda só o destaque, sem recalcular posições.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `selected` é o gatilho
  useEffect(() => {
    sigma.current?.refresh();
  }, [selected]);

  if (failed) {
    return (
      <p className="p-6 text-center text-sm text-muted">
        Este aparelho não consegue desenhar o mapa (WebGL indisponível).
      </p>
    );
  }
  return (
    <div
      ref={container}
      className={className}
      data-testid="graph"
      data-nodes={nodes.length}
      data-edges={edges.length}
    />
  );
}
