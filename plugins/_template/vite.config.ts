import { defineConfig } from "vite";

/*
 * Gera o plugin no formato que o app carrega (não mude estas opções):
 * caminhos relativos, um único arquivo de código e um de estilo, sem divisão.
 */
export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    modulePreload: false,
    assetsInlineLimit: 0,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
