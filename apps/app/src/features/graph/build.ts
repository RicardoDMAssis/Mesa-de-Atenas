import type { GraphData } from "@estudarella/db";

export interface GraphOptions {
  /** Mostra só as notas destas matérias (já com a subárvore). `null` = todas. */
  subjectIds: Set<string> | null;
  /** Inclui as matérias como pontos, ligadas às suas notas. */
  showSubjects: boolean;
  /** Esconde notas sem nenhum link. */
  hideIsolated: boolean;
  /** Grafo local: só esta nota e os vizinhos diretos. */
  centerId?: string;
}

export interface GraphNode {
  id: string;
  label: string;
  kind: "note" | "subject";
  /** Matéria de nível mais alto, que define a cor (`null` = sem matéria). */
  rootSubjectId: string | null;
  /** Número de conexões entre notas (define o tamanho). */
  degree: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  kind: "link" | "subject";
}

/** Prefixo dos ids de matéria, para não colidir com ids de nota no grafo. */
export const SUBJECT_PREFIX = "materia:";

/** Monta os pontos e as linhas do mapa a partir dos dados do banco. */
export function buildGraph(
  data: GraphData,
  options: GraphOptions,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const parentOf = new Map(data.subjects.map((s) => [s.id, s.parentId]));
  const rootOf = (id: string | null): string | null => {
    const seen = new Set<string>();
    let current = id;
    while (current && parentOf.get(current) && !seen.has(current)) {
      seen.add(current);
      current = parentOf.get(current) ?? null;
    }
    return current && parentOf.has(current) ? current : null;
  };

  let notes = data.notes.filter(
    (n) => !options.subjectIds || (n.subjectId !== null && options.subjectIds.has(n.subjectId)),
  );
  let ids = new Set(notes.map((n) => n.id));
  let links = dedupe(data.links.filter((l) => ids.has(l.source) && ids.has(l.target)));

  if (options.centerId) {
    const keep = new Set([options.centerId]);
    for (const l of links) {
      if (l.source === options.centerId) keep.add(l.target);
      if (l.target === options.centerId) keep.add(l.source);
    }
    notes = notes.filter((n) => keep.has(n.id));
    ids = keep;
    links = links.filter((l) => l.source === options.centerId || l.target === options.centerId);
  }

  const degree = new Map<string, number>();
  for (const l of links) {
    degree.set(l.source, (degree.get(l.source) ?? 0) + 1);
    degree.set(l.target, (degree.get(l.target) ?? 0) + 1);
  }
  if (options.hideIsolated && !options.centerId) {
    notes = notes.filter((n) => degree.has(n.id));
  }

  const nodes: GraphNode[] = notes.map((n) => ({
    id: n.id,
    label: n.title.trim() || "Sem título",
    kind: "note",
    rootSubjectId: rootOf(n.subjectId),
    degree: degree.get(n.id) ?? 0,
  }));
  const edges: GraphEdge[] = links.map((l) => ({ ...l, kind: "link" }));

  if (options.showSubjects && !options.centerId) {
    const used = new Set(notes.map((n) => n.subjectId).filter((s): s is string => s !== null));
    for (const s of data.subjects) {
      if (!used.has(s.id)) continue;
      nodes.push({
        id: SUBJECT_PREFIX + s.id,
        label: s.name,
        kind: "subject",
        rootSubjectId: rootOf(s.id),
        degree: 0,
      });
    }
    for (const n of notes) {
      if (n.subjectId && used.has(n.subjectId)) {
        edges.push({ source: n.id, target: SUBJECT_PREFIX + n.subjectId, kind: "subject" });
      }
    }
  }
  return { nodes, edges };
}

/** Uma linha por par de notas (A→B e B→A viram uma só). */
function dedupe(links: GraphData["links"]) {
  const seen = new Set<string>();
  return links.filter((l) => {
    const key = l.source < l.target ? `${l.source}|${l.target}` : `${l.target}|${l.source}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
