import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/*
 * Gera o plugin no formato que o app carrega: uma pasta com manifest.json, index.html
 * e um arquivo por <script>/<link> (sem divisão de código), com caminhos relativos.
 * O modelo (public/modelo) é copiado junto e lido sob demanda com app.files.read.
 */
export default defineConfig({
  base: "./",
  build: {
    outDir: fileURLToPath(
      new URL("../../apps/app/public/builtin-plugins/esqueleto-3d", import.meta.url),
    ),
    emptyOutDir: true,
    modulePreload: false,
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1500,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
