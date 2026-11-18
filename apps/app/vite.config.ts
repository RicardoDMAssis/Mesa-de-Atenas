import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // PWA: torna o app instalável no computador e utilizável sem internet.
    // O registro é feito à mão em main.tsx, porque no Android (Capacitor) ele não é usado.
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null,
      workbox: {
        // Tudo que o app precisa para abrir offline, inclusive o SQLite (.wasm)
        // e os plugins distribuídos junto com ele.
        globPatterns: ["**/*.{js,css,html,wasm,png,svg,json,bin,woff2,glb}"],
        // O modelo do esqueleto pode passar de 4 MB (meta: até 8 MB).
        maximumFileSizeToCacheInBytes: 10_000_000,
        navigateFallback: "/index.html",
      },
      manifest: {
        name: "Estudarella",
        short_name: "Estudarella",
        description: "Notas, flashcards e mapa de conexões para estudar.",
        lang: "pt-BR",
        start_url: "/",
        display: "standalone",
        theme_color: "#5b4bd6",
        background_color: "#faf9f6",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
  worker: { format: "es" },
  // O SQLite WASM carrega o próprio .wasm por URL relativa; o pré-empacotamento quebra isso.
  optimizeDeps: { exclude: ["@sqlite.org/sqlite-wasm"] },
  test: { exclude: ["e2e/**", "node_modules/**"] },
});
