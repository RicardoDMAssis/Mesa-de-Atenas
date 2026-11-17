import { Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import { PageTitle } from "../components/Card";
import { SubjectSelect } from "../components/SubjectSelect";
import { Button } from "../components/ui";
import { formatClock, phaseLength } from "../features/focus/timer";
import { useFocusTimer } from "../features/focus/useFocusTimer";

const PHASE_LABEL = { focus: "Foco", short: "Pausa curta", long: "Pausa longa" } as const;

export function Foco() {
  const { timer, settings, remaining, start, pause, reset, skip, setSubject } = useFocusTimer();
  const total = phaseLength(timer.phase, settings);
  const progress = 1 - remaining / total;
  const running = timer.status === "running";
  const isFocus = timer.phase === "focus";
  const R = 112;
  const C = 2 * Math.PI * R;

  return (
    <>
      <PageTitle subtitle={`Pausa longa a cada ${settings.longEvery} blocos de foco.`}>
        Foco
      </PageTitle>

      <div className="flex flex-col items-center gap-6">
        <div className="relative size-64">
          <svg viewBox="0 0 256 256" className="size-full -rotate-90" aria-hidden>
            <circle cx="128" cy="128" r={R} fill="none" stroke="var(--border)" strokeWidth="10" />
            <circle
              cx="128"
              cy="128"
              r={R}
              fill="none"
              stroke={isFocus ? "var(--accent)" : "var(--ok)"}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - progress)}
              style={{ transition: "stroke-dashoffset 250ms linear" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-sm text-muted" data-testid="focus-phase">
              {PHASE_LABEL[timer.phase]}
            </p>
            <p
              className="text-5xl font-semibold tabular-nums"
              data-testid="focus-clock"
              role="timer"
              aria-live="off"
            >
              {formatClock(remaining)}
            </p>
            <p className="mt-1 text-xs text-muted" data-testid="focus-round">
              {timer.completed} de {settings.longEvery} na rodada
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="ghost"
            onClick={reset}
            disabled={timer.status === "idle"}
            aria-label="Reiniciar"
            title="Reiniciar"
          >
            <RotateCcw size={18} aria-hidden />
          </Button>
          {running ? (
            <Button variant="primary" className="min-w-36" onClick={pause}>
              <Pause size={18} aria-hidden />
              Pausar
            </Button>
          ) : (
            <Button variant="primary" className="min-w-36" onClick={start}>
              <Play size={18} aria-hidden />
              {timer.status === "paused" ? "Continuar" : isFocus ? "Começar foco" : "Começar pausa"}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={skip}
            aria-label={isFocus ? "Encerrar foco" : "Pular pausa"}
            title={isFocus ? "Encerrar foco (não conta)" : "Pular pausa"}
          >
            <SkipForward size={18} aria-hidden />
          </Button>
        </div>

        <div className="w-full max-w-xs">
          <label className="mb-1.5 block text-sm font-medium" htmlFor="foco-materia">
            Estudando
          </label>
          <SubjectSelect
            id="foco-materia"
            value={timer.subjectId}
            onChange={setSubject}
            emptyLabel="Sem matéria específica"
          />
        </div>
      </div>
    </>
  );
}
