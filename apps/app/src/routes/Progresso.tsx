import { Flame } from "lucide-react";
import { Card, PageTitle } from "../components/Card";
import { BarChart } from "../features/progress/BarChart";
import { useProgress } from "../features/progress/useProgress";

export function Progresso() {
  const p = useProgress();
  if (!p) return null;
  const reviews30 = p.reviews30.reduce((n, d) => n + d.value, 0);
  const focus30 = p.focus30.reduce((n, d) => n + d.value, 0);
  const forecast = p.forecast7.reduce((n, d) => n + d.value, 0);

  return (
    <>
      <PageTitle subtitle="Um dia conta quando você responde um card ou conclui um bloco de foco.">
        Progresso
      </PageTitle>
      <div className="grid gap-4">
        <StreakCard streak={p.streak} />

        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat value={reviews30} label="respostas em 30 dias" />
          <Stat
            value={`${Math.floor(focus30 / 60)}h${String(focus30 % 60).padStart(2, "0")}`}
            label="de foco em 30 dias"
          />
          <Stat
            value={p.accuracy30 === null ? "—" : `${Math.round(p.accuracy30 * 100)}%`}
            label="de acerto em 30 dias"
          />
        </div>

        <Card title="Cards respondidos por dia">
          <BarChart data={p.reviews30} unit="respostas" label="Cards respondidos por dia" />
        </Card>
        <Card title="Minutos de foco por dia">
          <BarChart data={p.focus30} unit="min" label="Minutos de foco por dia" color="var(--ok)" />
        </Card>
        <Card title="Próximos 7 dias">
          <p className="-mt-1 mb-3 text-sm text-muted">
            {forecast === 0
              ? "Nenhum card já estudado vence nos próximos dias."
              : `${forecast} cards já estudados vencem até o fim da semana.`}
          </p>
          <BarChart
            data={p.forecast7}
            unit="cards"
            label="Cards a vencer por dia"
            axis="weekdays"
          />
        </Card>
      </div>
    </>
  );
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

export function StreakCard({
  streak,
  compact = false,
}: {
  streak: { current: number; longest: number; studiedToday: boolean };
  compact?: boolean;
}) {
  return (
    <section
      className="flex items-center gap-4 rounded-xl border border-line bg-surface p-4"
      data-testid="streak"
    >
      <Flame
        size={compact ? 28 : 36}
        className={streak.current > 0 ? "text-[#e08a1e]" : "text-muted"}
        aria-hidden
      />
      <div className="min-w-0">
        <p className="text-lg font-semibold">
          {streak.current} {streak.current === 1 ? "dia seguido" : "dias seguidos"}
        </p>
        <p className="text-sm text-muted">
          {streak.studiedToday
            ? "Hoje já conta."
            : streak.current > 0
              ? "Estude hoje para continuar a sequência."
              : "Responda um card ou faça um bloco de foco para começar."}
          {!compact && streak.longest > 0 && ` Maior sequência: ${streak.longest}.`}
        </p>
      </div>
    </section>
  );
}
