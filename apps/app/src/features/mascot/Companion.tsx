import { BellOff, X } from "lucide-react";
import type { AvatarMotion } from "open-bot-avatar";
import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { IconButton } from "../../components/ui";
import { useMascotEvents, useMascotStore } from "../../stores/mascot";
import { useFocusStore } from "../focus/store";
import { useHomeLayout } from "../home/layout";
import { MASCOT_WIDGET } from "../home/registry";
import { MascotAvatar } from "./MascotAvatar";
import { MascotPanel, SpeechBubble, useMascotMessage } from "./MascotSpeech";
import { useMascot, useStudyContext } from "./useMascot";

const HOUR = 3_600_000;
/** Intervalo mínimo entre dois avisos que o mascote abre sozinho. */
export const NUDGE_EVERY = 2 * HOUR;

/** Telas em que o mascote do canto atrapalharia (ou onde ele já aparece de outro jeito). */
const HIDDEN = [/^\/estudar/, /^\/busca/, /^\/notas\/.+/];

/** Avisos importantes o bastante para o mascote abrir o balão sozinho. */
const NUDGES = new Set(["due", "streak-risk", "welcome", "backup"]);

/** O mascote no canto da tela: lembra dos cards, incentiva, dá dicas e faz quiz. */
export function Companion() {
  const active = useMascot();
  const enabled = useMascotStore((s) => s.companion);
  const { pathname } = useLocation();
  const hidden = !active || !enabled || HIDDEN.some((r) => r.test(pathname));
  if (hidden) return null;
  return <CompanionInner />;
}

function CompanionInner() {
  const active = useMascot();
  const ctx = useStudyContext();
  const { message, show, dismiss } = useMascotMessage(active, ctx);
  const [open, setOpen] = useState(false);
  const [quizMood, setQuizMood] = useState<AvatarMotion>();
  const { pathname } = useLocation();
  // O indicador do timer fica no mesmo canto; o mascote sobe para não cobri-lo.
  const pill = useFocusStore(
    (s) => s.timer.status !== "idle" && !["/", "/foco", "/estudar"].includes(pathname),
  );
  // No Início com o widget do mascote, o recado já está na tela: não repete no canto.
  const onHomeWidget = useHomeLayout(
    (h) => pathname === "/" && h.items.some((i) => i.key === MASCOT_WIDGET),
  );

  // Abre sozinho para avisos importantes, no máximo a cada duas horas e nunca silenciado.
  const nudgeKind = message && NUDGES.has(message.kind) && !onHomeWidget ? message.kind : undefined;
  useEffect(() => {
    if (!nudgeKind) return;
    const { lastNudgeAt, snoozedUntil, set } = useMascotStore.getState();
    const now = Date.now();
    if (now < snoozedUntil || now - lastNudgeAt < NUDGE_EVERY) return;
    const timer = setTimeout(() => {
      setOpen(true);
      set({ lastNudgeAt: Date.now() });
    }, 1200);
    return () => clearTimeout(timer);
  }, [nudgeKind]);

  // Falas de fora (fim de fase do foco, plugins) abrem o balão na hora, se não silenciado.
  const event = useMascotEvents((s) => s.event);
  useEffect(() => {
    if (!event) return;
    useMascotEvents.getState().clear();
    // Uma fala que esperou o mascote voltar à tela (ex.: durante a revisão) perde o sentido.
    const stale = Date.now() - event.at > 10 * 60_000;
    if (stale || Date.now() < useMascotStore.getState().snoozedUntil) return;
    show(event, { sticky: true });
    setOpen(true);
  }, [event, show]);

  if (!active || !message) return null;

  const close = () => {
    setOpen(false);
    setQuizMood(undefined);
    dismiss();
  };
  const restingMood: AvatarMotion = open
    ? message.mood
    : message.kind.endsWith("done")
      ? "happy"
      : "idle";

  return (
    <div
      className={`fixed right-3 z-30 flex flex-col items-end gap-2 md:right-6 ${
        pill
          ? "bottom-[calc(8rem+env(safe-area-inset-bottom))] md:bottom-18"
          : "bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-6"
      }`}
      data-testid="companion"
    >
      {open && (
        <SpeechBubble side="bottom" className="w-80 max-w-[calc(100vw-1.5rem)] shadow-lg">
          <MascotPanel
            active={active}
            ctx={ctx}
            message={message}
            show={show}
            onMood={setQuizMood}
            onLeave={close}
            header={
              <IconButton label="Fechar" className="-m-2" onClick={close}>
                <X size={16} aria-hidden />
              </IconButton>
            }
          />
          <button
            type="button"
            className="mt-1 inline-flex items-center gap-1 text-xs text-muted hover:text-fg"
            onClick={() => {
              const end = new Date();
              end.setHours(23, 59, 59, 999);
              useMascotStore.getState().set({ snoozedUntil: end.getTime() });
              close();
            }}
          >
            <BellOff size={12} aria-hidden />
            Não avisar mais hoje
          </button>
        </SpeechBubble>
      )}
      <button
        type="button"
        aria-label={open ? `Fechar ${active.persona.name}` : `Falar com ${active.persona.name}`}
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
        className="relative rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <MascotAvatar
          definition={active.mascot.definition}
          color={active.color}
          size={64}
          mood={quizMood ?? restingMood}
          followPointer
        />
        {!open && nudgeKind && (
          <span
            aria-hidden
            className="absolute top-1 right-1 h-3 w-3 rounded-full border-2 border-surface bg-danger"
          />
        )}
      </button>
    </div>
  );
}
