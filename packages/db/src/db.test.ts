import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { writtenTable } from "./changes";
import { openDb } from "./client";
import { migrate } from "./migrate";
import { migrations } from "./migrations.generated";
import { active, softDelete } from "./queries/base";
import { getSetting, setSetting } from "./queries/settings";
import { decks, notes, settings, subjects } from "./schema";
import { nodeDriver } from "./testing";

describe("migrate", () => {
  it("aplica as migrações uma única vez", async () => {
    const driver = nodeDriver();
    expect(await migrate(driver, migrations)).toEqual(migrations.map((m) => m.id));
    expect(await migrate(driver, migrations)).toEqual([]);
  });

  it("desfaz por inteiro uma migração que falha", async () => {
    const driver = nodeDriver();
    const broken = {
      id: "9999_quebrada",
      sql: "CREATE TABLE ok_antes (id TEXT);--> statement-breakpoint\nISSO NAO E SQL;",
    };
    await expect(migrate(driver, [broken])).rejects.toThrow("9999_quebrada");
    const tables = await driver.query(
      "SELECT name FROM sqlite_master WHERE name = 'ok_antes'",
      [],
      "all",
    );
    expect(tables).toEqual([]);
    expect(await driver.query("SELECT id FROM __migrations", [], "all")).toEqual([]);
  });
});

describe("schema", () => {
  it("preenche id (UUID v7) e datas automaticamente", async () => {
    const { db } = await openDb(nodeDriver());
    const before = Date.now();
    await db.insert(subjects).values({ name: "Linguística" });
    const [row] = await db.select().from(subjects);
    expect(row?.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-/);
    expect(row?.createdAt).toBeGreaterThanOrEqual(before);
    expect(row?.deletedAt).toBeNull();
    expect(row?.tags).toEqual([]);
  });

  it("devolve undefined quando não encontra", async () => {
    const { db } = await openDb(nodeDriver());
    expect(await db.query.settings.findFirst({ where: eq(settings.key, "x") })).toBeUndefined();
  });

  it("recusa referência a registro inexistente", async () => {
    const { db } = await openDb(nodeDriver());
    await expect(db.insert(notes).values({ subjectId: "nao-existe" })).rejects.toThrow();
    await expect(db.insert(decks).values({ name: "Sem matéria" })).resolves.toBeDefined();
  });
});

describe("batch", () => {
  it("grava tudo de uma vez", async () => {
    const { db } = await openDb(nodeDriver());
    await db.batch([
      db.insert(subjects).values({ name: "Fonologia" }),
      db.insert(subjects).values({ name: "Morfologia" }),
    ]);
    expect(await db.select().from(subjects)).toHaveLength(2);
  });

  it("não grava nada quando uma das instruções falha", async () => {
    const { db } = await openDb(nodeDriver());
    await expect(
      db.batch([
        db.insert(subjects).values({ name: "Sintaxe" }),
        db.insert(notes).values({ subjectId: "nao-existe" }),
      ]),
    ).rejects.toThrow();
    expect(await db.select().from(subjects)).toEqual([]);
  });
});

describe("queries", () => {
  it("setSetting cria, atualiza e renova updated_at", async () => {
    const { db } = await openDb(nodeDriver());
    await db.insert(settings).values({ key: "dia.virada", value: 4, updatedAt: 1 });
    await setSetting(db, "dia.virada", 5);
    await setSetting(db, "cards.novos", 20);
    expect(await getSetting(db, "dia.virada")).toBe(5);
    expect(await getSetting(db, "cards.novos")).toBe(20);
    expect(await getSetting(db, "nao.existe")).toBeUndefined();
    const row = await db.query.settings.findFirst({ where: eq(settings.key, "dia.virada") });
    expect(row?.updatedAt).toBeGreaterThan(1);
  });

  it("softDelete esconde o registro sem apagá-lo", async () => {
    const { db } = await openDb(nodeDriver());
    const [created] = await db.insert(subjects).values({ name: "Semântica" }).returning();
    if (!created) throw new Error("insert sem retorno");
    await softDelete(db, subjects, created.id);
    expect(await db.select().from(subjects).where(active(subjects))).toEqual([]);
    const [raw] = await db.select().from(subjects);
    expect(raw?.deletedAt).toBeTypeOf("number");
  });
});

describe("avisos de alteração", () => {
  it("identifica a tabela escrita", () => {
    expect(writtenTable('insert into "notes" ("id") values (?)')).toBe("notes");
    expect(writtenTable('update "cards" set "due" = ?')).toBe("cards");
    expect(writtenTable('delete from "links" where "id" = ?')).toBe("links");
    expect(writtenTable('select * from "notes"')).toBeUndefined();
    expect(writtenTable("with x as (select 1) insert into notes select * from x")).toBe("*");
  });

  it("avisa só quem observa a tabela alterada, inclusive em lote", async () => {
    const { db, changes } = await openDb(nodeDriver());
    const onSubjects = vi.fn();
    const onNotes = vi.fn();
    changes.subscribe(["subjects"], onSubjects);
    const stop = changes.subscribe(["notes"], onNotes);

    await db.insert(subjects).values({ name: "Pragmática" });
    expect(onSubjects).toHaveBeenCalledTimes(1);
    expect(onNotes).not.toHaveBeenCalled();

    await db.select().from(subjects);
    expect(onSubjects).toHaveBeenCalledTimes(1);

    await db.batch([db.insert(notes).values({ title: "A" }), db.insert(notes).values({})]);
    expect(onNotes).toHaveBeenCalledTimes(1);

    stop();
    await db.insert(notes).values({ title: "B" });
    expect(onNotes).toHaveBeenCalledTimes(1);
  });

  it("não avisa quando o lote falha", async () => {
    const { db, changes } = await openDb(nodeDriver());
    const listener = vi.fn();
    changes.subscribe(["subjects"], listener);
    await expect(
      db.batch([
        db.insert(subjects).values({ name: "X" }),
        db.insert(notes).values({ subjectId: "nao-existe" }),
      ]),
    ).rejects.toThrow();
    expect(listener).not.toHaveBeenCalled();
  });
});
