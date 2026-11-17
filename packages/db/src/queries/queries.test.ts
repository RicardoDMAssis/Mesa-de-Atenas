import { describe, expect, it } from "vitest";
import { openDb } from "../client";
import { links } from "../schema";
import { nodeDriver } from "../testing";
import { exportData, importData } from "./backup";
import {
  countReviewsSince,
  createCards,
  deleteCard,
  dueCards,
  listCards,
  recordReview,
  type Scheduling,
} from "./cards";
import {
  createDeck,
  deckSettingsMap,
  deleteDeck,
  getDeck,
  listDecks,
  updateDeckSettings,
} from "./decks";
import {
  createNote,
  deleteNote,
  getNote,
  listBacklinks,
  listNotes,
  saveNote,
  setNoteSubject,
} from "./notes";
import { buildFtsQuery, listAllSearchable, SNIPPET_CLOSE, SNIPPET_OPEN, search } from "./search";
import { getSetting, setSetting } from "./settings";
import { createSubject, deleteSubject, listSubjects, moveSubject, subtreeIds } from "./subjects";

const open = async () => (await openDb(nodeDriver())).db;
const fresh = (due: number): Scheduling => ({
  srs: { marker: "novo" },
  due,
  state: 0,
  reps: 0,
  lapses: 0,
  lastReview: null,
});
const draft = (title: string, text: string, linkTargets: string[] = []) => ({
  title,
  content: { type: "doc", text },
  plainText: text,
  linkTargets,
});

describe("matérias", () => {
  it("monta a subárvore e recusa ciclos ao mover", async () => {
    const db = await open();
    const letras = await createSubject(db, { name: "Letras" });
    const fono = await createSubject(db, { name: "Fonologia", parentId: letras.id });
    const silaba = await createSubject(db, { name: "Sílaba", parentId: fono.id });
    const all = await listSubjects(db);
    expect(subtreeIds(all, letras.id).sort()).toEqual([letras.id, fono.id, silaba.id].sort());

    await expect(moveSubject(db, letras.id, silaba.id)).rejects.toThrow();
    await moveSubject(db, silaba.id, letras.id);
    expect((await listSubjects(db)).find((s) => s.id === silaba.id)?.parentId).toBe(letras.id);
  });

  it("ao excluir, remove a subárvore e deixa notas e baralhos sem matéria", async () => {
    const db = await open();
    const a = await createSubject(db, { name: "A" });
    const b = await createSubject(db, { name: "B", parentId: a.id });
    const outra = await createSubject(db, { name: "Outra" });
    const note = await createNote(db, { title: "N", subjectId: b.id });
    const deck = await createDeck(db, { name: "D", subjectId: a.id });

    await deleteSubject(db, a.id);
    expect((await listSubjects(db)).map((s) => s.id)).toEqual([outra.id]);
    expect((await getNote(db, note.id))?.subjectId).toBeNull();
    expect((await listDecks(db, Date.now())).find((d) => d.id === deck.id)?.subjectId).toBeNull();
  });
});

describe("notas", () => {
  it("salva e mantém os links iguais ao conteúdo, gravando só a diferença", async () => {
    const db = await open();
    const a = await createNote(db, { title: "A" });
    const b = await createNote(db, { title: "B" });
    const c = await createNote(db, { title: "C" });

    await saveNote(db, a.id, draft("A", "cita b e c", [b.id, c.id, b.id, a.id, "inexistente"]));
    expect((await listBacklinks(db, b.id)).map((n) => n.title)).toEqual(["A"]);
    expect(await listBacklinks(db, a.id)).toEqual([]);
    const afterFirst = await db.select().from(links);
    expect(afterFirst).toHaveLength(2);

    // Salvar de novo sem mudar os links não cria linhas novas.
    await saveNote(db, a.id, draft("A", "cita b e c, de novo", [b.id, c.id]));
    expect(await db.select().from(links)).toHaveLength(2);

    await saveNote(db, a.id, draft("A", "só c", [c.id]));
    expect(await listBacklinks(db, b.id)).toEqual([]);
    expect((await listBacklinks(db, c.id)).map((n) => n.title)).toEqual(["A"]);
  });

  it("lista sem o conteúdo, com trecho, e some ao excluir junto com seus links", async () => {
    const db = await open();
    const a = await createNote(db, { title: "A" });
    const b = await createNote(db, { title: "B" });
    await saveNote(db, a.id, draft("A", "x".repeat(500), [b.id]));
    const [first] = await listNotes(db);
    expect(first?.id).toBe(a.id);
    expect(first?.excerpt).toHaveLength(160);

    await deleteNote(db, a.id);
    expect((await listNotes(db)).map((n) => n.id)).toEqual([b.id]);
    expect(await getNote(db, a.id)).toBeUndefined();
    expect(await listBacklinks(db, b.id)).toEqual([]);
  });
});

