import { createNote } from "@estudarella/db";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router";
import { Button } from "../../components/ui";
import { useDatabase } from "../../data/DatabaseProvider";
import { MascotAvatar } from "./MascotAvatar";
import { SpeechBubble } from "./MascotSpeech";
import { useMascot } from "./useMascot";

interface Props {
  /** O que está digitado agora. */
  text: string;
  /** A busca já feita (atrasa um pouco em relação ao texto). */
  query: string;
  results: { kind: "note" | "card" }[] | undefined;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * O mascote na Busca: pensa enquanto você digita, comemora o que encontrou e,
 * quando não acha nada, sugere outras palavras ou criar uma nota com o termo.
 */
export function SearchMascot({ text, query, results }: Props) {
  const active = useMascot();
  const navigate = useNavigate();
  const { db } = useDatabase();
  if (!active) return null;

  const term = query.trim();
  const typing = text.trim() !== term || results === undefined;
  const notes = results?.filter((r) => r.kind === "note").length ?? 0;
  const cards = (results?.length ?? 0) - notes;

  let mood: "idle" | "thinking" | "happy" = "idle";
  let line: string;
  let empty = false;
  if (typing && text.trim()) {
    mood = "thinking";
    line = "Procurando…";
  } else if (!term) {
    line = "O que vamos procurar? Eu olho nas suas notas e nos seus cards.";
  } else if (notes + cards === 0) {
    mood = "thinking";
    empty = true;
    line = `Não achei nada com “${term}”. Tente só o começo da palavra ou outro termo.`;
  } else {
    mood = "happy";
    const parts = [
      notes ? plural(notes, "nota", "notas") : "",
      cards ? plural(cards, "card", "cards") : "",
    ].filter(Boolean);
    line = `Achei ${parts.join(" e ")} com “${term}”!`;
  }

  return (
    <div className="mb-4 flex items-center gap-3" data-testid="search-mascot" data-mood={mood}>
      <MascotAvatar
        definition={active.mascot.definition}
        color={active.color}
        size={56}
        mood={mood}
        // Olha para o campo de busca e para os resultados.
        lookAt={mood === "thinking" ? { x: 0.6, y: 0.5 } : null}
        followPointer
        label={active.persona.name}
      />
      <SpeechBubble className="min-w-0 flex-1">
        <p role="status">{line}</p>
        {empty && (
          <Button
            size="sm"
            className="mt-2"
            onClick={async () => navigate(`/notas/${(await createNote(db, { title: term })).id}`)}
          >
            <Plus size={16} aria-hidden />
            Criar nota “{term}”
          </Button>
        )}
      </SpeechBubble>
    </div>
  );
}
