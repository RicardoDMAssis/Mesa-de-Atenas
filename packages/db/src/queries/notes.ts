import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import type { Db } from "../client";
import { links, notes } from "../schema";
import { active } from "./base";

export type Note = typeof notes.$inferSelect;

export interface NoteSummary {
  id: string;
  title: string;
  subjectId: string | null;
  updatedAt: number;
  excerpt: string;
}

/** Notas ativas, mais recentes primeiro, sem o conteúdo completo. */
export function listNotes(db: Db): Promise<NoteSummary[]> {
  return db
    .select({
      id: notes.id,
      title: notes.title,
      subjectId: notes.subjectId,
      updatedAt: notes.updatedAt,
      excerpt: sql<string>`substr(${notes.plainText}, 1, 160)`,
    })
    .from(notes)
    .where(active(notes))
    .orderBy(desc(notes.updatedAt));
}

export async function getNote(db: Db, id: string): Promise<Note | undefined> {
  return db.query.notes.findFirst({ where: and(eq(notes.id, id), active(notes)) });
}

export async function createNote(
  db: Db,
  input: {
    title?: string;
    subjectId?: string | null;
    /** Conteúdo inicial (documento do editor) e o texto para a busca. */
    content?: unknown;
    plainText?: string;
  } = {},
): Promise<Note> {
  const [row] = await db
    .insert(notes)
    .values({
      title: input.title?.trim() ?? "",
      subjectId: input.subjectId ?? null,
      ...(input.content !== undefined ? { content: input.content } : {}),
      plainText: input.plainText ?? "",
    })
    .returning();
  if (!row) throw new Error("Não foi possível criar a nota.");
  return row;
}

export interface NoteDraft {
  title: string;
  /** Documento do editor. */
  content: unknown;
  plainText: string;
  /** Ids das notas citadas no conteúdo. */
  linkTargets: string[];
}

/**
 * Salva a nota e mantém a tabela `links` igual ao conteúdo, gravando só a
 * diferença. Tudo em um único lote: nota e links nunca ficam fora de sincronia.
 */
export async function saveNote(db: Db, id: string, draft: NoteDraft): Promise<void> {
  const wanted = [...new Set(draft.linkTargets)].filter((target) => target !== id);
  const [current, existing] = await Promise.all([
    db
      .select({ id: links.id, target: links.targetNoteId })
      .from(links)
      .where(and(eq(links.sourceNoteId, id), eq(links.kind, "link"), active(links))),
    wanted.length > 0
      ? db.select({ id: notes.id }).from(notes).where(inArray(notes.id, wanted))
      : Promise.resolve([]),
  ]);
  const valid = new Set(existing.map((n) => n.id));
  const targets = wanted.filter((target) => valid.has(target));
  const have = new Set(current.map((l) => l.target));
  const removed = current.filter((l) => !targets.includes(l.target)).map((l) => l.id);
  const added = targets.filter((target) => !have.has(target));
  const now = Date.now();

  const update = db
    .update(notes)
    .set({ title: draft.title, content: draft.content, plainText: draft.plainText })
    .where(eq(notes.id, id));
  await db.batch([
    update,
    ...(removed.length > 0
      ? [db.update(links).set({ deletedAt: now, updatedAt: now }).where(inArray(links.id, removed))]
      : []),
    ...(added.length > 0
      ? [
          db
            .insert(links)
            .values(added.map((target) => ({ sourceNoteId: id, targetNoteId: target }))),
        ]
      : []),
  ]);
}

export async function setNoteSubject(db: Db, id: string, subjectId: string | null): Promise<void> {
  await db.update(notes).set({ subjectId }).where(eq(notes.id, id));
}

/** Exclui a nota e os links que saem dela ou chegam nela. */
export async function deleteNote(db: Db, id: string): Promise<void> {
  const now = Date.now();
  await db.batch([
    db.update(notes).set({ deletedAt: now, updatedAt: now }).where(eq(notes.id, id)),
    db
      .update(links)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(or(eq(links.sourceNoteId, id), eq(links.targetNoteId, id)), active(links))),
  ]);
}

/** Notas que citam `id` ("notas que apontam para esta"). */
export function listBacklinks(db: Db, id: string): Promise<{ id: string; title: string }[]> {
  return db
    .selectDistinct({ id: notes.id, title: notes.title })
    .from(links)
    .innerJoin(notes, eq(notes.id, links.sourceNoteId))
    .where(and(eq(links.targetNoteId, id), active(links), active(notes)))
    .orderBy(notes.title);
}

/** Id e título de todas as notas — para sugerir links e exibir o título atual de cada link. */
export function listNoteTitles(db: Db): Promise<{ id: string; title: string }[]> {
  return db
    .select({ id: notes.id, title: notes.title })
    .from(notes)
    .where(active(notes))
    .orderBy(desc(notes.updatedAt));
}
