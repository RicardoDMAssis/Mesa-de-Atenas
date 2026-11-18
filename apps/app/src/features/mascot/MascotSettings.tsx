import { setSetting } from "@estudarella/db";
import { Check, Lock } from "lucide-react";
import { Card } from "../../components/Card";
import { Button, Input, Select } from "../../components/ui";
import { useDatabase } from "../../data/DatabaseProvider";
import { DAILY_GOAL_KEY, useDailyGoal } from "../../data/hooks";
import { MASCOT_DEFAULTS, useMascotStore } from "../../stores/mascot";
import { requestNotifyPermission } from "../focus/notify";
import { useHomeLayout } from "../home/layout";
import { MASCOT_WIDGET } from "../home/registry";
import { MascotAvatar } from "./MascotAvatar";
import { useAllMascots } from "./mascots";
import { useBestStreak, useMascot } from "./useMascot";

const GOALS = [10, 20, 30, 50, 100, 200];

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input
        type="checkbox"
        className="mt-0.5"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        {label}
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
}

export function MascotSettings() {
  const prefs = useMascotStore();
  const active = useMascot();
  const all = useAllMascots();
  const best = useBestStreak();
  const { db } = useDatabase();
  const goal = useDailyGoal();
  const onHome = useHomeLayout((s) => s.items.some((i) => i.key === MASCOT_WIDGET));
  const addWidget = useHomeLayout((s) => s.add);
  const removeWidget = useHomeLayout((s) => s.remove);

  const choose = (mascotId: string | null) => {
    // Ao escolher o primeiro mascote, ele também aparece no topo do Início.
    if (mascotId && !prefs.mascotId && !onHome) {
      addWidget({ key: MASCOT_WIDGET });
      const { items } = useHomeLayout.getState();
      useHomeLayout.setState({
        items: [items.at(-1) ?? { key: MASCOT_WIDGET }, ...items.slice(0, -1)],
      });
    }
    // A cor própria era do mascote anterior.
    prefs.set({ mascotId, color: null });
  };

  return (
    <div id="mascote">
      <Card title="Mascote">
        <p className="mb-3 text-sm text-muted">
          Um companheiro que lembra dos cards para revisar, incentiva e dá dicas de estudo.
        </p>
        <fieldset className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          <legend className="sr-only">Mascote</legend>
          {[null, ...all].map((m) => {
            const id = m?.id ?? null;
            const selected = prefs.mascotId === id;
            const locked = Boolean(m?.unlockAt && best < m.unlockAt && !selected);
            return (
              <label
                key={id ?? "nenhum"}
                title={locked ? `Libera com ${m?.unlockAt} dias seguidos de estudo` : undefined}
                className={`grid justify-items-center gap-1 rounded-lg border p-2 text-center text-xs has-focus-visible:outline-2 has-focus-visible:outline-accent ${
                  selected
                    ? "border-accent bg-accent-soft font-medium"
                    : locked
                      ? "cursor-not-allowed border-dashed border-line text-muted"
                      : "cursor-pointer border-line hover:bg-bg"
                }`}
              >
                <input
                  type="radio"
                  name="mascote"
                  className="sr-only"
                  checked={selected}
                  disabled={locked}
                  onChange={() => choose(id)}
                />
                {m ? (
                  <span className="relative">
                    <MascotAvatar
                      definition={m.definition}
                      color={locked ? "#9a9a9a" : selected && prefs.color ? prefs.color : m.color}
                      size={56}
                      mood={selected ? "happy" : "idle"}
                      still={!selected}
                      className={locked ? "opacity-50" : ""}
                    />
                    {locked && (
                      <Lock
                        size={16}
                        aria-hidden
                        className="absolute right-0 bottom-0 rounded-full bg-surface p-0.5"
                      />
                    )}
                  </span>
                ) : (
                  <span className="grid h-14 w-14 place-items-center text-2xl text-muted">—</span>
                )}
                <span className="flex items-center gap-1">
                  {selected && <Check size={12} aria-hidden className="text-accent" />}
                  {m?.name ?? "Nenhum"}
                </span>
                {locked && <span className="text-[11px]">{m?.unlockAt} dias seguidos</span>}
                {m?.plugin && <span className="text-[11px] text-muted">{m.plugin}</span>}
              </label>
            );
          })}
        </fieldset>
        <p className="mt-2 text-xs text-muted">
          Sua melhor sequência: {best} {best === 1 ? "dia" : "dias"}. Mantenha a constância para
          liberar novos mascotes.
        </p>

        {active && (
          <div className="mt-5 grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm" htmlFor="mascote-nome">
                <span className="font-medium">Apelido</span>
                <Input
                  id="mascote-nome"
                  value={prefs.nickname}
                  maxLength={24}
                  placeholder={active.mascot.name}
                  onChange={(e) => prefs.set({ nickname: e.target.value })}
                />
              </label>
              <div className="grid gap-1.5 text-sm">
                <span className="font-medium">Cor</span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    aria-label="Cor do mascote"
                    className="h-11 w-14 cursor-pointer rounded border border-line bg-surface"
                    value={active.color}
                    onChange={(e) => prefs.set({ color: e.target.value })}
                  />
                  {prefs.color && (
                    <Button size="sm" variant="ghost" onClick={() => prefs.set({ color: null })}>
                      Cor original
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-3">
              <Toggle
                label="Ajudar nos estudos no canto da tela"
                hint="Toque no mascote para ver o recado, estudar ou pedir uma dica."
                checked={prefs.companion}
                onChange={(companion) => prefs.set({ companion })}
              />
              <Toggle
                label="Mostrar no Início"
                checked={onHome}
                onChange={(on) =>
                  on ? addWidget({ key: MASCOT_WIDGET }) : removeWidget(MASCOT_WIDGET)
                }
              />
              <Toggle
                label="Lembrar dos cards para revisar"
                hint="Avisa quando há cards vencidos e quando a sequência de dias está em risco."
                checked={prefs.reminders}
                onChange={(reminders) => prefs.set({ reminders })}
              />
              <Toggle
                label="Dar dicas de estudo"
                checked={prefs.tips}
                onChange={(tips) => prefs.set({ tips })}
              />
              <Toggle
                label="Comemorar sessões e conquistas"
                checked={prefs.celebrate}
                onChange={(celebrate) => prefs.set({ celebrate })}
              />
            </div>

            <label className="grid gap-1.5 text-sm" htmlFor="mascote-meta">
              <span className="font-medium">Meta diária</span>
              <Select
                id="mascote-meta"
                className="max-w-48"
                value={goal ?? 0}
                onChange={(e) => setSetting(db, DAILY_GOAL_KEY, Number(e.target.value))}
              >
                <option value={0}>Sem meta</option>
                {GOALS.map((g) => (
                  <option key={g} value={g}>
                    {g} cards por dia
                  </option>
                ))}
              </Select>
              <span className="text-xs text-muted">
                O mascote mostra o progresso e comemora quando você bate a meta.
              </span>
            </label>

            <label className="grid gap-1.5 text-sm" htmlFor="mascote-lembrete">
              <span className="font-medium">Lembrete diário</span>
              <Select
                id="mascote-lembrete"
                className="max-w-48"
                value={prefs.dailyHour ?? ""}
                onChange={async (e) => {
                  const dailyHour = e.target.value === "" ? null : Number(e.target.value);
                  prefs.set({ dailyHour, lastDailyReminder: "" });
                  if (dailyHour !== null) await requestNotifyPermission();
                }}
              >
                <option value="">Desligado</option>
                {Array.from({ length: 17 }, (_, i) => i + 6).map((h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, "0")}:00
                  </option>
                ))}
              </Select>
              <span className="text-xs text-muted">
                No Android, a notificação chega mesmo com o app fechado. No navegador, só com o app
                aberto.
              </span>
            </label>

            <div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => prefs.set({ ...MASCOT_DEFAULTS, mascotId: prefs.mascotId })}
              >
                Restaurar opções do mascote
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
