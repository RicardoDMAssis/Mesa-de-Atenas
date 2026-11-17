import { useEffect } from "react";
import { create } from "zustand";

/** Aviso curto no rodapé da tela (ex.: "Toque em voltar de novo para sair"). */
export const useToast = create<{ message: string | null; show: (message: string) => void }>(
  (set) => ({ message: null, show: (message) => set({ message }) }),
);

export function Toast() {
  const message = useToast((s) => s.message);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => useToast.setState({ message: null }), 2000);
    return () => clearTimeout(t);
  }, [message]);
  if (!message) return null;
  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 md:bottom-6"
    >
      <p className="rounded-full bg-fg px-4 py-2 text-sm text-bg shadow-lg">{message}</p>
    </div>
  );
}
