import { createDeck, listDecks } from "@estudarella/db";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { PageTitle } from "../components/Card";
import { SubjectSelect } from "../components/SubjectSelect";
import { Button, Dialog, DialogActions, EmptyState, Field, Input } from "../components/ui";
import { useDatabase } from "../data/DatabaseProvider";
import { useStudyDay, useSubjects } from "../data/hooks";
import { useLiveQuery } from "../data/useLiveQuery";

export function Baralhos() {
  const { db } = useDatabase();
  const navigate = useNavigate();
  const { end } = useStudyDay();
  const subjects = useSubjects();
  const decks = useLiveQuery(["decks", "cards"], (db) => listDecks(db, end), [end]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [subjectId, setSubjectId] = useState<string | null>(null);

  const list = decks.data ?? [];
  const toStudy = list.reduce((n, d) => n + d.due + d.fresh, 0);

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <PageTitle subtitle={toStudy > 0 ? `${toStudy} cards para hoje` : undefined}>
          Revisão
        </PageTitle>
        <Button variant="primary" onClick={() => setCreating(true)}>
          <Plus size={18} aria-hidden />
          Novo baralho
        </Button>
      </div>

      {toStudy > 0 && (
        <Link
          to="/estudar"
          className="mb-4 flex min-h-12 items-center justify-center rounded-xl bg-accent font-medium text-accent-fg"
        >
          Estudar tudo ({toStudy})
        </Link>
      )}

      {decks.loading ? null : list.length === 0 ? (
        <EmptyState title="Nenhum baralho ainda">
          Crie um baralho e adicione cards de frente e verso ou de lacunas.
        </EmptyState>
      ) : (
        <ul className="grid gap-2">
          {list.map((deck) => (
            <li
              key={deck.id}
              className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4"
            >
              <Link to={`/baralhos/${deck.id}`} className="min-w-0 flex-1">
                <h2 className="truncate font-medium">{deck.name}</h2>
                <p className="mt-0.5 text-xs text-muted">
                  {deck.total} cards
                  {deck.subjectId && subjects.byId.get(deck.subjectId)
                    ? ` · ${subjects.byId.get(deck.subjectId)?.name}`
                    : ""}
                </p>
              </Link>
              <div className="text-right text-xs" data-testid={`deck-counts-${deck.name}`}>
                <p className="text-accent">{deck.due} p/ revisar</p>
                <p className="text-muted">{deck.fresh} novos</p>
              </div>
              {deck.due + deck.fresh > 0 ? (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => navigate(`/estudar?baralho=${deck.id}`)}
                >
                  Estudar
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled={deck.total === 0}
                  title="Revisar todos os cards sem mudar quando eles voltam"
                  onClick={() => navigate(`/estudar?baralho=${deck.id}&praticar=1`)}
                >
                  Praticar
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={creating} onClose={() => setCreating(false)} title="Novo baralho">
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim()) return;
            const deck = await createDeck(db, { name, subjectId });
            setName("");
            setCreating(false);
            navigate(`/baralhos/${deck.id}`);
          }}
        >
          <Field label="Nome">
            {(id) => (
              <Input id={id} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            )}
          </Field>
          <Field label="Matéria">
            {(id) => <SubjectSelect id={id} value={subjectId} onChange={setSubjectId} />}
          </Field>
          <DialogActions>
            <Button onClick={() => setCreating(false)}>Cancelar</Button>
            <Button type="submit" variant="primary" disabled={!name.trim()}>
              Criar
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
}
