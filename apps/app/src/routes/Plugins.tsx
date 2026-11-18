import {
  listPluginFiles,
  pluginFilesUsage,
  pluginStorageGet,
  removePlugin,
  removePluginFile,
  setPluginEnabled,
  upsertPlugin,
} from "@estudarella/db";
import { type Manifest, PERMISSION_LABELS } from "@estudarella/plugin-api";
import { FileArchive, Link2, ShieldAlert } from "lucide-react";
import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { PageTitle } from "../components/Card";
import {
  Button,
  ConfirmDialog,
  Dialog,
  DialogActions,
  EmptyState,
  Field,
  Input,
  Menu,
} from "../components/ui";
import { useDatabase } from "../data/DatabaseProvider";
import { useLiveQuery } from "../data/useLiveQuery";
import { HIGHLIGHTS_KEY } from "../plugin-host/highlights";
import {
  deleteInstalled,
  downloadPackage,
  InstallError,
  type PluginPackage,
  readPackage,
  saveInstalled,
} from "../plugin-host/installed";
import { PluginSurface } from "../plugin-host/PluginSurface";
import { iconFor, type LoadedPluginInfo, usePlugins } from "../plugin-host/registry";

const ORIGIN = {
  builtin: "Oficial",
  file: "De arquivo · origem não verificada",
  link: "De link · origem não verificada",
} as const;

type Pending = { pkg: PluginPackage; source: "file" | "link"; url?: string };

