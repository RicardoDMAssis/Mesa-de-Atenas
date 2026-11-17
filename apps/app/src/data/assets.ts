export interface StoredAsset {
  /** SHA-256 do conteúdo, em hexadecimal. É a identidade do arquivo. */
  hash: string;
  size: number;
  mime: string;
}

/**
 * Onde ficam os bytes de imagens, áudios e modelos. A tabela `assets` guarda só
 * os metadados; o conteúdo é endereçado pelo hash, então o mesmo arquivo nunca
 * ocupa espaço duas vezes e o sync pode enviar cada um separadamente.
 */
export interface AssetStore {
  readonly persistent: boolean;
  put(data: Blob): Promise<StoredAsset>;
  get(hash: string): Promise<Blob | undefined>;
  delete(hash: string): Promise<void>;
}

async function sha256(data: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await data.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

const isHash = (hash: string) => /^[0-9a-f]{64}$/.test(hash);

/** Navegador e WebView: pasta `assets/` no OPFS (armazenamento privado da origem). */
async function opfsStore(): Promise<AssetStore> {
  const root = await navigator.storage.getDirectory();
  const dir = await root.getDirectoryHandle("assets", { create: true });
  return {
    persistent: true,
    async put(data) {
      const hash = await sha256(data);
      const file = await dir.getFileHandle(hash, { create: true });
      const writable = await file.createWritable();
      await writable.write(data);
      await writable.close();
      return { hash, size: data.size, mime: data.type };
    },
    async get(hash) {
      if (!isHash(hash)) return undefined;
      try {
        return await (await dir.getFileHandle(hash)).getFile();
      } catch {
        return undefined;
      }
    },
    async delete(hash) {
      if (isHash(hash)) await dir.removeEntry(hash).catch(() => {});
    },
  };
}

function memoryStore(): AssetStore {
  const files = new Map<string, Blob>();
  return {
    persistent: false,
    async put(data) {
      const hash = await sha256(data);
      files.set(hash, data);
      return { hash, size: data.size, mime: data.type };
    },
    get: async (hash) => files.get(hash),
    delete: async (hash) => void files.delete(hash),
  };
}

export async function openAssetStore(): Promise<AssetStore> {
  if (typeof navigator.storage?.getDirectory !== "function") return memoryStore();
  try {
    return await opfsStore();
  } catch {
    return memoryStore();
  }
}
