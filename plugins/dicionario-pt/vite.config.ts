import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/*
 * Gera o plugin no formato que o app carrega: uma pasta com manifest.json, index.html
 * e um arquivo por <script>/<link> (sem divisão de código), com caminhos relativos.
 * A saída vai direto para os plugins embutidos do app.
 */
export default defineConfig({
  base: "./",
  build: {
    outDir: fileURLToPath(
      new URL("../../apps/app/public/builtin-plugins/dicionario-pt", import.meta.url),
    ),
    emptyOutDir: true,
    modulePreload: false,
    assetsInlineLimit: 0,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
