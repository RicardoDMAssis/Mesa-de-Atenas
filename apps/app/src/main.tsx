import { Capacitor } from "@capacitor/core";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { App } from "./App";
import { DatabaseProvider } from "./data/DatabaseProvider";
import { watchTheme } from "./stores/theme";
import "./theme/index.css";

watchTheme();

// Na web, o service worker guarda o app para uso offline e instalação.
// No Android os arquivos já vêm dentro do aplicativo.
if (import.meta.env.PROD && !Capacitor.isNativePlatform()) {
  void import("virtual:pwa-register").then(({ registerSW }) => registerSW({ immediate: true }));
}

const root = document.getElementById("root");
if (!root) throw new Error("Elemento #root ausente.");

createRoot(root).render(
  <StrictMode>
    <DatabaseProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </DatabaseProvider>
  </StrictMode>,
);
