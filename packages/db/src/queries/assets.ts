import { and, eq } from "drizzle-orm";
import type { Db } from "../client";
import { assets } from "../schema";
import { active } from "./base";

/** Registra um arquivo já guardado no armazenamento de arquivos (ignora se o hash já existe). */
export async function registerAsset(
  db: Db,
  file: { hash: string; mime: string; size: number; pluginId?: string },
): Promise<void> {
  const existing = await db.query.assets.findFirst({
    where: and(eq(assets.hash, file.hash), active(assets)),
  });
  if (!existing) await db.insert(assets).values(file);
}

export function listAssets(db: Db) {
  return db.select().from(assets).where(active(assets));
}
