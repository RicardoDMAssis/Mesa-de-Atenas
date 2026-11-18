import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import type { Db } from "../client";
import { assets } from "../schema";
import { active } from "./base";

/** Registra um arquivo já guardado no armazenamento de arquivos (ignora se o hash já existe). */
export async function registerAsset(
  db: Db,
  file: { hash: string; mime: string; size: number; pluginId?: string },
): Promise<void> {
  // Só compara com imagens: um arquivo de plugin com o mesmo conteúdo tem vida própria
  // (pode ser apagado pelo plugin) e não pode "segurar" a imagem de um card.
  const existing = await db.query.assets.findFirst({
    where: and(eq(assets.hash, file.hash), isNull(assets.name), active(assets)),
  });
  if (!existing) await db.insert(assets).values(file);
}

export function listAssets(db: Db) {
  return db.select().from(assets).where(active(assets));
}

// ---------- arquivos guardados por plugins (Fase 4.1) ----------

export interface PluginFile {
  /** Id do arquivo: o hash do conteúdo. */
  fileId: string;
  name: string;
  mime: string;
  size: number;
  createdAt: number;
}

const filesOf = (pluginId: string) =>
  and(eq(assets.pluginId, pluginId), isNotNull(assets.name), active(assets));

/** Registra um arquivo do plugin. O mesmo conteúdo salvo de novo só troca o nome. */
export async function registerPluginFile(
  db: Db,
  file: { hash: string; mime: string; size: number; pluginId: string; name: string },
): Promise<void> {
  const existing = await db.query.assets.findFirst({
    where: and(filesOf(file.pluginId), eq(assets.hash, file.hash)),
  });
  if (existing) {
    await db
      .update(assets)
      .set({ name: file.name, mime: file.mime })
      .where(eq(assets.id, existing.id));
  } else {
    await db.insert(assets).values(file);
  }
}

export async function listPluginFiles(db: Db, pluginId: string): Promise<PluginFile[]> {
  const rows = await db.select().from(assets).where(filesOf(pluginId)).orderBy(assets.createdAt);
  return rows.map((r) => ({
    fileId: r.hash,
    name: r.name as string,
    mime: r.mime,
    size: r.size,
    createdAt: r.createdAt,
  }));
}

export async function getPluginFile(
  db: Db,
  pluginId: string,
  hash: string,
): Promise<PluginFile | undefined> {
  return (await listPluginFiles(db, pluginId)).find((f) => f.fileId === hash);
}

/** Espaço ocupado pelos arquivos do plugin, em bytes. */
export async function pluginFilesUsage(db: Db, pluginId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${assets.size}), 0)` })
    .from(assets)
    .where(filesOf(pluginId));
  return Number(row?.total ?? 0);
}

/**
 * Apaga o registro do arquivo do plugin. Devolve `true` se mais ninguém usa o mesmo conteúdo
 * (aí o chamador pode apagar os bytes do armazenamento).
 */
export async function removePluginFile(db: Db, pluginId: string, hash: string): Promise<boolean> {
  const now = Date.now();
  await db
    .update(assets)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(filesOf(pluginId), eq(assets.hash, hash)));
  const still = await db.query.assets.findFirst({
    where: and(eq(assets.hash, hash), active(assets)),
  });
  return !still;
}
