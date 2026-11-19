import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vitest/config";

const require = createRequire(import.meta.url);
const outDir = fileURLToPath(
  new URL("../../apps/app/public/builtin-plugins/foto-nota", import.meta.url),
);

/**
 * Copia o motor de leitura (Tesseract) e o modelo de português para a pasta `ocr/` do plugin.
 * Tudo vai junto com o app: a leitura funciona sem internet. O plugin lê esses arquivos com
 * `app.files.read` e os entrega ao worker como blob. O modelo vai com extensão `.bin` (continua
 * compactado): o build do Android descompacta e renomeia arquivos `.gz`, e ele sumiria do APK.
 */
function copyOcr(): Plugin {
  return {
    name: "copiar-ocr",
    apply: "build",
    closeBundle() {
      const tesseract = dirname(require.resolve("tesseract.js/package.json"));
      const core = dirname(
        createRequire(join(tesseract, "package.json")).resolve("tesseract.js-core/package.json"),
      );
      const por = dirname(require.resolve("@tesseract.js-data/por/package.json"));
      const dest = join(outDir, "ocr");
      mkdirSync(dest, { recursive: true });
      const files: [string, string][] = [
        [join(tesseract, "dist/worker.min.js"), "worker.min.js"],
        [join(core, "tesseract-core-simd-lstm.wasm.js"), "core-simd.js"],
        [join(core, "tesseract-core-lstm.wasm.js"), "core.js"],
        [join(por, "4.0.0_best_int/por.traineddata.gz"), "por.traineddata.bin"],
      ];
      for (const [from, to] of files) copyFileSync(from, join(dest, to));
    },
  };
}

/*
 * Gera o plugin no formato que o app carrega: uma pasta com manifest.json, index.html
 * e um arquivo por <script>/<link> (sem divisão de código), com caminhos relativos.
 */
export default defineConfig({
  base: "./",
  plugins: [copyOcr()],
  build: {
    outDir,
    emptyOutDir: true,
    modulePreload: false,
    assetsInlineLimit: 0,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
