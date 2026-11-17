import { eq, inArray } from "drizzle-orm";
import type { Db } from "../client";
import { decks, notes, subjects } from "../schema";
import { active } from "./base";

export type Subject = typeof subjects.$inferSelect;

/** Todas as matérias, tópicos e subtópicos ativos. A árvore é montada por `parentId`. */
export function listSubjects(db: Db): Promise<Subject[]> {
  return db
    .select()
    .from(subjects)
    .where(active(subjects))
    .orderBy(subjects.position, subjects.name);
}

/** Ids de `id` e de tudo que está abaixo dele. */
export function subtreeIds(all: Pick<Subject, "id" | "parentId">[], id: string): string[] {
  const result = [id];
  for (let i = 0; i < result.length; i++) {
    for (const s of all) if (s.parentId === result[i]) result.push(s.id);
  }
  return result;
}

export async function createSubject(
  db: Db,
  input: { name: string; parentId?: string | null },
): Promise<Subject> {
  const [row] = await db
    .insert(subjects)
    .values({ name: input.name.trim(), parentId: input.parentId ?? null })
    .returning();
  if (!row) throw new Error("Não foi possível criar a matéria.");
  return row;
}

export function renameSubject(db: Db, id: string, name: string) {
  return db.update(subjects).set({ name: name.trim() }).where(eq(subjects.id, id));
}

/** Muda de lugar na árvore. Recusa mover para dentro de si mesmo. */
export async function moveSubject(db: Db, id: string, parentId: string | null): Promise<void> {
  if (parentId) {
    const all = await listSubjects(db);
    if (subtreeIds(all, id).includes(parentId)) {
      throw new Error("Não é possível mover uma matéria para dentro dela mesma.");
    }
  }
  await db.update(subjects).set({ parentId }).where(eq(subjects.id, id));
}

/**
 * Exclui a matéria e tudo abaixo dela. Notas e baralhos não são excluídos:
 * ficam "sem matéria".
 */
export async function deleteSubject(db: Db, id: string): Promise<void> {
  const ids = subtreeIds(await listSubjects(db), id);
  const now = Date.now();
  await db.batch([
    db.update(notes).set({ subjectId: null }).where(inArray(notes.subjectId, ids)),
    db.update(decks).set({ subjectId: null }).where(inArray(decks.subjectId, ids)),
    db.update(subjects).set({ deletedAt: now, updatedAt: now }).where(inArray(subjects.id, ids)),
  ]);
}
