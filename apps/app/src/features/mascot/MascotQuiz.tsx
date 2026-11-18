import { RATINGS, type Rating } from "@estudarella/core";
import { type Card, type DeckSettings, deckSettingsMap, dueCards } from "@estudarella/db";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../../components/ui";
import { useDatabase } from "../../data/DatabaseProvider";
import { useStudyDay } from "../../data/hooks";
import { CardView } from "../cards/CardView";
import { answerCard, customIntervals } from "../cards/review";

const LABELS: Record<Rating, string> = { 1: "Errei", 2: "Difícil", 3: "Bom", 4: "Fácil" };

const CHEERS: Record<Rating, string[]> = {
  1: ["Tudo bem, ele volta logo!", "Errar faz parte. Na próxima vai!"],
  2: ["Quase! Mais uma revisão e fica.", "Está chegando lá."],
  3: ["Isso aí!", "Acertou!", "Mandou bem!"],
  4: ["Fácil demais para você!", "Craque!"],
};

/**
 * Quiz rápido dentro do balão do mascote: um card vencido por vez, respondido ali
 * mesmo. As respostas contam como uma revisão normal (agendamento, sequência, meta).
 */
export function MascotQuiz({
  onMood,
  onClose,
}: {
  /** Avisa o humor do mascote a cada resposta. */
  onMood?: (mood: "idle" | "thinking" | "happy") => void;
  onClose: () => void;
}) {
  const database = useDatabase();
  const { end } = useStudyDay();
  const [card, setCard] = useState<Card | null | undefined>(undefined);
  const [revealed, setRevealed] = useState(false);
  const [answered, setAnswered] = useState(0);
  const [cheer, setCheer] = useState<string>();
  const settings = useRef<Map<string, DeckSettings>>(new Map());
  const shownAt = useRef(Date.now());
  const busy = useRef(false);

  const loadNext = useCallback(async () => {
    const [next] = await dueCards(database.db, { cutoff: end, limit: 1 });
    setCard(next ?? null);
    setRevealed(false);
    shownAt.current = Date.now();
  }, [database.db, end]);

  useEffect(() => {
    void deckSettingsMap(database.db).then((map) => {
      settings.current = map;
    });
    void loadNext();
  }, [database.db, loadNext]);

  const answer = async (rating: Rating) => {
    if (!card || busy.current) return;
    busy.current = true;
    try {
      await answerCard(database, card, rating, {
        shownAt: shownAt.current,
        custom: customIntervals(settings.current, card),
      });
      const options = CHEERS[rating];
      setCheer(options[answered % options.length]);
      setAnswered((n) => n + 1);
      onMood?.(rating >= 3 ? "happy" : rating === 1 ? "thinking" : "idle");
      await loadNext();
    } finally {
      busy.current = false;
    }
  };

  if (card === undefined) return null;

  if (card === null) {
    return (
      <div data-testid="mascot-quiz">
        <p role="status">
          {answered > 0
            ? `Fim do quiz: ${answered} ${answered === 1 ? "card respondido" : "cards respondidos"}. Tudo em dia!`
            : "Não há cards para revisar agora. Volte mais tarde!"}
        </p>
        <Button size="sm" className="mt-3" onClick={onClose}>
          Fechar quiz
        </Button>
      </div>
    );
  }

  return (
    <div data-testid="mascot-quiz" className="grid gap-3">
      {cheer && (
        <p role="status" className="text-xs font-medium text-accent">
          {cheer}
        </p>
      )}
      <div className="max-h-60 overflow-y-auto rounded-lg border border-line bg-bg p-3 text-sm">
        <CardView card={card} revealed={revealed} />
      </div>
      {revealed ? (
        <div className="grid grid-cols-4 gap-1">
          {RATINGS.map((r) => (
            <Button key={r} size="sm" className="px-1" onClick={() => answer(r)}>
              {LABELS[r]}
            </Button>
          ))}
        </div>
      ) : (
        <Button size="sm" variant="primary" onClick={() => setRevealed(true)}>
          Mostrar resposta
        </Button>
      )}
      <button
        type="button"
        className="justify-self-start text-xs text-muted hover:text-fg"
        onClick={onClose}
      >
        Parar o quiz
      </button>
    </div>
  );
}
