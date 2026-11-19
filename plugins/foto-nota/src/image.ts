/** Uma foto escolhida pelo usuário, com o giro aplicado por ele (em graus). */
export interface Photo {
  id: string;
  file: Blob;
  rotation: 0 | 90 | 180 | 270;
  /** Endereço para a miniatura na tela. */
  url: string;
}

/**
 * Desenha a foto num canvas: respeita a orientação gravada pela câmera, aplica o giro e reduz
 * para no máximo `maxSide` pixels no lado maior.
 */
export async function drawPhoto(
  photo: Pick<Photo, "file" | "rotation">,
  maxSide: number,
  gray = false,
): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(photo.file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const turned = photo.rotation === 90 || photo.rotation === 270;
  const canvas = document.createElement("canvas");
  canvas.width = turned ? h : w;
  canvas.height = turned ? w : h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível.");
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((photo.rotation * Math.PI) / 180);
  if (gray) ctx.filter = "grayscale(1) contrast(1.15)";
  ctx.drawImage(bitmap, -w / 2, -h / 2, w, h);
  bitmap.close();
  return canvas;
}

export function toJpeg(canvas: HTMLCanvasElement, quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Falha ao gerar a imagem."))),
      "image/jpeg",
      quality,
    ),
  );
}
