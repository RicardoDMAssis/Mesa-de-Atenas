import type { AvatarMotion } from "open-bot-avatar";
import { useState } from "react";
import { Link } from "react-router";
import { Card } from "../../components/Card";
import { MascotAvatar } from "./MascotAvatar";
import { MascotPanel, SpeechBubble, useMascotMessage } from "./MascotSpeech";
import { useMascot, useStudyContext } from "./useMascot";

/** Widget do Início: o mascote com o recado do dia, a meta e o quiz. */
export function MascotWidget() {
  const active = useMascot();
  const ctx = useStudyContext();
  const { message, show } = useMascotMessage(active, ctx);
  const [quizMood, setQuizMood] = useState<AvatarMotion>();

  if (!active) {
    return (
      <Card title="Mascote">
        <p className="text-sm text-muted">
          Escolha um mascote em{" "}
          <Link to="/ajustes#mascote" className="font-medium text-accent">
            Ajustes
          </Link>{" "}
          para ele lembrar você dos cards e dar dicas de estudo.
        </p>
      </Card>
    );
  }
  if (!message) return null;
  return (
    <section className="rounded-xl border border-line bg-surface p-4 md:p-5" aria-label="Mascote">
      <div className="flex items-start gap-3">
        <MascotAvatar
          definition={active.mascot.definition}
          color={active.color}
          size={88}
          mood={quizMood ?? message.mood}
          followPointer
          label={active.persona.name}
        />
        <SpeechBubble className="min-w-0 flex-1">
          <MascotPanel
            active={active}
            ctx={ctx}
            message={message}
            show={show}
            onMood={setQuizMood}
          />
        </SpeechBubble>
      </div>
    </section>
  );
}
