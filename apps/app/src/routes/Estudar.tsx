import { formatInterval, RATINGS, type Rating } from "@estudarella/core";
import {
  type Card,
  type DeckSettings,
  deckSettingsMap,
  dueCards,
  endSession,
  getDeck,
  listCards,
  startReviewSession,
} from "@estudarella/db";
import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Button, EmptyState } from "../components/ui";
import { useDatabase } from "../data/DatabaseProvider";
import { useStudyDay } from "../data/hooks";
import { CardView } from "../features/cards/CardView";
import { answerCard, customIntervals } from "../features/cards/review";
import { SessionCelebration, StudyBuddy } from "../features/mascot/StudyMascot";

const LABELS: Record<Rating, string> = { 1: "Errei", 2: "Difícil", 3: "Bom", 4: "Fácil" };
const STYLES: Record<Rating, string> = {
  1: "border-danger text-danger",
  2: "border-line text-fg",
  3: "border-ok text-ok",
  4: "border-accent text-accent",
};

/**
 * Sessão de revisão. A fila é lida uma vez no início; um card que volta a vencer
 * ainda no mesmo dia de estudo (ex.: errado, revisto em 10 min) volta ao fim da fila.
 */
export function Estudar() {
  const [params] = useSearchParams();
  const deckId = params.get("baralho") ?? undefined;
  /** Prática: revisa todos os cards do baralho sem mudar quando eles voltam. */
  const practice = Boolean(deckId) && params.get("praticar") === "1";
  const navigate = useNavigate();
  const [settings, setSettings] = useState<Map<string, DeckSettings>>(new Map());
  const { db, scheduler } = useDatabase();
  const { end } = useStudyDay();
  const [queue, setQueue] = useState<Card[] | null>(null);
  const [deckName, setDeckName] = useState<string>();
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState<Record<Rating, number>>({ 1: 0, 2: 0, 3: 0, 4: 0 });
  /** Última resposta, para o mascote reagir. */
  const [last, setLast] = useState<Rating | null>(null);
  const shownAt = useRef(Date.now());
  const busy = useRef(false);

  // A fila é montada só ao entrar na sessão (não a cada virada de minuto).
  // biome-ignore lint/correctness/useExhaustiveDependencies: ver acima
  useEffect(() => {
    let cancelled = false;
    setQueue(null);
    setDone({ 1: 0, 2: 0, 3: 0, 4: 0 });
    const load =
      practice && deckId
        ? listCards(db, deckId).then(shuffle)
        : dueCards(db, { deckId, cutoff: end });
    load.then((cards) => !cancelled && setQueue(cards));
    deckSettingsMap(db).then((map) => !cancelled && setSettings(map));
    if (deckId) getDeck(db, deckId).then((d) => !cancelled && setDeckName(d?.name));
    return () => {
      cancelled = true;
    };
  }, [db, deckId, practice]);

  // Sessão de revisão: abre na primeira resposta, fecha ao terminar a fila ou sair da tela.
  const session = useRef<{ id: Promise<string>; last: number } | null>(null);
  useEffect(
    () => () => {
      const open = session.current;
      if (open) void open.id.then((sid) => endSession(db, sid, open.last));
    },
    [db],
  );

  const card = queue?.[0];
  /** Intervalos personalizados do baralho do card, se houver. */
  const customFor = useCallback((c: Card) => customIntervals(settings, c), [settings]);
  const preview = useMemo(
    () => (card && !practice ? scheduler.preview(card, new Date(), customFor(card)) : null),
    [card, scheduler, practice, customFor],
  );

  useEffect(() => {
    if (card) shownAt.current = Date.now();
  }, [card]);

  const answer = useCallback(
    async (rating: Rating) => {
      if (!card || busy.current) return;
      busy.current = true;
      try {
        if (practice) {
          // Prática não grava nada; errar devolve o card ao fim da fila.
          setQueue((q) => {
            const rest = (q ?? []).slice(1);
            return rating === 1 ? [...rest, card] : rest;
          });
          setDone((d) => ({ ...d, [rating]: d[rating] + 1 }));
          setLast(rating);
          setRevealed(false);
          return;
        }
        const now = new Date();
        session.current ??= {
          id: startReviewSession(db, { startedAt: shownAt.current, deckId: deckId ?? null }),
          last: now.getTime(),
        };
        session.current.last = now.getTime();
        const updated = await answerCard({ db, scheduler }, card, rating, {
          shownAt: shownAt.current,
          custom: customFor(card),
          now,
        });
        setQueue((q) => {
          const rest = (q ?? []).slice(1);
          return updated.due <= end ? [...rest, updated] : rest;
        });
        setDone((d) => ({ ...d, [rating]: d[rating] + 1 }));
        setLast(rating);
        setRevealed(false);
      } finally {
        busy.current = false;
      }
    },
    [card, scheduler, db, end, deckId, practice, customFor],
  );

  // Atalhos: espaço/enter mostra a resposta; 1–4 respondem.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea")) return;
      if (!revealed && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        setRevealed(true);
      } else if (revealed && ["1", "2", "3", "4"].includes(e.key)) {
        void answer(Number(e.key) as Rating);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [revealed, answer]);

  const total = done[1] + done[2] + done[3] + done[4];
  const back = (
    <Link
      to={deckId ? `/baralhos/${deckId}` : "/revisao"}
      className="inline-flex min-h-9 items-center gap-1.5 text-sm text-muted hover:text-fg"
    >
      <ArrowLeft size={16} aria-hidden />
      {deckName ?? "Revisão"}
    </Link>
  );

  if (queue === null) return null;
  if (!card) {
    return (
      <>
        {back}
        <div className="mt-6">
          <SessionCelebration again={done[1]} total={total} />
          <EmptyState
            title={
              practice
                ? "Prática concluída!"
                : total > 0
                  ? "Sessão concluída!"
                  : "Nada para revisar agora"
            }
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {deckId && (
                  <Button
                    variant={total > 0 ? "secondary" : "primary"}
                    onClick={() => navigate(`/estudar?baralho=${deckId}&praticar=1`)}
                  >
                    {practice ? "Praticar de novo" : "Praticar este baralho"}
                  </Button>
                )}
                <Link
                  to="/revisao"
                  className="inline-flex min-h-11 items-center px-3 text-sm font-medium text-accent"
                >
                  Voltar para os baralhos
                </Link>
              </div>
            }
          >
            {total > 0
              ? `${total} respostas: ${done[1]} errei, ${done[2]} difícil, ${done[3]} bom, ${done[4]} fácil.`
              : deckId
                ? "Nenhum card deste baralho vence agora. Você pode praticar todos mesmo assim, sem mudar quando eles voltam."
                : "Volte mais tarde ou adicione cards novos."}
          </EmptyState>
        </div>
      </>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-10rem)] flex-col">
      <div className="mb-4 flex items-center justify-between">
        {back}
        {practice && (
          <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">
            Prática
          </span>
        )}
        <span className="flex items-center gap-2">
          <span className="text-xs text-muted" data-testid="queue-size">
            {queue.length} restante{queue.length === 1 ? "" : "s"}
          </span>
          <StudyBuddy last={last} />
        </span>
      </div>

      <div className="flex flex-1 items-center justify-center rounded-2xl border border-line bg-surface p-6">
        <div className="w-full">
          <CardView card={card} revealed={revealed} />
        </div>
      </div>

      <div className="sticky bottom-0 bg-bg pt-4 pb-2">
        {!revealed ? (
          <Button variant="primary" className="w-full" onClick={() => setRevealed(true)}>
            Mostrar resposta
          </Button>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {RATINGS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => answer(r)}
                className={`flex min-h-14 flex-col items-center justify-center rounded-xl border-2 bg-surface text-sm font-medium ${STYLES[r]}`}
              >
                {LABELS[r]}
                {preview && (
                  <span className="text-xs font-normal text-muted">
                    {formatInterval(preview[r] - Date.now())}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
        <p className="mt-2 hidden text-center text-xs text-muted md:block">
          Atalhos: espaço mostra a resposta · 1 a 4 respondem
        </p>
      </div>
    </div>
  );
}

/** Embaralha sem alterar a lista original. */
function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}
