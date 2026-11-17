import { and, eq } from "drizzle-orm";
import type { Db } from "../client";
import { pluginData, plugins } from "../schema";
import { active } from "./base";

export type PluginRecord = typeof plugins.$inferSelect;

/** Plugins conhecidos neste aparelho (instalados ou oficiais já vistos). */
export function listPluginRecords(db: Db): Promise<PluginRecord[]> {
  return db.select().from(plugins).where(active(plugins));
}

/** Cria ou atualiza o registro de um plugin (mantém ativação e permissões já concedidas). */
export async function upsertPlugin(
  db: Db,
  input: {
    pluginId: string;
    version: string;
    manifest: unknown;
    source: PluginRecord["source"];
    sourceUrl?: string | null;
    enabled?: boolean;
  },
): Promise<void> {
  const existing = await db.query.plugins.findFirst({
    where: eq(plugins.pluginId, input.pluginId),
  });
  if (existing) {
    await db
      .update(plugins)
      .set({
        version: input.version,
        manifest: input.manifest,
        source: input.source,
        sourceUrl: input.sourceUrl ?? null,
        deletedAt: null,
      })
      .where(eq(plugins.id, existing.id));
    return;
  }
  await db.insert(plugins).values({
    pluginId: input.pluginId,
    version: input.version,
    manifest: input.manifest,
    source: input.source,
    sourceUrl: input.sourceUrl ?? null,
    enabled: input.enabled ?? false,
    grantedPermissions: [],
  });
}

/** Ativa (com as permissões aprovadas pelo usuário) ou desativa. */
export async function setPluginEnabled(
  db: Db,
  pluginId: string,
  enabled: boolean,
  grantedPermissions?: string[],
): Promise<void> {
  await db
    .update(plugins)
    .set(grantedPermissions ? { enabled, grantedPermissions } : { enabled })
    .where(eq(plugins.pluginId, pluginId));
}

/** Remove o plugin e apaga os dados guardados por ele. */
export async function removePlugin(db: Db, pluginId: string): Promise<void> {
  const now = Date.now();
  await db.batch([
    db
      .update(plugins)
      .set({ deletedAt: now, updatedAt: now, enabled: false, grantedPermissions: [] })
      .where(eq(plugins.pluginId, pluginId)),
    db
      .update(pluginData)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(pluginData.pluginId, pluginId), active(pluginData))),
  ]);
}

// ---- Armazenamento chave-valor de cada plugin ----

export async function pluginStorageGet(
  db: Db,
  pluginId: string,
  key: string,
): Promise<unknown | undefined> {
  const row = await db.query.pluginData.findFirst({
    where: and(eq(pluginData.pluginId, pluginId), eq(pluginData.key, key), active(pluginData)),
  });
  return row?.value ?? undefined;
}

export async function pluginStorageSet(
  db: Db,
  pluginId: string,
  key: string,
  value: unknown,
): Promise<void> {
  await db
    .insert(pluginData)
    .values({ pluginId, key, value })
    .onConflictDoUpdate({
      target: [pluginData.pluginId, pluginData.key],
      set: { value, updatedAt: Date.now(), deletedAt: null },
    });
}

export async function pluginStorageDelete(db: Db, pluginId: string, key: string): Promise<void> {
  const now = Date.now();
  await db
    .update(pluginData)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(pluginData.pluginId, pluginId), eq(pluginData.key, key)));
}

export async function pluginStorageKeys(db: Db, pluginId: string): Promise<string[]> {
  const rows = await db
    .select({ key: pluginData.key })
    .from(pluginData)
    .where(and(eq(pluginData.pluginId, pluginId), active(pluginData)));
  return rows.map((r) => r.key);
}
