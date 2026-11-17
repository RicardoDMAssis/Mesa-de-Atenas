import { studyDay } from "@estudarella/core";
import { countReviewsSince, createNote, listDecks, listNotes } from "@estudarella/db";
import { Plus, Search } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { Card, PageTitle } from "../components/Card";
import { Button } from "../components/ui";
import { useDatabase } from "../data/DatabaseProvider";
import { useRolloverHour, useStudyDay } from "../data/hooks";
import { useLiveQuery } from "../data/useLiveQuery";
import { noteLabel } from "../features/notes/titles";

export function Inicio() {
  const { db, info } = useDatabase();
  const navigate = useNavigate();
  const { start, end } = useStudyDay();
  const hour = useRolloverHour();
  const today = new Date(`${studyDay(new Date(), hour)}T12:00:00`).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const decks = useLiveQuery(["decks", "cards"], (db) => listDecks(db, end), [end]);
  const reviewed = useLiveQuery(["review_logs"], (db) => countReviewsSince(db, start), [start]);
  const notes = useLiveQuery(["notes"], listNotes);

  const due = (decks.data ?? []).reduce((n, d) => n + d.due, 0);
  const fresh = (decks.data ?? []).reduce((n, d) => n + d.fresh, 0);
  const recent = (notes.data ?? []).slice(0, 5);

  return (
    <>
      <PageTitle subtitle={today}>Início</PageTitle>
      <div className="grid gap-4">
        {!info.persistent && (
          <Card title="Seus dados não estão sendo salvos">
            <p className="text-sm text-danger">{info.reason}</p>
          </Card>
        )}

        <Card title="Hoje">
          <div className="grid grid-cols-3 gap-2 text-center" data-testid="today">
            {[
              ["Para revisar", due],
              ["Novos", fresh],
              ["Respondidos", reviewed.data ?? 0],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-bg p-3">
                <p className="text-2xl font-semibold">{value}</p>
                <p className="text-xs text-muted">{label}</p>
              </div>
            ))}
          </div>
          <div className="mt-4">
            {due + fresh > 0 ? (
              <Link
                to="/estudar"
                className="flex min-h-11 items-center justify-center rounded-lg bg-accent text-sm font-medium text-accent-fg"
              >
                Estudar agora
              </Link>
            ) : (
              <p className="text-sm text-muted">
                {decks.data?.length ? "Tudo em dia por hoje." : "Crie um baralho em "}
                {!decks.data?.length && (
                  <Link to="/revisao" className="font-medium text-accent">
                    Revisão
                  </Link>
                )}
              </p>
            )}
          </div>
        </Card>

        <Card title="Notas recentes">
          <div className="mb-3 flex gap-2">
            <Button
              size="sm"
              variant="primary"
              onClick={async () => navigate(`/notas/${(await createNote(db)).id}`)}
            >
              <Plus size={16} aria-hidden />
              Nova nota
            </Button>
            <Link
              to="/busca"
              className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-line px-3 text-sm"
            >
              <Search size={16} aria-hidden />
              Buscar
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-muted">Nenhuma nota ainda.</p>
          ) : (
            <ul className="grid gap-1">
              {recent.map((n) => (
                <li key={n.id}>
                  <Link
                    to={`/notas/${n.id}`}
                    className="block truncate py-1 text-sm hover:text-accent"
                  >
                    {noteLabel(n.title)}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
