import { setSetting } from "@estudarella/db";
import { useRef, useState } from "react";
import { Link } from "react-router";
import { Card, PageTitle } from "../components/Card";
import { ConfirmDialog, Select } from "../components/ui";
import { useDatabase } from "../data/DatabaseProvider";
import { ROLLOVER_KEY, useRolloverHour } from "../data/hooks";
import { AppearanceSettings } from "../features/appearance/AppearanceSettings";
import { downloadBackup, restoreBackup } from "../features/backup/backup";
import { requestNotifyPermission } from "../features/focus/notify";
import { useFocusStore } from "../features/focus/store";
import { MascotSettings } from "../features/mascot/MascotSettings";

export function Ajustes() {
  return (
    <>
      <PageTitle>Ajustes</PageTitle>
      <div className="grid gap-4">
        <AppearanceSettings />
        <MascotSettings />
        <EstudoEBackup />
        <Card title="Diagnóstico">
          <p className="text-sm text-muted">
            Verifica o banco de dados local e o isolamento dos plugins neste aparelho.
          </p>
          <Link
            to="/ajustes/diagnostico"
            className="mt-3 inline-block text-sm font-medium text-accent"
          >
            Abrir diagnóstico
          </Link>
        </Card>
      </div>
    </>
  );
}

function EstudoEBackup() {
  const database = useDatabase();
  const hour = useRolloverHour();
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<File | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();
  const [busy, setBusy] = useState(false);

  return (
    <>
      <Card title="Estudo">
        <label className="grid gap-1.5 text-sm" htmlFor="virada">
          <span className="font-medium">O dia de estudo vira às</span>
          <Select
            id="virada"
            value={hour}
            onChange={(e) => setSetting(database.db, ROLLOVER_KEY, Number(e.target.value))}
            className="max-w-40"
          >
            {Array.from({ length: 13 }, (_, h) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: a hora é o próprio valor
              <option key={h} value={h}>
                {String(h).padStart(2, "0")}:00
              </option>
            ))}
          </Select>
          <span className="text-xs text-muted">
            Revisões feitas antes desse horário contam para o dia anterior.
          </span>
        </label>
      </Card>
      <TimerSettingsCard />
      <Card title="Backup">
        <p className="text-sm text-muted">
          Um arquivo com todas as notas, cards, imagens e histórico. Guarde-o fora do aparelho.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            className="min-h-11 rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg disabled:opacity-50"
            onClick={async () => {
              setBusy(true);
              try {
                await downloadBackup(database);
                setMessage({ ok: true, text: "Backup gerado." });
              } finally {
                setBusy(false);
              }
            }}
          >
            Exportar backup
          </button>
          <button
            type="button"
            disabled={busy}
            className="min-h-11 rounded-lg border border-line px-4 text-sm font-medium"
            onClick={() => input.current?.click()}
          >
            Restaurar backup
          </button>
          <input
            ref={input}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label="Arquivo de backup"
            onChange={(e) => {
              setPending(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
        </div>
        {message && (
          <p role="status" className={`mt-3 text-sm ${message.ok ? "text-ok" : "text-danger"}`}>
            {message.text}
          </p>
        )}
      </Card>
      <ConfirmDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        title="Restaurar este backup?"
        message="Tudo o que está no app agora será substituído pelo conteúdo do arquivo."
        confirmLabel="Restaurar"
        onConfirm={async () => {
          if (!pending) return;
          setBusy(true);
          try {
            await restoreBackup(database, pending);
            setMessage({ ok: true, text: "Backup restaurado." });
          } catch (err) {
            setMessage({
              ok: false,
              text: err instanceof Error ? err.message : "Falha ao restaurar.",
            });
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}

function TimerSettingsCard() {
  const settings = useFocusStore((s) => s.settings);
  const setSettings = useFocusStore((s) => s.setSettings);
  const notify = useFocusStore((s) => s.notify);
  const setNotify = useFocusStore((s) => s.setNotify);
  const fields = [
    ["focusMinutes", "Foco (min)", 5, 120],
    ["shortMinutes", "Pausa curta (min)", 1, 30],
    ["longMinutes", "Pausa longa (min)", 5, 60],
    ["longEvery", "Pausa longa a cada", 2, 8],
  ] as const;
  return (
    <Card title="Timer de foco">
      <div className="grid grid-cols-2 gap-3">
        {fields.map(([key, label, min, max]) => (
          <div key={key} className="grid gap-1.5 text-sm">
            <label htmlFor={`timer-${key}`} className="font-medium">
              {label}
            </label>
            <Select
              id={`timer-${key}`}
              value={settings[key]}
              onChange={(e) => setSettings({ [key]: Number(e.target.value) })}
            >
              {Array.from({ length: max - min + 1 }, (_, i) => min + i)
                .filter((v) => key === "longEvery" || v <= 10 || v % 5 === 0)
                .map((v) => (
                  <option key={v} value={v}>
                    {key === "longEvery" ? `${v} focos` : v}
                  </option>
                ))}
            </Select>
          </div>
        ))}
      </div>
      <label className="mt-4 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={notify}
          onChange={async (e) => {
            const on = e.target.checked;
            setNotify(on);
            if (on) await requestNotifyPermission();
          }}
        />
        Avisar quando o foco ou a pausa terminar
      </label>
      <p className="mt-1 text-xs text-muted">As novas durações valem a partir do próximo bloco.</p>
    </Card>
  );
}