describe("baralhos e cards", () => {
  it("conta novos e vencidos por baralho e monta a fila de estudo", async () => {
    const db = await open();
    const deck = await createDeck(db, { name: "Verbos" });
    const vazio = await createDeck(db, { name: "Vazio" });
    await createCards(
      db,
      deck.id,
      [
        { type: "basic", content: { front: "ser", back: "to be" } },
        { type: "basic", content: { front: "ter", back: "to have" } },
        { type: "cloze", content: { text: "{{c1::ir}} embora", index: 1 } },
      ],
      fresh(1000),
    );
    const [c1, c2, c3] = await listCards(db, deck.id);
    if (!c1 || !c2 || !c3) throw new Error("cards não criados");

    // c1 respondido: vence às 5000. c2 respondido: vence só às 99999.
    const seen = (due: number): Scheduling => ({ ...fresh(due), state: 2, reps: 1, lastReview: 1 });
    const log = { rating: 3, state: 0, reviewedAt: 2000, data: {} };
    await recordReview(db, c1.id, seen(5000), log);
    await recordReview(db, c2.id, seen(99999), log);

    const summary = await listDecks(db, 6000);
    expect(summary.find((d) => d.id === deck.id)).toMatchObject({ total: 3, due: 1, fresh: 1 });
    expect(summary.find((d) => d.id === vazio.id)).toMatchObject({ total: 0, due: 0, fresh: 0 });

    // Fila: primeiro o já visto que venceu, depois o novo; o que vence depois fica fora.
    expect((await dueCards(db, { cutoff: 6000 })).map((c) => c.id)).toEqual([c1.id, c3.id]);
    expect(await dueCards(db, { cutoff: 6000, deckId: vazio.id })).toEqual([]);
    expect(await countReviewsSince(db, 1500)).toBe(2);
    expect(await countReviewsSince(db, 2500)).toBe(0);

    await deleteCard(db, c1.id);
    expect((await dueCards(db, { cutoff: 6000 })).map((c) => c.id)).toEqual([c3.id]);
    await deleteDeck(db, deck.id);
    expect(await dueCards(db, { cutoff: 6000 })).toEqual([]);
    expect((await listDecks(db, 6000)).map((d) => d.id)).toEqual([vazio.id]);
  });
});

describe("busca", () => {
  it("monta consultas seguras", () => {
    expect(buildFtsQuery("fonét sil")).toBe('"fonét"* "sil"*');
    expect(buildFtsQuery('  "aspas" AND (x) ')).toBe('"aspas"* "AND"* "x"*');
    expect(buildFtsQuery("  ?! ")).toBeNull();
  });

  it("encontra notas e cards sem diferenciar acentos, por prefixo", async () => {
    const db = await open();
    const deck = await createDeck(db, { name: "D" });
    const note = await createNote(db, { title: "Fonética articulatória" });
    await saveNote(db, note.id, draft("Fonética articulatória", "As consoantes oclusivas."));
    await createCards(
      db,
      deck.id,
      [{ type: "basic", content: { front: "O que é uma oclusiva?", back: "Consoante..." } }],
      fresh(1),
    );

    const byTitle = await search(db, "fonetica");
    expect(byTitle.map((h) => [h.kind, h.id])).toEqual([["note", note.id]]);

    const both = await search(db, "oclus");
    expect(both.map((h) => h.kind).sort()).toEqual(["card", "note"]);
    expect(both.find((h) => h.kind === "note")?.snippet).toContain(
      `${SNIPPET_OPEN}oclusivas${SNIPPET_CLOSE}`,
    );
    expect(both.find((h) => h.kind === "card")?.deckId).toBe(deck.id);

    expect(await search(db, "inexistente")).toEqual([]);
    expect(await search(db, '"')).toEqual([]);
  });

  it("com o campo vazio, lista todas as notas e cards ativos", async () => {
    const db = await open();
    const deck = await createDeck(db, { name: "D" });
    const a = await createNote(db, { title: "A" });
    const b = await createNote(db, { title: "B" });
    await createCards(
      db,
      deck.id,
      [{ type: "basic", content: { front: "f", back: "v" } }],
      fresh(1),
    );
    await deleteNote(db, a.id);
    const all = await listAllSearchable(db);
    expect(all.map((h) => h.kind)).toEqual(["note", "card"]);
    expect(all[0]?.id).toBe(b.id);
    expect(all[1]?.deckId).toBe(deck.id);
  });

  it("acompanha edições e exclusões", async () => {
    const db = await open();
    const note = await createNote(db, { title: "Morfologia" });
    expect(await search(db, "morfologia")).toHaveLength(1);
    await saveNote(db, note.id, draft("Sintaxe", "período composto"));
    expect(await search(db, "morfologia")).toEqual([]);
    expect(await search(db, "periodo")).toHaveLength(1);
    await setNoteSubject(db, note.id, null);
    expect(await search(db, "sintaxe")).toHaveLength(1);
    await deleteNote(db, note.id);
    expect(await search(db, "sintaxe")).toEqual([]);
  });
});

