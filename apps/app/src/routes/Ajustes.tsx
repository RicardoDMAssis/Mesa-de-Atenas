import { Link } from "react-router";
import { Card, PageTitle } from "../components/Card";
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
