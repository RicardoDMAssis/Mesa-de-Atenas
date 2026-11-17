import { setSetting } from "@estudarella/db";
import { useRef, useState } from "react";
import { Link } from "react-router";
import { Card, PageTitle } from "../components/Card";
import { ConfirmDialog, Select } from "../components/ui";
import { useDatabase } from "../data/DatabaseProvider";
import { ROLLOVER_KEY, useRolloverHour } from "../data/hooks";
import { downloadBackup, restoreBackup } from "../features/backup/backup";
import { type ThemePreference, useThemeStore } from "../stores/theme";

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "Sistema" },
  { value: "light", label: "Claro" },
  { value: "dark", label: "Escuro" },
];

export function Ajustes() {
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);

  return (
    <>
      <PageTitle>Ajustes</PageTitle>
      <div className="grid gap-4">
        <Card title="Tema">
          <fieldset className="flex gap-2">
            <legend className="sr-only">Tema</legend>
            {THEMES.map(({ value, label }) => (
              <label
                key={value}
                className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-lg border px-3 text-sm has-focus-visible:outline-2 has-focus-visible:outline-accent ${
                  preference === value
                    ? "border-accent bg-accent-soft font-medium text-accent"
                    : "border-line text-muted hover:text-fg"
                }`}
              >
                <input
                  type="radio"
                  name="tema"
                  className="sr-only"
                  checked={preference === value}
                  onChange={() => setPreference(value)}
                />
                {label}
              </label>
            ))}
          </fieldset>
        </Card>
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
