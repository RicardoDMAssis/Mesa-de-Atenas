import { countReviewsSince, createNote, listDecks, listNotes } from "@estudarella/db";
import { Plus, Search, Timer } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { Card } from "../../components/Card";
import { Button } from "../../components/ui";
import { useDatabase } from "../../data/DatabaseProvider";
import { useStudyDay } from "../../data/hooks";
import { useLiveQuery } from "../../data/useLiveQuery";
import { useScreens } from "../../navigation/screens";
import { StreakCard } from "../../routes/Progresso";
import { formatClock, phaseLength } from "../focus/timer";
import { useFocusTimer } from "../focus/useFocusTimer";
import { noteLabel } from "../notes/titles";
import { useProgress } from "../progress/useProgress";

export function StreakWidget() {
  const progress = useProgress();
  if (!progress) return null;
  return (
    <Link to="/progresso" aria-label="Ver progresso">
      <StreakCard streak={progress.streak} compact />
    </Link>
  );
}

export function TodayWidget() {
  const { start, end } = useStudyDay();
  const decks = useLiveQuery(["decks", "cards"], (db) => listDecks(db, end), [end]);
  const reviewed = useLiveQuery(["review_logs"], (db) => countReviewsSince(db, start), [start]);
  const due = (decks.data ?? []).reduce((n, d) => n + d.due, 0);
  const fresh = (decks.data ?? []).reduce((n, d) => n + d.fresh, 0);
  return (
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
  );
}

export function FocusWidget() {
  const focus = useFocusTimer();
  const progress = useProgress();
  return (
    <Card title="Foco">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-2xl font-semibold tabular-nums">
            {formatClock(
              focus.timer.status === "idle"
                ? phaseLength(focus.timer.phase, focus.settings)
                : focus.remaining,
            )}
          </p>
          <p className="text-xs text-muted">{progress?.today.focusMinutes ?? 0} min de foco hoje</p>
        </div>
        <Link
          to="/foco"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line px-4 text-sm font-medium"
        >
          <Timer size={16} aria-hidden />
          {focus.timer.status === "running"
            ? "Ver timer"
            : focus.timer.phase === "focus"
              ? "Começar foco"
              : "Começar pausa"}
        </Link>
      </div>
    </Card>
  );
}

export function RecentNotesWidget() {
  const { db } = useDatabase();
  const navigate = useNavigate();
  const notes = useLiveQuery(["notes"], listNotes);
  const recent = (notes.data ?? []).slice(0, 5);
  return (
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
              <Link to={`/notas/${n.id}`} className="block truncate py-1 text-sm hover:text-accent">
                {noteLabel(n.title)}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Botões para telas escolhidas pelo usuário (do app ou de plugins). */
export function ShortcutsWidget({ screenIds }: { screenIds: string[] }) {
  const screens = useScreens();
  const chosen = screenIds
    .map((id) => screens.find((s) => s.id === id))
    .filter((s): s is (typeof screens)[number] => Boolean(s));
  return (
    <Card title="Atalhos">
      {chosen.length === 0 ? (
        <p className="text-sm text-muted">
          Nenhuma tela escolhida. Use “Personalizar” para adicionar.
        </p>
      ) : (
        <ul className="grid grid-cols-4 gap-2" aria-label="Atalhos">
          {chosen.map(({ id, to, label, icon: Icon }) => (
            <li key={id}>
              <Link
                to={to}
                className="flex min-h-18 flex-col items-center justify-center gap-1 rounded-xl border border-line p-2 text-center text-xs hover:border-accent"
              >
                <Icon size={20} className="text-accent" aria-hidden />
                <span className="line-clamp-2">{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
