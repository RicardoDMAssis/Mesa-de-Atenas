import { listAssets } from "@estudarella/db";
import { useEffect, useState } from "react";
import { useDatabase } from "../../data/DatabaseProvider";
import type { Database } from "../../data/db";
import { BACKGROUND_DEFAULTS, useAppearanceStore } from "../../stores/appearance";
import { shrinkImage } from "../cards/images";

/** Fundos de tela grandes o bastante para monitores comuns, sem pesar no aparelho. */
const MAX_SIDE = 2400;

/**
 * Guarda a imagem de fundo no armazenamento de arquivos deste aparelho. Ela não é
 * registrada na tabela `assets`, então não entra no backup nem no sync.
 */
export async function setBackgroundImage(database: Database, file: File): Promise<void> {
  if (!file.type.startsWith("image/")) throw new Error("Escolha um arquivo de imagem.");
  const stored = await database.assets.put(await shrinkImage(file, MAX_SIDE));
  const { background, set } = useAppearanceStore.getState();
  set({ background: { ...BACKGROUND_DEFAULTS, ...background, hash: stored.hash } });
  if (background && background.hash !== stored.hash) await forget(database, background.hash);
}

export async function removeBackgroundImage(database: Database): Promise<void> {
  const { background, set } = useAppearanceStore.getState();
  set({ background: null });
  if (background) await forget(database, background.hash);
}

/** Apaga o arquivo antigo, a menos que a mesma imagem também esteja num card. */
async function forget(database: Database, hash: string): Promise<void> {
  const used = (await listAssets(database.db)).some((a) => a.hash === hash);
  if (!used) await database.assets.delete(hash);
}

/** URL temporária da imagem guardada pelo hash (ou `undefined` enquanto carrega). */
export function useBackgroundUrl(hash: string | undefined): string | undefined {
  const { assets } = useDatabase();
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!hash) {
      setUrl(undefined);
      return;
    }
    let cancelled = false;
    let created: string | undefined;
    assets.get(hash).then((blob) => {
      if (cancelled || !blob) return;
      created = URL.createObjectURL(blob);
      setUrl(created);
    });
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [assets, hash]);
  return url;
}

/** Camada fixa atrás do app com a imagem escolhida e o véu da cor de fundo por cima. */
export function AppBackground() {
  const background = useAppearanceStore((s) => s.background);
  const url = useBackgroundUrl(background?.hash);
  if (!background || !url) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        data-testid="app-background"
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url("${url}")`,
          filter: background.blur ? `blur(${background.blur}px)` : undefined,
          // Esconde as bordas claras que o desfoque cria.
          transform: background.blur ? "scale(1.06)" : undefined,
        }}
      />
      <div className="absolute inset-0 bg-bg" style={{ opacity: background.dim / 100 }} />
    </div>
  );
}
