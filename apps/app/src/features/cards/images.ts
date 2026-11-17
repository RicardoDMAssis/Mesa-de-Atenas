import { registerAsset } from "@estudarella/db";
import type { Database } from "../../data/db";

const MAX_SIDE = 1600;

/** Reduz a imagem no aparelho (máx. 1600 px no maior lado) antes de guardar. */
async function shrink(file: File): Promise<Blob> {
  if (file.type === "image/svg+xml" || file.type === "image/gif") return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("Não foi possível ler esta imagem. Tente outro arquivo.");
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 600_000) {
    bitmap.close();
    return file;
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Falha ao converter"))),
      "image/webp",
      0.85,
    ),
  );
}

/** Guarda a imagem e devolve o hash para referenciar no card. */
export async function storeImage(database: Database, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Escolha um arquivo de imagem.");
  const blob = await shrink(file);
  const stored = await database.assets.put(blob);
  await registerAsset(database.db, stored);
  return stored.hash;
}
