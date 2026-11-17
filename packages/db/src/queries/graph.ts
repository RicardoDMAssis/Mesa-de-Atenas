import { and, eq } from "drizzle-orm";
import type { Db } from "../client";
import { links, notes, subjects } from "../schema";
import { active } from "./base";

export interface GraphData {
  notes: { id: string; title: string; subjectId: string | null }[];
  subjects: { id: string; name: string; parentId: string | null }[];
  /** Pares nota → nota, sem repetição. */
  links: { source: string; target: string }[];
}

/** Tudo o que o mapa de conexões precisa, em três consultas leves. */
export async function graphData(db: Db): Promise<GraphData> {
  const [noteRows, subjectRows, linkRows] = await Promise.all([
    db
      .select({ id: notes.id, title: notes.title, subjectId: notes.subjectId })
      .from(notes)
      .where(active(notes)),
    db
      .select({ id: subjects.id, name: subjects.name, parentId: subjects.parentId })
      .from(subjects)
      .where(active(subjects)),
    db
      .selectDistinct({ source: links.sourceNoteId, target: links.targetNoteId })
      .from(links)
      .innerJoin(notes, and(eq(notes.id, links.targetNoteId), active(notes)))
      .where(active(links)),
  ]);
  const alive = new Set(noteRows.map((n) => n.id));
  return {
    notes: noteRows,
    subjects: subjectRows,
    links: linkRows.filter((l) => alive.has(l.source) && l.source !== l.target),
  };
}
