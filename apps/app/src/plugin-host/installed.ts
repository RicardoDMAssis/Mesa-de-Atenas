import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { type Manifest, manifestSchema } from "@estudarella/plugin-api";
import { unzipSync } from "fflate";
import { normalizePluginPath, type PluginSource } from "./source";

/*
 * Plugins instalados de arquivo .zip ou de link. Os arquivos ficam na área privada
 * do app no aparelho (OPFS), em `plugins/<id>/`, e são lidos pelo host como os
 * plugins embutidos.
 */

const MAX_ZIP_BYTES = 20 * 1024 * 1024;
const MAX_TOTAL_BYTES = 50 * 1024 * 1024;
const MAX_FILES = 300;

export class InstallError extends Error {}

export interface PluginPackage {
  manifest: Manifest;
  files: Map<string, Uint8Array>;
}

/**
 * Abre e valida um pacote .zip. O manifest.json pode estar na raiz ou dentro de uma
 * única pasta (como em zips gerados pelo GitHub).
 */
export function readPackage(zip: Uint8Array): PluginPackage {
  if (zip.byteLength > MAX_ZIP_BYTES) throw new InstallError("O arquivo passa de 20 MB.");
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(zip);
  } catch {
    throw new InstallError("Não é um arquivo .zip válido.");
  }
  const names = Object.keys(entries).filter((n) => !n.endsWith("/"));
  if (names.length > MAX_FILES) throw new InstallError("O pacote tem arquivos demais.");

  const manifestPath = names
    .filter((n) => n === "manifest.json" || /^[^/]+\/manifest\.json$/.test(n))
    .sort((a, b) => a.length - b.length)[0];
  if (!manifestPath) throw new InstallError("O pacote não tem manifest.json.");
  const prefix = manifestPath.slice(0, -"manifest.json".length);

  let manifest: Manifest;
  try {
    manifest = manifestSchema.parse(
      JSON.parse(new TextDecoder().decode(entries[manifestPath] as Uint8Array)),
    );
  } catch {
    throw new InstallError("O manifest.json é inválido ou é de outra versão do app.");
  }

  const files = new Map<string, Uint8Array>();
  let total = 0;
  for (const name of names) {
    if (!name.startsWith(prefix)) continue;
    let path: string;
    try {
      path = normalizePluginPath(name.slice(prefix.length));
    } catch {
      throw new InstallError(`Caminho inválido no pacote: ${name}`);
    }
    const data = entries[name] as Uint8Array;
    total += data.byteLength;
    if (total > MAX_TOTAL_BYTES) throw new InstallError("O conteúdo passa de 50 MB.");
    files.set(path, data);
  }
  if (!files.has(manifest.entry)) {
    throw new InstallError(`A página de entrada (${manifest.entry}) não está no pacote.`);
  }
  return { manifest, files };
}

/** Baixa um .zip de um link (https). No Android, sem as restrições do navegador. */
export async function downloadPackage(url: string): Promise<Uint8Array> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new InstallError("Endereço inválido.");
  }
  if (parsed.protocol !== "https:") throw new InstallError("Use um endereço https://.");

  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.get({ url: parsed.href, responseType: "arraybuffer" });
    if (res.status < 200 || res.status >= 300)
      throw new InstallError(`Erro ${res.status} ao baixar.`);
    // No Android, conteúdo binário chega em base64.
    const data = res.data as string | ArrayBuffer;
    return typeof data === "string"
      ? Uint8Array.from(atob(data), (c) => c.charCodeAt(0))
      : new Uint8Array(data);
  }
  let res: Response;
  try {
    res = await fetch(parsed.href);
  } catch {
    throw new InstallError(
      "Não foi possível baixar. O site pode não permitir downloads pelo navegador: baixe o arquivo e use “Instalar de arquivo”.",
    );
  }
  if (!res.ok) throw new InstallError(`Erro ${res.status} ao baixar.`);
  return new Uint8Array(await res.arrayBuffer());
}

async function pluginsDir(create: boolean) {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle("plugins", { create });
}

/** Grava os arquivos do pacote, substituindo uma versão anterior do mesmo plugin. */
export async function saveInstalled(pkg: PluginPackage): Promise<void> {
  if (typeof navigator.storage?.getDirectory !== "function") {
    throw new InstallError("Este aparelho não permite guardar plugins.");
  }
  const dir = await pluginsDir(true);
  await dir.removeEntry(pkg.manifest.id, { recursive: true }).catch(() => {});
  const pluginDir = await dir.getDirectoryHandle(pkg.manifest.id, { create: true });
  for (const [path, data] of pkg.files) {
    const parts = path.split("/");
    const fileName = parts.pop() as string;
    let folder = pluginDir;
    for (const part of parts) folder = await folder.getDirectoryHandle(part, { create: true });
    const writable = await (
      await folder.getFileHandle(fileName, { create: true })
    ).createWritable();
    await writable.write(data as unknown as ArrayBuffer);
    await writable.close();
  }
}

export async function deleteInstalled(pluginId: string): Promise<void> {
  try {
    await (await pluginsDir(false)).removeEntry(pluginId, { recursive: true });
  } catch {
    // Nada guardado.
  }
}

/** Lê arquivos de um plugin instalado. */
export function installedSource(pluginId: string): PluginSource {
  const file = async (path: string) => {
    const parts = normalizePluginPath(path).split("/");
    const name = parts.pop() as string;
    let folder = await (await pluginsDir(false)).getDirectoryHandle(pluginId);
    for (const part of parts) folder = await folder.getDirectoryHandle(part);
    return (await folder.getFileHandle(name)).getFile();
  };
  return {
    readText: async (path) => (await file(path)).text(),
    readBytes: async (path) => (await file(path)).arrayBuffer(),
  };
}
