import {
  createNote,
  deleteNote,
  getNote,
  listBacklinks,
  type Note,
  saveNote,
  setNoteSubject,
} from "@estudarella/db";
import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { SubjectSelect } from "../components/SubjectSelect";
import { ConfirmDialog, EmptyState, Menu } from "../components/ui";
import { useDatabase } from "../data/DatabaseProvider";
import { useLiveQuery } from "../data/useLiveQuery";
import { type EditorSnapshot, NoteEditor } from "../features/notes/NoteEditor";
import { linkTargets } from "../features/notes/noteLink";
import { noteLabel } from "../features/notes/titles";

const SAVE_DELAY = 500;

export function Nota() {
  const { id = "" } = useParams();
  // A chave recria a tela ao trocar de nota (inclusive ao seguir um link dentro do texto).
  return <NoteScreen key={id} id={id} />;
}

type SaveStatus = "saved" | "pending" | "saving" | "error";

function NoteScreen({ id }: { id: string }) {
  const { db } = useDatabase();
  const navigate = useNavigate();
  const [note, setNote] = useState<Note | null>();
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Rascunho mais recente e controle do salvamento automático.
  const draft = useRef<{ title: string; body: EditorSnapshot | null; dirty: boolean }>({
    title: "",
    body: null,
    dirty: false,
  });
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const deleted = useRef(false);

  useEffect(() => {
    let cancelled = false;
    getNote(db, id).then((found) => {
      if (cancelled) return;
      setNote(found ?? null);
      if (found) {
        setTitle(found.title);
        draft.current = {
          title: found.title,
          body: { content: found.content, plainText: found.plainText },
          dirty: false,
        };
      }
    });
    return () => {
      cancelled = true;
    };
  }, [db, id]);

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    const current = draft.current;
    if (!current.dirty || !current.body || deleted.current) return;
    current.dirty = false;
    setStatus("saving");
    try {
      await saveNote(db, id, {
        title: current.title.trim(),
        content: current.body.content,
        plainText: current.body.plainText,
        linkTargets: linkTargets(current.body.content),
      });
      if (!draft.current.dirty) setStatus("saved");
    } catch (error) {
      console.error("[nota] falha ao salvar", error);
      current.dirty = true;
      setStatus("error");
    }
  }, [db, id]);

  const schedule = useCallback(() => {
    draft.current.dirty = true;
    setStatus("pending");
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY);
  }, [flush]);

  // Salva o que estiver pendente ao sair da tela ou ao esconder o app.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
      void flush();
    };
  }, [flush]);

  const onBodyChange = useCallback(
    (body: EditorSnapshot) => {
      draft.current.body = body;
      schedule();
    },
    [schedule],
  );

  const createLinked = useCallback(
    async (newTitle: string) => {
      const created = await createNote(db, { title: newTitle, subjectId: note?.subjectId });
      return created.id;
    },
    [db, note?.subjectId],
  );

  const backlinks = useLiveQuery(["links", "notes"], (db) => listBacklinks(db, id), [id]);

  if (note === undefined) return <p className="text-sm text-muted">Abrindo nota…</p>;
  if (note === null) {
    return (
      <EmptyState
        title="Nota não encontrada"
        action={<Link to="/notas">Voltar para as notas</Link>}
      >
        Ela pode ter sido excluída.
      </EmptyState>
    );
  }

  return (
    <article>
      <div className="mb-4 flex items-center gap-2">
        <Link
          to="/notas"
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg pr-2 text-sm text-muted hover:text-fg"
        >
          <ArrowLeft size={16} aria-hidden />
          Notas
        </Link>
        <span className="ml-auto text-xs text-muted" role="status" data-testid="save-status">
          {
            {
              saved: "Salvo",
              pending: "Salvando…",
              saving: "Salvando…",
              error: "Não foi possível salvar",
            }[status]
          }
        </span>
        <Menu
          label="Ações da nota"
          items={[{ label: "Excluir nota", danger: true, onSelect: () => setConfirmDelete(true) }]}
        />
      </div>

      <input
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          draft.current.title = e.target.value;
          schedule();
        }}
        placeholder="Título"
        aria-label="Título da nota"
        maxLength={200}
        className="w-full bg-transparent text-2xl font-semibold tracking-tight outline-none placeholder:text-muted md:text-3xl"
      />

      <div className="mb-4 mt-3 max-w-xs">
        <label className="sr-only" htmlFor="nota-materia">
          Matéria
        </label>
        <SubjectSelect
          id="nota-materia"
          value={note.subjectId}
          onChange={async (subjectId) => {
            setNote({ ...note, subjectId });
            await setNoteSubject(db, id, subjectId);
          }}
        />
      </div>

      <NoteEditor
        noteId={id}
        initialContent={note.content}
        createNote={createLinked}
        onChange={onBodyChange}
      />

      {backlinks.data && backlinks.data.length > 0 && (
        <section className="mt-10 border-t border-line pt-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
            Notas que apontam para esta
          </h2>
          <ul className="mt-2 grid gap-1">
            {backlinks.data.map((source) => (
              <li key={source.id}>
                <Link to={`/notas/${source.id}`} className="text-sm font-medium text-accent">
                  {noteLabel(source.title)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Excluir esta nota?"
        message="Os links de outras notas para ela deixam de funcionar."
        confirmLabel="Excluir"
        onConfirm={async () => {
          deleted.current = true;
          clearTimeout(timer.current);
          await deleteNote(db, id);
          navigate("/notas");
        }}
      />
    </article>
  );
}
