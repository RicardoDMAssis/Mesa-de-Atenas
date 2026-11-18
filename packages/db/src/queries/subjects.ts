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

export async function renameSubject(db: Db, id: string, name: string): Promise<void> {
  await db.update(subjects).set({ name: name.trim() }).where(eq(subjects.id, id));
}

/** Etiqueta no formato usado pelos plugins (`onSubjectTag:anatomia`): minúsculas, sem acento. */
export function normalizeTag(tag: string): string {
  return tag
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Troca as etiquetas da matéria (normalizadas, sem repetição, até 10). */
export async function setSubjectTags(db: Db, id: string, tags: string[]): Promise<void> {
  const clean = [...new Set(tags.map(normalizeTag).filter(Boolean))].slice(0, 10);
  await db.update(subjects).set({ tags: clean }).where(eq(subjects.id, id));
}

/** Etiquetas da matéria e de todas as matérias acima dela. */
export function inheritedTags(
  all: Pick<Subject, "id" | "parentId" | "tags">[],
  subjectId: string | null,
): string[] {
  const byId = new Map(all.map((s) => [s.id, s]));
  const out = new Set<string>();
  const seen = new Set<string>();
  let current = subjectId ? byId.get(subjectId) : undefined;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    for (const tag of current.tags) out.add(tag);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return [...out];
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
