import type { ThemePayload } from "@estudarella/plugin-api";

const TOKENS = [
  "--bg",
  "--surface",
  "--text",
  "--muted",
  "--border",
  "--accent",
  "--accent-contrast",
];

/** Cores do tema atual, enviadas aos plugins para combinarem com o app. */
export function themePayload(): ThemePayload {
  const style = getComputedStyle(document.documentElement);
  return {
    theme: document.documentElement.dataset.theme === "dark" ? "dark" : "light",
    tokens: Object.fromEntries(TOKENS.map((name) => [name, style.getPropertyValue(name).trim()])),
  };
}
