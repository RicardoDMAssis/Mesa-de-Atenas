import type { Rating } from "@estudarella/core";
import { useMemo } from "react";
import { useMascotStore } from "../../stores/mascot";
import { MascotAvatar } from "./MascotAvatar";
import { MascotSays } from "./MascotSpeech";
import { sessionMessage } from "./messages";
import { useMascot } from "./useMascot";

/** Mascote pequeno no topo da revisão, reagindo à última resposta. */
export function StudyBuddy({ last }: { last: Rating | null }) {
  const active = useMascot();
  if (!active) return null;
  const mood = last === null ? "idle" : last === 1 ? "thinking" : last >= 3 ? "happy" : "idle";
  return (
    <span data-testid="study-buddy" data-mood={mood}>
      <MascotAvatar
        definition={active.mascot.definition}
        color={active.color}
        size={40}
        mood={mood}
        label=""
      />
    </span>
  );
}

/** Comemoração no fim da sessão, com o tom ajustado ao desempenho. */
export function SessionCelebration({ again, total }: { again: number; total: number }) {
  const active = useMascot();
  const celebrate = useMascotStore((s) => s.celebrate);
  const persona = active?.persona;
  const message = useMemo(
    () => (persona ? sessionMessage({ again, total }, persona) : undefined),
    [persona, again, total],
  );
  if (!active || !message || !celebrate || total === 0) return null;
  return (
    <div className="mb-6">
      <MascotSays active={active} message={message} size={80} />
    </div>
  );
}
