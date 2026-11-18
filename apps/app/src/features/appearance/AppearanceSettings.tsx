import { Check, ImagePlus, RotateCcw, Trash2 } from "lucide-react";
import { type ReactNode, useRef, useState } from "react";
import { Card } from "../../components/Card";
import { Button, Select } from "../../components/ui";
import { useDatabase } from "../../data/DatabaseProvider";
import { APPEARANCE_DEFAULTS, useAppearanceStore } from "../../stores/appearance";
import { resolveTheme, type ThemePreference, useThemeStore } from "../../stores/theme";
import { removeBackgroundImage, setBackgroundImage, useBackgroundUrl } from "./background";
import { FONTS, findFont, registerFont } from "./fonts";
import { PALETTES, resolveTokens } from "./palettes";

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "Sistema" },
  { value: "light", label: "Claro" },
  { value: "dark", label: "Escuro" },
];

const TEXT_SCALES = [
  { value: 0.9, label: "Pequeno" },
  { value: 1, label: "Normal" },
  { value: 1.12, label: "Grande" },
  { value: 1.25, label: "Maior" },
];

const option = (selected: boolean) =>
  `flex min-h-11 cursor-pointer items-center justify-center rounded-lg border px-3 text-sm has-focus-visible:outline-2 has-focus-visible:outline-accent ${
    selected
      ? "border-accent bg-accent-soft font-medium text-accent"
      : "border-line text-muted hover:text-fg"
  }`;

