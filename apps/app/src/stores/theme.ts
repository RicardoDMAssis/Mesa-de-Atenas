import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

interface ThemeState {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

/**
 * Preferência do aparelho: fica no armazenamento local deste dispositivo e não
 * sincroniza (o celular pode estar no escuro e o computador no claro). Também
 * precisa estar disponível antes de o banco abrir, para a tela não piscar.
 * Preferências de estudo, que acompanham o usuário, ficam na tabela `settings`.
 */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      preference: "system",
      setPreference: (preference) => set({ preference }),
    }),
    { name: "estudarella:theme" },
  ),
);

const systemDark = () => matchMedia("(prefers-color-scheme: dark)");

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === "system") return systemDark().matches ? "dark" : "light";
  return preference;
}

/** Mantém `data-theme` do documento em dia com a preferência e com o sistema. */
export function watchTheme(onChange?: (theme: ResolvedTheme) => void): () => void {
  const apply = () => {
    const theme = resolveTheme(useThemeStore.getState().preference);
    document.documentElement.dataset.theme = theme;
    onChange?.(theme);
  };
  apply();
  const unsubscribe = useThemeStore.subscribe(apply);
  const media = systemDark();
  media.addEventListener("change", apply);
  return () => {
    unsubscribe();
    media.removeEventListener("change", apply);
  };
}
