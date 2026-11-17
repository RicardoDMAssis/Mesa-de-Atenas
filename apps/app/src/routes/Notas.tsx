import { createNote, listNotes, subtreeIds } from "@estudarella/db";
import { Plus } from "lucide-react";
import { useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { PageTitle } from "../components/Card";
import { Button, EmptyState } from "../components/ui";
import { useDatabase } from "../data/DatabaseProvider";
import { useSubjects } from "../data/hooks";
import { useLiveQuery } from "../data/useLiveQuery";
import { noteLabel } from "../features/notes/titles";
import { type SubjectFilter, SubjectTree } from "../features/subjects/SubjectTree";

const dateFormat = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" });

export function Notas() {
  const { db } = useDatabase();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const filter: SubjectFilter = params.get("materia") ?? "all";
  const subjects = useSubjects();
  const notes = useLiveQuery(["notes"], listNotes);

  const visible = useMemo(() => {
    const all = notes.data ?? [];
    if (filter === "all") return all;
    if (filter === "none") return all.filter((n) => !n.subjectId);
    const ids = new Set(subtreeIds(subjects.list, filter));
    return all.filter((n) => n.subjectId && ids.has(n.subjectId));
  }, [notes.data, filter, subjects.list]);

  const heading =
    filter === "all"
      ? "Notas"
      : filter === "none"
        ? "Sem matéria"
        : (subjects.byId.get(filter)?.name ?? "Notas");

  const newNote = async () => {
    const subjectId = filter === "all" || filter === "none" ? null : filter;
    const created = await createNote(db, { subjectId });
    navigate(`/notas/${created.id}`);
  };

  return (
    <div className="md:grid md:grid-cols-[14rem_1fr] md:gap-8">
      <aside className="mb-6 md:mb-0">
        <details className="group md:hidden" open={subjects.list.length === 0 ? undefined : false}>
          <summary className="flex min-h-11 cursor-pointer items-center rounded-lg border border-line bg-surface px-3 text-sm font-medium">
            Matérias: {heading === "Notas" ? "todas" : heading}
          </summary>
          <div className="mt-2">
            <SubjectTree
              selected={filter}
              onSelect={(next) => setParams(next === "all" ? {} : { materia: next })}
            />
          </div>
        </details>
        <div className="hidden md:block">
          <SubjectTree
            selected={filter}
            onSelect={(next) => setParams(next === "all" ? {} : { materia: next })}
          />
        </div>
      </aside>

      <section className="min-w-0">
        <div className="flex items-start justify-between gap-3">
          <PageTitle>{heading}</PageTitle>
          <Button variant="primary" onClick={newNote}>
            <Plus size={18} aria-hidden />
            Nova nota
          </Button>
        </div>

        {notes.loading ? null : visible.length === 0 ? (
          <EmptyState title="Nenhuma nota aqui ainda">
            Crie uma nota e digite [[ dentro dela para ligá-la a outras.
          </EmptyState>
        ) : (
          <ul className="grid gap-2">
            {visible.map((note) => (
              <li key={note.id}>
                <Link
                  to={`/notas/${note.id}`}
                  className="block rounded-xl border border-line bg-surface p-4 hover:border-accent"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="min-w-0 truncate font-medium">{noteLabel(note.title)}</h2>
                    <time className="shrink-0 text-xs text-muted">
                      {dateFormat.format(note.updatedAt)}
                    </time>
                  </div>
                  {note.excerpt.trim() && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted">{note.excerpt}</p>
                  )}
                  {filter === "all" && note.subjectId && subjects.byId.get(note.subjectId) && (
                    <p className="mt-2 text-xs text-accent">
                      {subjects.byId.get(note.subjectId)?.name}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
