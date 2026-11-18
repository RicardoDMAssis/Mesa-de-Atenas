import { describe, expect, it } from "vitest";
import { openDb } from "../client";
import { nodeDriver } from "../testing";
import {
  listPluginFiles,
  pluginFilesUsage,
  registerAsset,
  registerPluginFile,
  removePluginFile,
} from "./assets";
import {
  applyCardText,
  createCards,
  deleteCards,
  existingFronts,
  existingOwnKeys,
  listCards,
  listOwnCards,
  ownCardsByIds,
  type Scheduling,
  setPluginCardContent,
  updateCardContent,
} from "./cards";
import { createDeck } from "./decks";
import { search } from "./search";

const open = async () => (await openDb(nodeDriver())).db;
const fresh: Scheduling = { srs: {}, due: 1, state: 0, reps: 0, lapses: 0, lastReview: null };
const hash = (c: string) => c.repeat(64);

describe("cards criados por plugins", () => {
  it("registra o dono e a chave, lista só os do plugin e acha duplicados", async () => {
    const db = await open();
    const deck = await createDeck(db, { name: "Química" });
    const ids = await createCards(
      db,
      deck.id,
      [
        {
          type: "basic",
          content: { front: "Etanol", back: "C2H6O" },
          origin: { pluginId: "quimica", key: "etanol" },
        },
        {
          type: "basic",
          content: { front: "Metano", back: "CH4" },
          origin: { pluginId: "quimica", key: "metano" },
        },
        {
          type: "basic",
          content: { front: "Feliz", back: "alegre" },
          origin: { pluginId: "dicionario" },
        },
        { type: "basic", content: { front: "Meu card", back: "do usuário" } },
      ],
      fresh,
    );
    expect(ids).toHaveLength(4);

    const own = await listOwnCards(db, "quimica", { limit: 200 });
    expect(own.map((c) => c.key)).toEqual(["etanol", "metano"]);
    expect(own[0]).toMatchObject({
      deckName: "Química",
      front: "Etanol",
      back: "C2H6O",
      editedAt: null,
    });
    expect(
      (await listOwnCards(db, "quimica", { key: "metano", limit: 200 })).map((c) => c.front),
    ).toEqual(["Metano"]);
    // Página seguinte: depois do primeiro.
    expect(
      (await listOwnCards(db, "quimica", { after: own[0]?.id, limit: 200 })).map((c) => c.key),
    ).toEqual(["metano"]);

    // Um plugin não alcança os cards de outro nem os do usuário.
    expect((await ownCardsByIds(db, "quimica", ids)).map((c) => c.id)).toEqual(ids.slice(0, 2));
    expect(await existingOwnKeys(db, "quimica", ["etanol", "propano"])).toEqual(
      new Set(["etanol"]),
    );
    expect((await existingFronts(db, deck.id)).has("meu card")).toBe(true);
  });

  it("aplica correções sem marcar como edição do usuário; edição pelo app marca", async () => {
    const db = await open();
    const deck = await createDeck(db, { name: "Q" });
    const [a, b] = await createCards(
      db,
      deck.id,
      [
        { type: "basic", content: { front: "Água", back: "H2O" }, origin: { pluginId: "quimica" } },
        {
          type: "plugin",
          pluginId: "quimica",
          content: { molecula: "co2" },
          fallback: { front: "Que molécula?", back: "CO2" },
          origin: { pluginId: "quimica" },
        },
      ],
      fresh,
    );
    if (!a || !b) throw new Error("cards não criados");
    const [cardA] = await ownCardsByIds(db, "quimica", [a]);
    if (!cardA) throw new Error("card não achado");
    await applyCardText(db, cardA, { back: "H₂O (água)" });
    await setPluginCardContent(db, b, { molecula: "co2", angulo: 30 });
    let own = await listOwnCards(db, "quimica", { limit: 200 });
    expect(own.map((c) => [c.back, c.editedAt])).toEqual([
      ["H₂O (água)", null],
      ["CO2", null],
    ]);
    expect(own[1]?.content).toEqual({ molecula: "co2", angulo: 30 });
    expect(await search(db, "agua")).toHaveLength(1);

    await updateCardContent(db, a, { front: "Água", back: "minha resposta" });
    own = await listOwnCards(db, "quimica", { limit: 200 });
    expect(own[0]?.editedAt).toBeTypeOf("number");

    await deleteCards(db, [a]);
    expect((await listCards(db, deck.id)).map((c) => c.id)).toEqual([b]);
  });
});

describe("arquivos de plugins", () => {
  it("guarda, lista, mede, renomeia e apaga sem afetar imagens com o mesmo conteúdo", async () => {
    const db = await open();
    await registerPluginFile(db, {
      hash: hash("a"),
      mime: "chemical/x-mdl-molfile",
      size: 100,
      pluginId: "quimica",
      name: "etanol.mol",
    });
    await registerPluginFile(db, {
      hash: hash("b"),
      mime: "text/csv",
      size: 50,
      pluginId: "quimica",
      name: "dados.csv",
    });
    await registerPluginFile(db, {
      hash: hash("c"),
      mime: "text/plain",
      size: 10,
      pluginId: "outro",
      name: "x.txt",
    });
    // Mesmo conteúdo de novo: só troca o nome.
    await registerPluginFile(db, {
      hash: hash("a"),
      mime: "chemical/x-mdl-molfile",
      size: 100,
      pluginId: "quimica",
      name: "etanol-v2.mol",
    });

    expect((await listPluginFiles(db, "quimica")).map((f) => f.name)).toEqual([
      "etanol-v2.mol",
      "dados.csv",
    ]);
    expect(await pluginFilesUsage(db, "quimica")).toBe(150);
    expect(await listPluginFiles(db, "outro")).toHaveLength(1);

    // Uma imagem de card com o mesmo conteúdo continua existindo depois de apagar o arquivo.
    await registerAsset(db, { hash: hash("b"), mime: "image/png", size: 50 });
    expect(await removePluginFile(db, "quimica", hash("b"))).toBe(false);
    expect(await removePluginFile(db, "quimica", hash("a"))).toBe(true);
    expect(await listPluginFiles(db, "quimica")).toEqual([]);
  });
});
