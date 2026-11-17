import { describe, expect, it } from "vitest";
import { openDb } from "../client";
import { nodeDriver } from "../testing";
import {
  listPluginRecords,
  pluginStorageDelete,
  pluginStorageGet,
  pluginStorageKeys,
  pluginStorageSet,
  removePlugin,
  setPluginEnabled,
  upsertPlugin,
} from "./plugins";

const open = async () => (await openDb(nodeDriver())).db;
const base = {
  pluginId: "dicionario-pt",
  version: "1.0.0",
  manifest: {},
  source: "builtin" as const,
};

describe("registro de plugins", () => {
  it("instala desativado, ativa com permissões e mantém isso ao atualizar a versão", async () => {
    const db = await open();
    await upsertPlugin(db, base);
    expect((await listPluginRecords(db))[0]).toMatchObject({
      enabled: false,
      grantedPermissions: [],
    });
    await setPluginEnabled(db, "dicionario-pt", true, ["storage"]);
    await upsertPlugin(db, { ...base, version: "1.1.0" });
    expect((await listPluginRecords(db))[0]).toMatchObject({
      version: "1.1.0",
      enabled: true,
      grantedPermissions: ["storage"],
    });
  });

  it("remover apaga o registro e os dados do plugin, sem tocar nos de outro", async () => {
    const db = await open();
    await upsertPlugin(db, base);
    await upsertPlugin(db, { ...base, pluginId: "outro" });
    await pluginStorageSet(db, "dicionario-pt", "cache", { casa: 1 });
    await pluginStorageSet(db, "outro", "cache", { x: 1 });
    await removePlugin(db, "dicionario-pt");
    expect((await listPluginRecords(db)).map((p) => p.pluginId)).toEqual(["outro"]);
    expect(await pluginStorageGet(db, "dicionario-pt", "cache")).toBeUndefined();
    expect(await pluginStorageGet(db, "outro", "cache")).toEqual({ x: 1 });
  });
});

describe("armazenamento do plugin", () => {
  it("guarda, substitui, lista e apaga por plugin", async () => {
    const db = await open();
    await pluginStorageSet(db, "a", "k1", 1);
    await pluginStorageSet(db, "a", "k1", { v: 2 });
    await pluginStorageSet(db, "a", "k2", "x");
    await pluginStorageSet(db, "b", "k1", "de outro plugin");
    expect(await pluginStorageGet(db, "a", "k1")).toEqual({ v: 2 });
    expect((await pluginStorageKeys(db, "a")).sort()).toEqual(["k1", "k2"]);
    await pluginStorageDelete(db, "a", "k1");
    expect(await pluginStorageGet(db, "a", "k1")).toBeUndefined();
    expect(await pluginStorageGet(db, "b", "k1")).toBe("de outro plugin");
    await pluginStorageSet(db, "a", "k1", "de volta");
    expect(await pluginStorageGet(db, "a", "k1")).toBe("de volta");
  });
});