describe("backup", () => {
  it("exporta e restaura tudo em outro banco, inclusive a busca", async () => {
    const db = await open();
    const pai = await createSubject(db, { name: "Pai" });
    const filho = await createSubject(db, { name: "Filho", parentId: pai.id });
    // Deixa o filho "mais antigo" que o pai na ordem de leitura.
    await moveSubject(db, pai.id, null);
    const a = await createNote(db, { title: "A", subjectId: filho.id });
    const b = await createNote(db, { title: "B" });
    await saveNote(db, a.id, draft("A", "texto único", [b.id]));
    const deck = await createDeck(db, { name: "D", subjectId: pai.id });
    await createCards(
      db,
      deck.id,
      [{ type: "basic", content: { front: "f", back: "v", frontImage: "abc" } }],
      fresh(5),
    );
    const data = JSON.parse(JSON.stringify(await exportData(db)));

    const other = await open();
    await createNote(other, { title: "será substituída" });
    await importData(other, data);

    expect((await listNotes(other)).map((n) => n.title).sort()).toEqual(["A", "B"]);
    expect((await listSubjects(other)).map((s) => s.name).sort()).toEqual(["Filho", "Pai"]);
    expect((await listBacklinks(other, b.id)).map((n) => n.id)).toEqual([a.id]);
    const [card] = await listCards(other, deck.id);
    expect(card?.content).toEqual({ front: "f", back: "v", frontImage: "abc" });
    expect(card?.srs).toEqual({ marker: "novo" });
    expect(await search(other, "unico")).toHaveLength(1);
    expect(await search(other, "substituida")).toEqual([]);
  });

  it("recusa arquivos que não são backup e não altera o banco quando a restauração falha", async () => {
    const db = await open();
    await createNote(db, { title: "permanece" });
    await expect(importData(db, { qualquer: "coisa" } as never)).rejects.toThrow();

    const data = await exportData(db);
    data.tables.notes = [{ id: "x", subjectId: "nao-existe", title: "quebrada" }];
    await expect(importData(db, data)).rejects.toThrow();
    expect((await listNotes(db)).map((n) => n.title)).toEqual(["permanece"]);
  });
});

describe("gravações sem await", () => {
  it("executam mesmo quando quem chama não aguarda o resultado", async () => {
    const db = await open();
    const subject = await createSubject(db, { name: "Antes" });
    void setSetting(db, "virada", 6);
    void renameSubjectNoAwait(db, subject.id);
    await new Promise((r) => setTimeout(r, 20));
    expect(await getSetting(db, "virada")).toBe(6);
    expect((await listSubjects(db))[0]?.name).toBe("Depois");
  });
});

function renameSubjectNoAwait(db: Awaited<ReturnType<typeof open>>, id: string) {
  return import("./subjects").then((m) => {
    void m.renameSubject(db, id, "Depois");
  });
}

describe("configuração do baralho", () => {
  it("começa automática e guarda intervalos personalizados", async () => {
    const db = await open();
    const deck = await createDeck(db, { name: "D" });
    expect((await getDeck(db, deck.id))?.settings).toEqual({ mode: "auto" });
    const intervals = { again: 5, hard: 60, good: 1440, easy: 4320, growth: 1.5 };
    await updateDeckSettings(db, deck.id, { mode: "custom", intervals });
    expect((await deckSettingsMap(db)).get(deck.id)).toEqual({ mode: "custom", intervals });
  });
});
