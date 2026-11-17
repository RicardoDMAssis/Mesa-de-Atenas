import {
  type CustomIntervals,
  customDue,
  DEFAULT_CUSTOM_INTERVALS,
  formatInterval,
} from "@estudarella/core";
import { type DeckSettings, updateDeckSettings } from "@estudarella/db";
import { useEffect, useState } from "react";
import { Button, Dialog, DialogActions, Input, Select } from "../../components/ui";
import { useDatabase } from "../../data/DatabaseProvider";

type Unit = "min" | "h" | "d";
const UNIT_MIN: Record<Unit, number> = { min: 1, h: 60, d: 24 * 60 };
const RATING_ROWS = [
  ["again", "Errei"],
  ["hard", "Difícil"],
  ["good", "Bom"],
  ["easy", "Fácil"],
] as const;
const GROWTH = [
  [1, "Não aumentar (sempre o mesmo)"],
  [1.5, "×1,5 a cada acerto seguido"],
  [2, "×2 a cada acerto seguido"],
  [2.5, "×2,5 a cada acerto seguido"],
  [3, "×3 a cada acerto seguido"],
] as const;

/** Escolhe a unidade mais legível para um valor em minutos. */
function split(minutes: number): { value: number; unit: Unit } {
  if (minutes % UNIT_MIN.d === 0) return { value: minutes / UNIT_MIN.d, unit: "d" };
  if (minutes % UNIT_MIN.h === 0) return { value: minutes / UNIT_MIN.h, unit: "h" };
  return { value: minutes, unit: "min" };
}

type Rows = Record<(typeof RATING_ROWS)[number][0], { value: number; unit: Unit }>;

export function DeckScheduleDialog({
  open,
  onClose,
  deckId,
  settings,
}: {
  open: boolean;
  onClose: () => void;
  deckId: string;
  settings: DeckSettings;
}) {
  const { db } = useDatabase();
  const [mode, setMode] = useState<DeckSettings["mode"]>("auto");
  const [rows, setRows] = useState<Rows>(() => toRows(DEFAULT_CUSTOM_INTERVALS));
  const [growth, setGrowth] = useState(DEFAULT_CUSTOM_INTERVALS.growth);

  useEffect(() => {
    if (!open) return;
    const intervals = settings.intervals ?? DEFAULT_CUSTOM_INTERVALS;
    setMode(settings.mode);
    setRows(toRows(intervals));
    setGrowth(intervals.growth);
  }, [open, settings]);

  const intervals: CustomIntervals = {
    again: rows.again.value * UNIT_MIN[rows.again.unit],
    hard: rows.hard.value * UNIT_MIN[rows.hard.unit],
    good: rows.good.value * UNIT_MIN[rows.good.unit],
    easy: rows.easy.value * UNIT_MIN[rows.easy.unit],
    growth,
  };
  const valid = Object.values(rows).every((r) => Number.isFinite(r.value) && r.value > 0);

  // Exemplo: acertando "Bom" várias vezes seguidas.
  const example = [0, 1, 2, 3].map((streak) =>
    formatInterval(customDue(3, 0, intervals, streak).due),
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Intervalos de revisão"
      description="Quanto tempo o card leva para voltar, conforme a sua resposta."
    >
      <form
        className="grid gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (mode === "custom" && !valid) return;
          await updateDeckSettings(db, deckId, mode === "custom" ? { mode, intervals } : { mode });
          onClose();
        }}
      >
        <fieldset className="grid gap-2">
          <legend className="sr-only">Modo de agendamento</legend>
          {(
            [
              ["auto", "Automático", "O app calcula o melhor momento para cada card (FSRS)."],
              ["custom", "Personalizado", "Você define o tempo para cada resposta."],
            ] as const
          ).map(([value, label, hint]) => (
            <label
              key={value}
              className={`flex cursor-pointer gap-3 rounded-lg border p-3 text-sm ${
                mode === value ? "border-accent bg-accent-soft" : "border-line"
              }`}
            >
              <input
                type="radio"
                name="modo"
                checked={mode === value}
                onChange={() => setMode(value)}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium">{label}</span>
                <span className="block text-muted">{hint}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {mode === "custom" && (
          <>
            <div className="grid gap-2">
              {RATING_ROWS.map(([key, label]) => (
                <div key={key} className="grid grid-cols-[5rem_1fr_6rem] items-center gap-2">
                  <label htmlFor={`int-${key}`} className="text-sm font-medium">
                    {label}
                  </label>
                  <Input
                    id={`int-${key}`}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={Number.isFinite(rows[key].value) ? rows[key].value : ""}
                    onChange={(e) =>
                      setRows({ ...rows, [key]: { ...rows[key], value: e.target.valueAsNumber } })
                    }
                  />
                  <Select
                    aria-label={`Unidade de ${label}`}
                    value={rows[key].unit}
                    onChange={(e) =>
                      setRows({ ...rows, [key]: { ...rows[key], unit: e.target.value as Unit } })
                    }
                  >
                    <option value="min">minutos</option>
                    <option value="h">horas</option>
                    <option value="d">dias</option>
                  </Select>
                </div>
              ))}
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="int-growth" className="text-sm font-medium">
                Ao acertar de novo
              </label>
              <Select
                id="int-growth"
                value={growth}
                onChange={(e) => setGrowth(Number(e.target.value))}
              >
                {GROWTH.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
              {valid && (
                <p className="text-xs text-muted" data-testid="interval-example">
                  Respondendo "Bom" seguidamente: {example.join(" → ")}. "Errei" recomeça a
                  contagem.
                </p>
              )}
            </div>
          </>
        )}

        <DialogActions>
          <Button onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="primary" disabled={mode === "custom" && !valid}>
            Salvar
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

function toRows(i: CustomIntervals): Rows {
  return { again: split(i.again), hard: split(i.hard), good: split(i.good), easy: split(i.easy) };
}
