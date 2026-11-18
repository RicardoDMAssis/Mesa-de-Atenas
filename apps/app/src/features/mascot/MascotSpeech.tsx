import { createNote } from "@estudarella/db";
import {
  BookOpen,
  CalendarRange,
  Download,
  FileText,
  Layers,
  Lightbulb,
  Plus,
  Sparkles,
  Timer,
} from "lucide-react";
import type { AvatarMotion } from "open-bot-avatar";
import { type ReactNode, useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "../../components/ui";
import { useDatabase } from "../../data/DatabaseProvider";
import { useMascotStore } from "../../stores/mascot";
import { downloadBackup } from "../backup/backup";
import { MascotAvatar } from "./MascotAvatar";
import { MascotQuiz } from "./MascotQuiz";
import {
  type MascotAction,
  type MascotMessage,
  pickMessage,
  randomTip,
  type StudyContext,
  weekMessage,
} from "./messages";
import type { ActiveMascot } from "./useMascot";

export const ACTION_LABEL: Record<MascotAction, { label: string; icon: typeof Timer }> = {
  study: { label: "Estudar agora", icon: BookOpen },
  quiz: { label: "Quiz rápido", icon: Sparkles },
  focus: { label: "Começar foco", icon: Timer },
  tip: { label: "Outra dica", icon: Lightbulb },
  "new-deck": { label: "Criar baralho", icon: Plus },
  "new-note": { label: "Nova nota", icon: Plus },
  "open-deck": { label: "Ver o baralho", icon: Layers },
  "open-note": { label: "Abrir a nota", icon: FileText },
  backup: { label: "Fazer backup", icon: Download },
  week: { label: "Resumo da semana", icon: CalendarRange },
};

interface Override {
  message: MascotMessage;
  /** Tipo de mensagem que estava na tela; a troca vale até a situação mudar. */
  during?: string;
  /** Fica até ser dispensada, mesmo que a situação mude (fim do foco, plugin). */
  sticky?: boolean;
}

/**
 * Mensagem do momento, estável enquanto o contexto não muda de tipo. Uma fala
 * pedida (outra dica, resumo da semana) vale até a situação mudar.
 */
export function useMascotMessage(active: ActiveMascot | undefined, ctx: StudyContext | undefined) {
  const reminders = useMascotStore((s) => s.reminders);
  const tips = useMascotStore((s) => s.tips);
  const celebrate = useMascotStore((s) => s.celebrate);
  const [seed] = useState(Math.random);
  const [override, setOverride] = useState<Override>();

  const base = useMemo(
    () =>
      active && ctx
        ? pickMessage(ctx, active.persona, { reminders, tips, celebrate, random: () => seed })
        : undefined,
    [active, ctx, reminders, tips, celebrate, seed],
  );
  const kind = base?.kind;
  const show = useCallback(
    (message: MascotMessage, options: { sticky?: boolean } = {}) =>
      setOverride({ message, during: kind, sticky: options.sticky }),
    [kind],
  );
  const dismiss = useCallback(() => setOverride(undefined), []);
  const message =
    override && (override.sticky || override.during === kind) ? override.message : base;
  return { message, show, dismiss };
}

/** Barra de progresso da meta diária. */
function GoalBar({ done, goal }: { done: number; goal: number }) {
  const pct = Math.min(100, Math.round((done / goal) * 100));
  return (
    <div className="mt-3" data-testid="goal-bar">
      <div className="mb-1 flex justify-between text-xs text-muted">
        <span>Meta do dia</span>
        <span className="tabular-nums">
          {Math.min(done, goal)}/{goal}
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-bg"
        role="progressbar"
        aria-label="Meta do dia"
        aria-valuemin={0}
        aria-valuemax={goal}
        aria-valuenow={Math.min(done, goal)}
      >
        <div
          className={`h-full rounded-full ${pct >= 100 ? "bg-ok" : "bg-accent"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/**
 * O conteúdo do balão: nome, recado, meta do dia, ações e, quando pedido, o quiz.
 * Usado no widget do Início e no mascote do canto.
 */
export function MascotPanel({
  active,
  ctx,
  message,
  show,
  onMood,
  onLeave,
  header,
}: {
  active: ActiveMascot;
  ctx: StudyContext | undefined;
  message: MascotMessage;
  show: (message: MascotMessage) => void;
  /** Humor do mascote durante o quiz. */
  onMood?: (mood: AvatarMotion | undefined) => void;
  /** Chamado antes de ir para outra tela (ex.: fechar o balão). */
  onLeave?: () => void;
  header?: ReactNode;
}) {
  const navigate = useNavigate();
  const database = useDatabase();
  const [quiz, setQuiz] = useState(false);

  const act = async (action: MascotAction) => {
    if (action === "quiz") return setQuiz(true);
    if (action === "tip") return show(randomTip());
    if (action === "week") return ctx && show(weekMessage(ctx));
    if (action === "backup") {
      await downloadBackup(database);
      return show({
        kind: "tip",
        text: "Backup gerado! Guarde o arquivo fora do aparelho, como num e-mail ou na nuvem.",
        mood: "happy",
        actions: [],
      });
    }
    onLeave?.();
    if (action === "study") navigate("/estudar");
    else if (action === "focus") navigate("/foco");
    else if (action === "new-deck") navigate("/revisao");
    else if (action === "open-deck" && message.target) navigate(`/baralhos/${message.target}`);
    else if (action === "open-note" && message.target) navigate(`/notas/${message.target}`);
    else if (action === "new-note") navigate(`/notas/${(await createNote(database.db)).id}`);
  };

  // Ações secundárias sempre à mão, além das sugeridas pela mensagem.
  const extras = (["tip", "week"] as const).filter((a) => !message.actions.includes(a));

  return (
    <div data-testid="mascot-panel" data-kind={quiz ? "quiz" : message.kind}>
      <div className="mb-0.5 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-accent">
          {message.kind === "plugin" && message.from
            ? `${active.persona.name} · de ${message.from}`
            : active.persona.name}
        </p>
        {header}
      </div>
      {quiz ? (
        <MascotQuiz
          onMood={onMood}
          onClose={() => {
            setQuiz(false);
            onMood?.(undefined);
          }}
        />
      ) : (
        <>
          <p role="status">{message.text}</p>
          {ctx?.goal && <GoalBar done={ctx.reviewedToday} goal={ctx.goal} />}
          {message.actions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {message.actions.map((action, i) => {
                const { label, icon: Icon } = ACTION_LABEL[action];
                return (
                  <Button
                    key={action}
                    size="sm"
                    variant={i === 0 && action !== "tip" ? "primary" : "secondary"}
                    onClick={() => act(action)}
                  >
                    <Icon size={16} aria-hidden />
                    {label}
                  </Button>
                );
              })}
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-x-3">
            {extras.map((action) => (
              <button
                key={action}
                type="button"
                className="min-h-8 text-xs font-medium text-muted hover:text-fg"
                onClick={() => act(action)}
              >
                {action === "tip" ? "Uma dica" : ACTION_LABEL[action].label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Balão de fala. */
export function SpeechBubble({
  children,
  side = "left",
  className = "",
}: {
  children: ReactNode;
  /** Lado em que fica o mascote (o "rabinho" do balão aponta para ele). */
  side?: "left" | "bottom";
  className?: string;
}) {
  return (
    <div
      className={`relative rounded-2xl border border-line bg-surface p-3 text-sm shadow-sm ${className}`}
    >
      <span
        aria-hidden
        className={`absolute h-3 w-3 rotate-45 border-line bg-surface ${
          side === "left"
            ? "top-5 -left-1.5 border-b border-l"
            : "-bottom-1.5 right-8 border-r border-b"
        }`}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

/** Mascote ao lado de uma fala simples, sem ações (comemoração da revisão). */
export function MascotSays({
  active,
  message,
  size = 72,
}: {
  active: ActiveMascot;
  message: MascotMessage;
  size?: number;
}) {
  return (
    <div className="flex items-start gap-3" data-testid="mascot-says" data-kind={message.kind}>
      <MascotAvatar
        definition={active.mascot.definition}
        color={active.color}
        size={size}
        mood={message.mood}
        followPointer
        label={active.persona.name}
      />
      <SpeechBubble className="min-w-0 flex-1">
        <p className="mb-0.5 text-xs font-semibold text-accent">{active.persona.name}</p>
        <p role="status">{message.text}</p>
      </SpeechBubble>
    </div>
  );
}
