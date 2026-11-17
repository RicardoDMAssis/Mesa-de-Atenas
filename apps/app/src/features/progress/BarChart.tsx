import type { DayPoint } from "@estudarella/core";

const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "short" });
const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" });
const parse = (day: string) => new Date(`${day}T12:00:00`);

/**
 * Gráfico de barras simples em SVG, com as cores do tema. Cada barra tem um
 * título (dica ao passar o mouse e leitura por leitores de tela).
 */
export function BarChart({
  data,
  unit,
  label,
  color = "var(--accent)",
  axis = "dates",
}: {
  data: DayPoint[];
  unit: string;
  label: string;
  color?: string;
  /** "dates": primeira e última data; "weekdays": dia da semana em cada barra. */
  axis?: "dates" | "weekdays";
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const W = 300;
  const H = 96;
  const gap = data.length > 10 ? 2 : 6;
  const bar = (W - gap * (data.length - 1)) / data.length;
  const total = data.reduce((n, d) => n + d.value, 0);

  return (
    <figure>
      <svg
        viewBox={`0 0 ${W} ${H + (axis === "weekdays" ? 16 : 0)}`}
        className="w-full"
        role="img"
        aria-label={`${label}: ${total} ${unit} no período`}
      >
        <line x1="0" x2={W} y1={H} y2={H} stroke="var(--border)" />
        {data.map((d, i) => {
          const h = d.value === 0 ? 0 : Math.max(3, (d.value / max) * (H - 4));
          return (
            <g key={d.day}>
              <rect
                x={i * (bar + gap)}
                y={H - h}
                width={bar}
                height={h}
                rx={Math.min(3, bar / 2)}
                fill={color}
              >
                <title>{`${shortDate.format(parse(d.day))}: ${d.value} ${unit}`}</title>
              </rect>
              {axis === "weekdays" && (
                <text
                  x={i * (bar + gap) + bar / 2}
                  y={H + 13}
                  textAnchor="middle"
                  fontSize="10"
                  fill="var(--muted)"
                >
                  {i === 0 ? "hoje" : weekday.format(parse(d.day)).replace(".", "")}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {axis === "dates" && data.length > 0 && (
        <figcaption className="mt-1 flex justify-between text-xs text-muted">
          <span>{shortDate.format(parse(data[0]?.day ?? ""))}</span>
          <span>hoje</span>
        </figcaption>
      )}
    </figure>
  );
}
