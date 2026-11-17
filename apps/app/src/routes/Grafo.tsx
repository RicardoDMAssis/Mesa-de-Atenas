import { graphData, subtreeIds } from "@estudarella/db";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { PageTitle } from "../components/Card";
import { SubjectSelect } from "../components/SubjectSelect";
import { EmptyState } from "../components/ui";
import { useSubjects } from "../data/hooks";
import { useLiveQuery } from "../data/useLiveQuery";
import { buildGraph, SUBJECT_PREFIX } from "../features/graph/build";
import { colorFor, GraphView } from "../features/graph/GraphView";

export function Grafo() {
  const navigate = useNavigate();
  const subjects = useSubjects();
  const data = useLiveQuery(["notes", "links", "subjects"], graphData);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [showSubjects, setShowSubjects] = useState(true);
  const [hideIsolated, setHideIsolated] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const graph = useMemo(() => {
    if (!data.data) return null;
    return buildGraph(data.data, {
      subjectIds: subjectId ? new Set(subtreeIds(subjects.list, subjectId)) : null,
      showSubjects,
      hideIsolated,
    });
  }, [data.data, subjectId, subjects.list, showSubjects, hideIsolated]);

  const roots = useMemo(
    () => subjects.list.filter((s) => !s.parentId).map((s) => s.id),
    [subjects.list],
  );
  const selectedNode = graph?.nodes.find((n) => n.id === selected);
  const open = (id: string) => {
    if (id.startsWith(SUBJECT_PREFIX)) {
      navigate(`/notas?materia=${id.slice(SUBJECT_PREFIX.length)}`);
    } else navigate(`/notas/${id}`);
  };
  const neighbors = selected
    ? (graph?.edges.filter((e) => e.source === selected || e.target === selected).length ?? 0)
    : 0;

  return (
    <div className="flex h-[calc(100dvh-9rem)] flex-col md:h-[calc(100dvh-5rem)]">
      <PageTitle subtitle="Toque em um ponto para ver as conexões; toque de novo para abrir.">
        Grafo
      </PageTitle>

      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <div className="w-full sm:w-56">
          <label className="sr-only" htmlFor="grafo-materia">
            Filtrar por matéria
          </label>
          <SubjectSelect
            id="grafo-materia"
            value={subjectId}
            onChange={(id) => {
              setSubjectId(id);
              setSelected(null);
            }}
            emptyLabel="Todas as matérias"
          />
        </div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showSubjects}
            onChange={(e) => setShowSubjects(e.target.checked)}
          />
          Mostrar matérias
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={hideIsolated}
            onChange={(e) => setHideIsolated(e.target.checked)}
          />
          Ocultar notas sem conexão
        </label>
      </div>

      {!graph ? null : graph.nodes.length === 0 ? (
        <EmptyState title="Nada para mostrar">
          Crie notas e ligue-as com [[Título]] para ver as conexões aqui.
        </EmptyState>
      ) : (
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-line bg-surface">
          <GraphView
            nodes={graph.nodes}
            edges={graph.edges}
            subjectOrder={roots}
            selected={selected}
            onSelect={setSelected}
            onOpen={open}
            className="absolute inset-0"
          />
          {selectedNode && (
            <div className="absolute inset-x-3 bottom-3 flex items-center gap-3 rounded-xl border border-line bg-surface p-3 shadow-lg md:inset-x-auto md:right-3 md:w-80">
              <span
                className="size-3 shrink-0 rounded-full"
                style={{ background: colorFor(selectedNode.rootSubjectId, roots) }}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium" data-testid="graph-selected">
                  {selectedNode.label}
                </p>
                <p className="text-xs text-muted">
                  {selectedNode.kind === "subject"
                    ? "Matéria"
                    : `${neighbors} conex${neighbors === 1 ? "ão" : "ões"}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => open(selectedNode.id)}
                className="min-h-10 shrink-0 rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg"
              >
                Abrir
              </button>
            </div>
          )}
        </div>
      )}

      {roots.length > 0 && graph && graph.nodes.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="Legenda">
          {roots.map((id) => (
            <li key={id} className="flex items-center gap-1.5">
              <span
                className="size-2.5 rounded-full"
                style={{ background: colorFor(id, roots) }}
                aria-hidden
              />
              <Link to={`/notas?materia=${id}`}>{subjects.byId.get(id)?.name}</Link>
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: colorFor(null, roots) }} />
            Sem matéria
          </li>
        </ul>
      )}
    </div>
  );
}
