import { formatInterval, RATINGS, type Rating } from "@estudarella/core";
import {
  type Card,
  dueCards,
  endSession,
  getDeck,
  recordReview,
  startReviewSession,
} from "@estudarella/db";
import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Button, EmptyState } from "../components/ui";
import { useDatabase } from "../data/DatabaseProvider";
import { useStudyDay } from "../data/hooks";
import { CardView } from "../features/cards/CardView";

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
  const { db, scheduler } = useDatabase();
  const { end } = useStudyDay();
  const [queue, setQueue] = useState<Card[] | null>(null);
  const [deckName, setDeckName] = useState<string>();
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState<Record<Rating, number>>({ 1: 0, 2: 0, 3: 0, 4: 0 });
  const shownAt = useRef(Date.now());
  const busy = useRef(false);

  // A fila é montada só ao entrar na sessão (não a cada virada de minuto).
  // biome-ignore lint/correctness/useExhaustiveDependencies: ver acima
  useEffect(() => {
    let cancelled = false;
    dueCards(db, { deckId, cutoff: end }).then((cards) => !cancelled && setQueue(cards));
    if (deckId) getDeck(db, deckId).then((d) => !cancelled && setDeckName(d?.name));
    return () => {
      cancelled = true;
    };
  }, [db, deckId]);

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
  const preview = useMemo(
    () => (card ? scheduler.preview(card, new Date()) : null),
    [card, scheduler],
  );

  useEffect(() => {
    if (card) shownAt.current = Date.now();
  }, [card]);

  const answer = useCallback(
    async (rating: Rating) => {
      if (!card || busy.current) return;
      busy.current = true;
      try {
        const now = new Date();
        session.current ??= {
          id: startReviewSession(db, { startedAt: shownAt.current, deckId: deckId ?? null }),
          last: now.getTime(),
        };
        session.current.last = now.getTime();
        const outcome = scheduler.review(card, rating, now);
        await recordReview(db, card.id, outcome.next, {
          rating,
          state: outcome.previousState,
          reviewedAt: now.getTime(),
          durationMs: Math.min(now.getTime() - shownAt.current, 10 * 60_000),
          data: outcome.log,
        });
        const updated: Card = { ...card, ...outcome.next };
        setQueue((q) => {
          const rest = (q ?? []).slice(1);
          return outcome.next.due <= end ? [...rest, updated] : rest;
        });
        setDone((d) => ({ ...d, [rating]: d[rating] + 1 }));
        setRevealed(false);
      } finally {
        busy.current = false;
      }
    },
    [card, scheduler, db, end, deckId],
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
          <EmptyState
            title={total > 0 ? "Sessão concluída!" : "Nada para revisar agora"}
            action={
              <Link to="/revisao" className="text-sm font-medium text-accent">
                Voltar para os baralhos
              </Link>
            }
          >
            {total > 0
              ? `${total} respostas: ${done[1]} errei, ${done[2]} difícil, ${done[3]} bom, ${done[4]} fácil.`
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
        <span className="text-xs text-muted" data-testid="queue-size">
          {queue.length} restante{queue.length === 1 ? "" : "s"}
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
