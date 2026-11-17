import { describe, expect, it } from "vitest";
import { openDb } from "../client";
import { nodeDriver } from "../testing";
import { createCards, listCards, recordReview } from "./cards";
import { createDeck } from "./decks";
import { graphData } from "./graph";
import { createNote, deleteNote, saveNote } from "./notes";
import {
  activitySince,
  endSession,
  recordFocusSession,
  startReviewSession,
  upcomingDue,
} from "./sessions";
import { createSubject } from "./subjects";

const open = async () => (await openDb(nodeDriver())).db;
const draft = (title: string, linkTargets: string[]) => ({
  title,
  content: {},
  plainText: title,
  linkTargets,
});

describe("graphData", () => {
  it("traz notas, matérias e links sem repetição, ignorando excluídos", async () => {
    const db = await open();
    const letras = await createSubject(db, { name: "Letras" });
    const a = await createNote(db, { title: "A", subjectId: letras.id });
    const b = await createNote(db, { title: "B" });
    const c = await createNote(db, { title: "C" });
    await saveNote(db, a.id, draft("A", [b.id, c.id]));
    await saveNote(db, b.id, draft("B", [a.id]));
    await deleteNote(db, c.id);

    const data = await graphData(db);
    expect(data.notes.map((n) => n.title).sort()).toEqual(["A", "B"]);
    expect(data.subjects.map((s) => s.name)).toEqual(["Letras"]);
    expect(data.links.map((l) => `${l.source}>${l.target}`).sort()).toEqual(
      [`${a.id}>${b.id}`, `${b.id}>${a.id}`].sort(),
    );
  });
});

describe("sessões e atividade", () => {
  it("registra foco e revisão e devolve a atividade por período", async () => {
    const db = await open();
    await recordFocusSession(db, { startedAt: 1_000_000, endedAt: 1_000_000 + 25 * 60_000 });
    const review = await startReviewSession(db, { startedAt: 2_000_000 });
    await endSession(db, review, 2_100_000);

    const deck = await createDeck(db, { name: "D" });
    const state = { srs: {}, due: 0, state: 0, reps: 0, lapses: 0, lastReview: null };
    await createCards(db, deck.id, [{ type: "basic", content: { front: "f", back: "v" } }], state);
    const [card] = await listCards(db, deck.id);
    if (!card) throw new Error("sem card");
    const seen = { ...state, state: 2, due: 5_000_000 };
    await recordReview(db, card.id, seen, { rating: 1, state: 0, reviewedAt: 3_000_000, data: {} });
    await recordReview(db, card.id, seen, { rating: 3, state: 2, reviewedAt: 4_000_000, data: {} });

    const all = await activitySince(db, 0);
    expect(all.focus).toEqual([{ at: 1_000_000 + 25 * 60_000, minutes: 25 }]);
    expect(all.reviews).toEqual([
      { at: 3_000_000, correct: false },
      { at: 4_000_000, correct: true },
    ]);
    expect((await activitySince(db, 3_500_000)).reviews).toHaveLength(1);
    expect(await upcomingDue(db, 6_000_000)).toEqual([5_000_000]);
    expect(await upcomingDue(db, 4_000_000)).toEqual([]);
  });
});
