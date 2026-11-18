import { exportData, importData, isBackupData, listAssets } from "@estudarella/db";
import type { Database } from "../../data/db";

interface BackupFile {
  data: Awaited<ReturnType<typeof exportData>>;
  /** hash → conteúdo em base64. */
  files: Record<string, { mime: string; base64: string }>;
}

const toBase64 = async (blob: Blob) => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
};

const fromBase64 = (base64: string, mime: string) =>
  new Blob([Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))], { type: mime });

const LAST_BACKUP_KEY = "estudarella:ultimoBackup";

/** Quando foi gerado o último backup neste aparelho (ms), ou `null` se nunca. */
export function lastBackupAt(): number | null {
  try {
    const value = Number(localStorage.getItem(LAST_BACKUP_KEY));
    return value > 0 ? value : null;
  } catch {
    return null;
  }
}

/** Gera o arquivo de backup (banco + imagens) e o entrega para download. */
export async function downloadBackup(database: Database): Promise<void> {
  const data = await exportData(database.db);
  const files: BackupFile["files"] = {};
  for (const asset of await listAssets(database.db)) {
    const blob = await database.assets.get(asset.hash);
    if (blob) files[asset.hash] = { mime: asset.mime, base64: await toBase64(blob) };
  }
  const blob = new Blob([JSON.stringify({ data, files } satisfies BackupFile)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `estudarella-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  try {
    localStorage.setItem(LAST_BACKUP_KEY, String(Date.now()));
  } catch {
    // Sem armazenamento local: o mascote só não sabe quando foi o último.
  }
}

/** Restaura um backup, substituindo tudo. As imagens são gravadas antes do banco. */
export async function restoreBackup(database: Database, file: File): Promise<void> {
  let parsed: Partial<BackupFile>;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error("O arquivo não é um backup válido.");
  }
  if (!isBackupData(parsed.data)) throw new Error("Este arquivo não é um backup do Estudarella.");
  for (const { mime, base64 } of Object.values(parsed.files ?? {})) {
    await database.assets.put(fromBase64(base64, mime));
  }
  await importData(database.db, parsed.data);
}
