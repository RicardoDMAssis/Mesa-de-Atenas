import { app } from "@estudarella/plugin-sdk";
import { createWorker, OEM, type Worker } from "tesseract.js";
import { layoutText } from "./cleanup";

/*
 * Leitura de texto (Tesseract) sem internet. O plugin roda num iframe isolado, então tudo o
 * que o worker precisa (o próprio script, o motor em WebAssembly e o modelo de português) é
 * lido da pasta do plugin e entregue como blob. O worker pede o modelo por `fetch`; um pequeno
 * script de partida troca esse endereço fictício ("idioma:") pelo blob do modelo.
 */

export interface Progress {
  stage: "loading" | "reading";
  /** 0 a 1. */
  progress: number;
}

/** Detecção de SIMD (o mesmo teste da biblioteca wasm-feature-detect). */
const SIMD_TEST = new Uint8Array([
  0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15,
  253, 98, 11,
]);

async function blobUrl(path: string, type: string): Promise<string> {
  const data = await app.files.read(path);
  return URL.createObjectURL(new Blob([data], { type }));
}

let onProgress: (p: Progress) => void = () => {};
let current: Promise<Worker> | null = null;

async function start(): Promise<Worker> {
  const simd = WebAssembly.validate(SIMD_TEST);
  const [workerUrl, coreUrl, langUrl] = await Promise.all([
    blobUrl("ocr/worker.min.js", "text/javascript"),
    blobUrl(simd ? "ocr/core-simd.js" : "ocr/core.js", "text/javascript"),
    blobUrl("ocr/por.traineddata.bin", "application/gzip"),
  ]);
  const boot = [
    `const modelo = ${JSON.stringify(langUrl)};`,
    "const original = self.fetch.bind(self);",
    'self.fetch = (url, init) => String(url).startsWith("idioma:") ? original(modelo, init) : original(url, init);',
    `importScripts(${JSON.stringify(workerUrl)});`,
  ].join("\n");
  const bootUrl = URL.createObjectURL(new Blob([boot], { type: "text/javascript" }));

  return createWorker("por", OEM.LSTM_ONLY, {
    workerPath: bootUrl,
    workerBlobURL: false,
    // A biblioteca só aceita um arquivo se o endereço terminar em "js"; o fragmento é ignorado.
    corePath: `${coreUrl}#core.js`,
    langPath: "idioma:",
    cacheMethod: "none",
    gzip: true,
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") onProgress({ stage: "reading", progress: m.progress });
      else onProgress({ stage: "loading", progress: m.progress });
    },
  });
}

/** Prepara o leitor (só na primeira vez demora: carrega uns 5 MB). */
function worker(): Promise<Worker> {
  if (!current) {
    current = start();
    current.catch(() => {
      current = null;
    });
  }
  return current;
}

export async function readText(
  image: HTMLCanvasElement,
  progress: (p: Progress) => void,
): Promise<{ text: string; confidence: number }> {
  onProgress = progress;
  const w = await worker();
  const { data } = await w.recognize(image, {}, { text: true, blocks: true });
  // Com as posições das linhas dá para separar os parágrafos; sem elas, o texto simples.
  const blocks = data.blocks?.map((b) => ({
    paragraphs: b.paragraphs.map((p) => ({
      lines: p.lines.map((l) => ({ text: l.text, ...l.bbox })),
    })),
  }));
  return { text: blocks?.length ? layoutText(blocks) : data.text, confidence: data.confidence };
}

/** Interrompe uma leitura em andamento (o leitor é recriado na próxima vez). */
export async function cancelReading(): Promise<void> {
  const running = current;
  current = null;
  if (running) await (await running).terminate();
}