export function Plugins() {
  const { db, assets } = useDatabase();
  const navigate = useNavigate();
  const plugins = usePlugins((s) => s.plugins);
  const loaded = usePlugins((s) => s.loaded);
  const [activating, setActivating] = useState<LoadedPluginInfo | null>(null);
  const [settingsOf, setSettingsOf] = useState<LoadedPluginInfo | null>(null);
  const [removing, setRemoving] = useState<LoadedPluginInfo | null>(null);
  const [alsoFiles, setAlsoFiles] = useState(true);
  const removingUsage = useLiveQuery(
    ["assets"],
    (db) => (removing ? pluginFilesUsage(db, removing.manifest.id) : Promise.resolve(0)),
    [removing?.manifest.id],
  );
  const [linkOpen, setLinkOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const prepare = async (
    load: () => Promise<Uint8Array>,
    source: Pending["source"],
    from?: string,
  ) => {
    setError(undefined);
    setBusy(true);
    try {
      const pkg = readPackage(await load());
      const existing = plugins.find((p) => p.manifest.id === pkg.manifest.id);
      if (existing?.record.source === "builtin") {
        throw new InstallError(
          `Já existe um plugin oficial com o identificador “${pkg.manifest.id}”.`,
        );
      }
      setPending({ pkg, source, url: from });
      setLinkOpen(false);
    } catch (e) {
      setError(e instanceof InstallError ? e.message : "Não foi possível ler o plugin.");
    } finally {
      setBusy(false);
    }
  };

  const install = async (enable: boolean) => {
    if (!pending) return;
    const { manifest } = pending.pkg;
    setBusy(true);
    try {
      await saveInstalled(pending.pkg);
      await upsertPlugin(db, {
        pluginId: manifest.id,
        version: manifest.version,
        manifest,
        source: pending.source,
        sourceUrl: pending.url ?? null,
      });
      if (enable) await setPluginEnabled(db, manifest.id, true, manifest.permissions);
      setPending(null);
    } catch (e) {
      setError(e instanceof InstallError ? e.message : "Não foi possível instalar o plugin.");
      setPending(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageTitle subtitle="Ferramentas extras. Cada plugin roda isolado e só acessa o que você permitir.">
          Plugins
        </PageTitle>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => fileInput.current?.click()} disabled={busy}>
            <FileArchive size={16} aria-hidden />
            Instalar de arquivo
          </Button>
          <Button size="sm" onClick={() => setLinkOpen(true)} disabled={busy}>
            <Link2 size={16} aria-hidden />
            De um link
          </Button>
        </div>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept=".zip,application/zip"
        className="sr-only"
        aria-label="Arquivo do plugin (.zip)"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void prepare(async () => new Uint8Array(await file.arrayBuffer()), "file");
        }}
      />
      {error && (
        <p role="alert" className="mb-4 rounded-lg border border-danger/40 p-3 text-sm text-danger">
          {error}
        </p>
      )}

      {!loaded ? null : plugins.length === 0 ? (
        <EmptyState title="Nenhum plugin">Instale um plugin de arquivo ou de um link.</EmptyState>
      ) : (
        <ul className="grid gap-3">
          {plugins.map((p) => {
            const Icon = iconFor(p.manifest.icon);
            const { manifest, record } = p;
            return (
              <li
                key={manifest.id}
                className="rounded-xl border border-line bg-surface p-4"
                data-testid={`plugin-${manifest.id}`}
              >
                <div className="flex items-start gap-3">
                  <Icon size={24} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {manifest.name}{" "}
                      <span className="text-xs font-normal text-muted">v{manifest.version}</span>
                    </p>
                    <p
                      className={`text-xs ${record.source === "builtin" ? "text-muted" : "text-danger"}`}
                    >
                      {ORIGIN[record.source]}
                    </p>
                    {manifest.description && (
                      <p className="mt-1 text-sm text-muted">{manifest.description}</p>
                    )}
                    <PluginUsage plugin={p} />
                  </div>
                  <label className="flex shrink-0 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      role="switch"
                      aria-checked={record.enabled}
                      checked={record.enabled}
                      aria-label={`Ativar ${manifest.name}`}
                      onChange={async (e) => {
                        if (e.target.checked) setActivating(p);
                        else await setPluginEnabled(db, manifest.id, false);
                      }}
                      className="size-5 accent-[var(--accent)]"
                    />
                  </label>
                  <Menu
                    label={`Ações de ${manifest.name}`}
                    items={[
                      ...(record.enabled && manifest.contributes.page
                        ? [{ label: "Abrir", onSelect: () => navigate(`/plugins/${manifest.id}`) }]
                        : []),
                      ...(record.enabled && manifest.contributes.settings
                        ? [{ label: "Configurações", onSelect: () => setSettingsOf(p) }]
                        : []),
                      {
                        label: record.source === "builtin" ? "Apagar dados do plugin" : "Remover",
                        danger: true,
                        onSelect: () => setRemoving(p),
                      },
                    ]}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog
        open={activating !== null}
        onClose={() => setActivating(null)}
        title={`Ativar ${activating?.manifest.name ?? ""}`}
      >
        {activating && (
          <>
            <PermissionSummary
              manifest={activating.manifest}
              unverified={activating.record.source !== "builtin"}
            />
            <DialogActions>
              <Button onClick={() => setActivating(null)}>Cancelar</Button>
              <Button
                variant="primary"
                onClick={async () => {
                  await setPluginEnabled(
                    db,
                    activating.manifest.id,
                    true,
                    activating.manifest.permissions,
                  );
                  setActivating(null);
                }}
              >
                Permitir e ativar
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <Dialog open={linkOpen} onClose={() => setLinkOpen(false)} title="Instalar de um link">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void prepare(() => downloadPackage(url.trim()), "link", url.trim());
          }}
        >
          <Field
            label="Endereço do arquivo .zip"
            hint="Por exemplo, o arquivo de uma versão publicada no GitHub."
          >
            {(id) => (
              <Input
                id={id}
                type="url"
                inputMode="url"
                placeholder="https://"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            )}
          </Field>
          {error && <p className="text-sm text-danger">{error}</p>}
          <DialogActions>
            <Button onClick={() => setLinkOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="primary" disabled={!url.trim() || busy}>
              {busy ? "Baixando…" : "Continuar"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog
        open={pending !== null}
        onClose={() => setPending(null)}
        title={`Instalar ${pending?.pkg.manifest.name ?? ""}`}
        description={pending ? `Versão ${pending.pkg.manifest.version}` : undefined}
      >
        {pending && (
          <>
            {pending.pkg.manifest.description && (
              <p className="mb-3 text-sm">{pending.pkg.manifest.description}</p>
            )}
            <PermissionSummary manifest={pending.pkg.manifest} unverified />
            <DialogActions>
              <Button onClick={() => setPending(null)}>Cancelar</Button>
              <Button onClick={() => install(false)} disabled={busy}>
                Só instalar
              </Button>
              <Button variant="primary" onClick={() => install(true)} disabled={busy}>
                Instalar e ativar
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <Dialog
        open={settingsOf !== null}
        onClose={() => setSettingsOf(null)}
        title={`Configurações · ${settingsOf?.manifest.name ?? ""}`}
      >
        {settingsOf && (
          <div className="h-80 overflow-hidden rounded-lg border border-line">
            <PluginSurface pluginId={settingsOf.manifest.id} surface="settings" />
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={
          removing?.record.source === "builtin"
            ? `Apagar os dados de ${removing.manifest.name}?`
            : `Remover ${removing?.manifest.name ?? ""}?`
        }
        message={
          removing?.record.source === "builtin"
            ? "O plugin é desativado e os dados que ele guardou neste aparelho são apagados."
            : "O plugin e os dados que ele guardou neste aparelho são apagados."
        }
        confirmLabel={removing?.record.source === "builtin" ? "Apagar dados" : "Remover"}
        onConfirm={async () => {
          if (!removing) return;
          const pluginId = removing.manifest.id;
          if (alsoFiles) {
            for (const file of await listPluginFiles(db, pluginId)) {
              if (await removePluginFile(db, pluginId, file.fileId))
                await assets.delete(file.fileId);
            }
          }
          await removePlugin(db, pluginId);
          if (removing.record.source === "builtin") {
            // O oficial continua disponível: volta ao registro, desativado.
            await upsertPlugin(db, {
              pluginId: removing.manifest.id,
              version: removing.manifest.version,
              manifest: removing.manifest,
              source: "builtin",
            });
          } else {
            await deleteInstalled(removing.manifest.id);
          }
        }}
      >
        {(removingUsage.data ?? 0) > 0 && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={alsoFiles}
              onChange={(e) => setAlsoFiles(e.target.checked)}
            />
            Apagar também os arquivos guardados por ele ({formatSize(removingUsage.data ?? 0)})
          </label>
        )}
      </ConfirmDialog>
    </>
  );
}

/** O que o plugin poderá fazer, em linguagem de usuário. */
function PermissionSummary({ manifest, unverified }: { manifest: Manifest; unverified: boolean }) {
  return (
    <div className="grid gap-3 text-sm" data-testid="permission-summary">
      {unverified && (
        <p className="flex gap-2 rounded-lg bg-danger/10 p-3 text-danger">
          <ShieldAlert size={18} className="mt-0.5 shrink-0" aria-hidden />
          Origem não verificada. Instale só plugins de quem você confia. Mesmo assim, ele roda
          isolado e só acessa o que estiver listado abaixo.
        </p>
      )}
      <div>
        <p className="font-medium">O plugin poderá:</p>
        {manifest.permissions.length === 0 ? (
          <p className="text-muted">Nada além de mostrar a própria tela.</p>
        ) : (
          <ul className="mt-1 list-disc pl-5">
            {manifest.permissions.map((perm) => (
              <li key={perm}>{PERMISSION_LABELS[perm]}</li>
            ))}
          </ul>
        )}
      </div>
      {manifest.contributes.mascots.length > 0 && (
        <p>
          Traz {manifest.contributes.mascots.length === 1 ? "o mascote" : "os mascotes"}{" "}
          {manifest.contributes.mascots.map((m) => m.name).join(", ")}, para você escolher em
          Ajustes.
        </p>
      )}
      <div>
        <p className="font-medium">Acesso à internet:</p>
        {manifest.network.length === 0 ? (
          <p className="text-muted">Nenhum. O plugin funciona sem internet.</p>
        ) : (
          <ul className="mt-1 list-disc pl-5">
            {manifest.network.map((origin) => (
              <li key={origin}>{new URL(origin).host}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

const sizeFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${sizeFormat.format(bytes / 1024)} KB`;
  return `${sizeFormat.format(bytes / 1024 / 1024)} MB`;
}

/** O que o plugin guarda e o que ele faz nas notas (Fase 4.1). */
function PluginUsage({ plugin }: { plugin: LoadedPluginInfo }) {
  const id = plugin.manifest.id;
  const files = useLiveQuery(["assets"], async (db) => ({
    count: (await listPluginFiles(db, id)).length,
    size: await pluginFilesUsage(db, id),
  }));
  const rules = useLiveQuery(["plugin_data"], async (db) => {
    const saved = await pluginStorageGet(db, id, HIGHLIGHTS_KEY);
    return Array.isArray(saved) ? saved.length : 0;
  });
  const parts = [
    files.data?.count
      ? `${files.data.count} ${files.data.count === 1 ? "arquivo guardado" : "arquivos guardados"} (${formatSize(files.data.size)})`
      : null,
    plugin.manifest.contributes.highlights && rules.data
      ? `destaca ${rules.data} ${rules.data === 1 ? "termo" : "termos"} nas notas`
      : null,
  ].filter(Boolean);
  if (parts.length === 0) return null;
  return <p className="mt-1 text-xs text-muted">{parts.join(" · ")}</p>;
}