function Segmented<T extends string | number>({
  name,
  legend,
  value,
  options,
  onChange,
}: {
  name: string;
  legend: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="flex flex-wrap gap-2">
      <legend className="sr-only">{legend}</legend>
      {options.map((o) => (
        <label key={o.value} className={`flex-1 ${option(value === o.value)}`}>
          <input
            type="radio"
            name={name}
            className="sr-only"
            checked={value === o.value}
            onChange={() => onChange(o.value)}
          />
          {o.label}
        </label>
      ))}
    </fieldset>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid gap-2 border-t border-line pt-4 first:border-t-0 first:pt-0">
      <div>
        <h3 className="text-sm font-medium">{title}</h3>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

export function AppearanceSettings() {
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);
  const appearance = useAppearanceStore();
  const changed =
    appearance.palette !== APPEARANCE_DEFAULTS.palette ||
    appearance.customAccent !== null ||
    appearance.font !== APPEARANCE_DEFAULTS.font ||
    appearance.noteFont !== null ||
    appearance.textScale !== 1;

  return (
    <Card title="Aparência">
      <div className="grid gap-5">
        <Section title="Tema">
          <Segmented
            name="tema"
            legend="Tema"
            value={preference}
            options={THEMES}
            onChange={setPreference}
          />
        </Section>
        <PaletteSection />
        <FontSection />
        <Section title="Tamanho do texto">
          <Segmented
            name="tamanho"
            legend="Tamanho do texto"
            value={appearance.textScale}
            options={TEXT_SCALES}
            onChange={(textScale) => appearance.set({ textScale })}
          />
        </Section>
        <BackgroundSection />
        {changed && (
          <div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                // Mantém a imagem de fundo: ela tem botão próprio para remover.
                appearance.set({ ...APPEARANCE_DEFAULTS, background: appearance.background })
              }
            >
              <RotateCcw size={16} aria-hidden />
              Restaurar cores e fontes padrão
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

function PaletteSection() {
  const palette = useAppearanceStore((s) => s.palette);
  const customAccent = useAppearanceStore((s) => s.customAccent);
  const set = useAppearanceStore((s) => s.set);
  const theme = resolveTheme(useThemeStore((s) => s.preference));

  return (
    <Section title="Paleta de cores" hint="Cada paleta tem uma versão clara e uma escura.">
      <fieldset className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <legend className="sr-only">Paleta de cores</legend>
        {PALETTES.map((p) => {
          const t = p[theme];
          const selected = palette === p.id;
          return (
            <label
              key={p.id}
              className={`relative grid cursor-pointer gap-2 rounded-lg border p-2 text-sm has-focus-visible:outline-2 has-focus-visible:outline-accent ${
                selected ? "border-accent ring-1 ring-accent" : "border-line"
              }`}
            >
              <input
                type="radio"
                name="paleta"
                className="sr-only"
                checked={selected}
                onChange={() => set({ palette: p.id })}
              />
              <span
                aria-hidden
                className="flex h-12 items-end gap-1 rounded-md border p-1.5"
                style={{ background: t["--bg"], borderColor: t["--border"] }}
              >
                <span
                  className="h-full flex-1 rounded"
                  style={{ background: t["--surface"], border: `1px solid ${t["--border"]}` }}
                >
                  <span
                    className="mx-1.5 mt-1.5 block h-1 rounded"
                    style={{ background: t["--text"] }}
                  />
                  <span
                    className="mx-1.5 mt-1 block h-1 w-2/3 rounded"
                    style={{ background: t["--muted"] }}
                  />
                </span>
                <span className="h-4 w-4 rounded-full" style={{ background: t["--accent"] }} />
              </span>
              <span className={`flex items-center gap-1 ${selected ? "font-medium" : ""}`}>
                {selected && <Check size={14} aria-hidden className="text-accent" />}
                {p.label}
              </span>
            </label>
          );
        })}
      </fieldset>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="color"
            aria-label="Cor de destaque personalizada"
            className="h-9 w-12 cursor-pointer rounded border border-line bg-surface"
            value={customAccent ?? resolveTokens(palette, null, theme)["--accent"]}
            onChange={(e) => set({ customAccent: e.target.value })}
          />
          <span>Cor de destaque {customAccent ? "personalizada" : "da paleta"}</span>
        </label>
        {customAccent && (
          <Button size="sm" variant="ghost" onClick={() => set({ customAccent: null })}>
            Usar a da paleta
          </Button>
        )}
      </div>
    </Section>
  );
}

function FontSection() {
  const font = useAppearanceStore((s) => s.font);
  const noteFont = useAppearanceStore((s) => s.noteFont);
  const set = useAppearanceStore((s) => s.set);
  // Registra todas para a amostra de cada opção aparecer na própria fonte.
  for (const f of FONTS) registerFont(f);

  return (
    <Section title="Fonte">
      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="sr-only">Fonte do app</legend>
        {FONTS.map((f) => (
          <label
            key={f.id}
            className={`flex min-h-14 cursor-pointer flex-col justify-center rounded-lg border px-3 py-2 has-focus-visible:outline-2 has-focus-visible:outline-accent ${
              font === f.id ? "border-accent bg-accent-soft" : "border-line hover:bg-bg"
            }`}
          >
            <input
              type="radio"
              name="fonte"
              className="sr-only"
              checked={font === f.id}
              onChange={() => set({ font: f.id })}
            />
            <span className="text-base" style={{ fontFamily: f.stack }}>
              {f.label}
            </span>
            {f.hint && <span className="text-xs text-muted">{f.hint}</span>}
          </label>
        ))}
      </fieldset>
      <label className="mt-1 grid gap-1.5 text-sm" htmlFor="fonte-notas">
        <span className="font-medium">Fonte do texto das notas</span>
        <Select
          id="fonte-notas"
          value={noteFont ?? ""}
          onChange={(e) => set({ noteFont: e.target.value || null })}
          className="max-w-72"
        >
          <option value="">Igual à do app ({findFont(font).label})</option>
          {FONTS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </Select>
      </label>
    </Section>
  );
}

function Slider({
  id,
  label,
  value,
  min,
  max,
  unit,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="grid gap-1 text-sm">
      <label htmlFor={id} className="flex justify-between">
        <span>{label}</span>
        <span className="tabular-nums text-muted">
          {value}
          {unit}
        </span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        value={value}
        className="w-full accent-[var(--accent)]"
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function BackgroundSection() {
  const database = useDatabase();
  const background = useAppearanceStore((s) => s.background);
  const setBackground = useAppearanceStore((s) => s.setBackground);
  const preview = useBackgroundUrl(background?.hash);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  return (
    <Section title="Imagem de fundo" hint="Fica só neste aparelho e não entra no backup.">
      {background && preview && (
        <img
          src={preview}
          alt="Imagem de fundo atual"
          className="h-28 w-full rounded-lg border border-line object-cover"
        />
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={busy} onClick={() => input.current?.click()}>
          <ImagePlus size={16} aria-hidden />
          {background ? "Trocar imagem" : "Escolher imagem"}
        </Button>
        {background && (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => removeBackgroundImage(database)}
          >
            <Trash2 size={16} aria-hidden />
            Remover
          </Button>
        )}
        <input
          ref={input}
          type="file"
          accept="image/*"
          className="sr-only"
          aria-label="Arquivo da imagem de fundo"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setBusy(true);
            setError(undefined);
            try {
              await setBackgroundImage(database, file);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Não foi possível usar esta imagem.");
            } finally {
              setBusy(false);
            }
          }}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {background && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Slider
            id="fundo-veu"
            label="Escurecer / clarear"
            value={background.dim}
            min={0}
            max={90}
            unit="%"
            onChange={(dim) => setBackground({ dim })}
          />
          <Slider
            id="fundo-desfoque"
            label="Desfoque"
            value={background.blur}
            min={0}
            max={20}
            unit=" px"
            onChange={(blur) => setBackground({ blur })}
          />
          <Slider
            id="fundo-paineis"
            label="Opacidade dos painéis"
            value={background.panels}
            min={40}
            max={100}
            unit="%"
            onChange={(panels) => setBackground({ panels })}
          />
        </div>
      )}
    </Section>
  );
}
