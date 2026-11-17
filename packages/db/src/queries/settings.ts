import { and, eq } from "drizzle-orm";
import type { Db } from "../client";
import { settings } from "../schema";
import { active } from "./base";

/**
 * Preferências de estudo, que acompanham o usuário entre aparelhos (ex.: hora de
 * virada do dia, limite de cards novos). Preferências do aparelho — tema, tamanho
 * de fonte — não ficam aqui: vivem no armazenamento local de cada dispositivo.
 */
export async function getSetting<T>(db: Db, key: string): Promise<T | undefined> {
  const row = await db.query.settings.findFirst({
    where: and(eq(settings.key, key), active(settings)),
  });
  return row?.value as T | undefined;
}

/** Cria ou atualiza. */
export async function setSetting(db: Db, key: string, value: unknown): Promise<void> {
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value, updatedAt: Date.now(), deletedAt: null },
    });
}
