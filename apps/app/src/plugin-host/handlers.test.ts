import { manifestSchema } from "@estudarella/plugin-api";
import { beforeEach, describe, expect, it } from "vitest";
import type { Database } from "../data/db";
import { useMascotEvents, useMascotStore } from "../stores/mascot";
import { buildHandlers } from "./handlers";
import type { LoadedPluginInfo } from "./registry";

function pluginWith(granted: string[]): LoadedPluginInfo {
  return {
    manifest: manifestSchema.parse({
      id: "vocabulario",
      name: "Vocabulário",
      version: "1.0.0",
      apiVersion: "1",
      permissions: ["mascot"],
    }),
    record: { grantedPermissions: granted } as LoadedPluginInfo["record"],
    source: {} as LoadedPluginInfo["source"],
  };
}

const deps = {
  database: { db: {} } as unknown as Database,
  navigate: () => {},
  getContext: () => ({ surface: "page" as const }),
};

describe("mascot.say", () => {
  beforeEach(() => {
    useMascotEvents.getState().clear();
    useMascotStore.getState().set({ mascotId: "sapinho" });
  });

  it("faz o mascote falar, com o nome do plugin", async () => {
    const say = buildHandlers(pluginWith(["mascot"]), deps)["mascot.say"];
    expect(await say?.({ message: "10 palavras hoje!", mood: "happy" })).toEqual({ shown: true });
    expect(useMascotEvents.getState().event).toMatchObject({
      kind: "plugin",
      text: "10 palavras hoje!",
      mood: "happy",
      from: "Vocabulário",
    });
  });

  it("exige a permissão concedida pelo usuário", () => {
    const say = buildHandlers(pluginWith([]), deps)["mascot.say"];
    expect(() => say?.({ message: "oi" })).toThrow("Permissão necessária: mascot.");
    expect(useMascotEvents.getState().event).toBeNull();
  });

  it("sem mascote escolhido, não mostra nada", async () => {
    useMascotStore.getState().set({ mascotId: null });
    const say = buildHandlers(pluginWith(["mascot"]), deps)["mascot.say"];
    expect(await say?.({ message: "oi" })).toEqual({ shown: false });
    expect(useMascotEvents.getState().event).toBeNull();
  });
});
