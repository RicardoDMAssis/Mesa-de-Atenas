import { createScheduler, type Scheduler } from "@estudarella/core";
import { type DriverInfo, type OpenedDb, openDb } from "@estudarella/db";
import { openWebDriver } from "@estudarella/db/web";
import { type AssetStore, openAssetStore } from "./assets";

export interface Database extends OpenedDb {
  info: DriverInfo;
  /** Arquivos binários (imagens, modelos), guardados fora do SQLite. */
  assets: AssetStore;
  /** Agendador da repetição espaçada. */
  scheduler: Scheduler;
}

let opening: Promise<Database> | undefined;

/** Abre o banco uma única vez por sessão do app. */
export function getDatabase(): Promise<Database> {
  opening ??= open();
  return opening;
}

async function open(): Promise<Database> {
  // No Android entrará aqui o driver nativo (Capacitor); por ora, só o do navegador.
  const driver = await openWebDriver();
  const [opened, assets, scheduler] = await Promise.all([
    openDb(driver),
    openAssetStore(),
    createScheduler(),
  ]);
  // Pede ao navegador para não apagar os dados sob pressão de espaço.
  void navigator.storage?.persist?.();
  return { ...opened, info: driver.info, assets, scheduler };
}
