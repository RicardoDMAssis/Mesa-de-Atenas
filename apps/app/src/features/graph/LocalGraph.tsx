import { graphData } from "@estudarella/db";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useSubjects } from "../../data/hooks";
import { useLiveQuery } from "../../data/useLiveQuery";
import { buildGraph } from "./build";
import { GraphView } from "./GraphView";

/** Mapa pequeno com a nota e as notas ligadas a ela. Some se não houver conexões. */
export function LocalGraph({ noteId }: { noteId: string }) {
  const navigate = useNavigate();
  const subjects = useSubjects();
  const data = useLiveQuery(["notes", "links", "subjects"], graphData);
  const [selected, setSelected] = useState<string | null>(null);
  const graph = useMemo(
    () =>
      data.data
        ? buildGraph(data.data, {
            subjectIds: null,
            showSubjects: false,
            hideIsolated: false,
            centerId: noteId,
          })
        : null,
    [data.data, noteId],
  );
  const roots = useMemo(
    () => subjects.list.filter((s) => !s.parentId).map((s) => s.id),
    [subjects.list],
  );
  if (!graph || graph.edges.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Conexões</h2>
      <div className="relative mt-2 h-56 overflow-hidden rounded-xl border border-line bg-surface">
        <GraphView
          nodes={graph.nodes}
          edges={graph.edges}
          subjectOrder={roots}
          selected={selected}
          onSelect={(id) => (id && id !== noteId ? navigate(`/notas/${id}`) : setSelected(id))}
          onOpen={(id) => id !== noteId && navigate(`/notas/${id}`)}
          centerId={noteId}
          className="absolute inset-0"
        />
      </div>
    </section>
  );
}
