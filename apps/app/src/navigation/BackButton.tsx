import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { useToast } from "../components/Toast";
import { screenFor, useScreens } from "./screens";

const EXIT_WINDOW = 2000;

type Handler = (event: { canGoBack: boolean }) => void;
const current: { handler: Handler | null } = { handler: null };
let registered = false;

/**
 * Registra o ouvinte nativo uma única vez, fora do ciclo do React: registrar e
 * remover dentro de um efeito (que roda duas vezes no modo estrito) acabava
 * removendo o ouvinte de vez. O componente só troca o tratador atual.
 */
function ensureListener() {
  if (registered || !Capacitor.isNativePlatform()) return;
  registered = true;
  void App.addListener("backButton", (event) => current.handler?.(event));
}

/**
 * Botão voltar do Android:
 * - janela aberta (diálogo, menu, painel de telas) → fecha;
 * - subpágina (nota, baralho, estudo) → volta para a página anterior;
 * - tela principal → vai para o Início;
 * - Início → só sai do app com dois toques seguidos.
 */
export function BackButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const screens = useScreens();
  const state = useRef({ pathname: location.pathname, screens, lastPress: 0 });
  state.current.pathname = location.pathname;
  state.current.screens = screens;

  useEffect(() => {
    ensureListener();
    current.handler = ({ canGoBack }) => {
      const { pathname, screens } = state.current;
      const overlay = document.querySelector('[role="dialog"], [role="menu"], [role="listbox"]');
      if (overlay) {
        document.activeElement?.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        );
        return;
      }
      if (pathname === "/") {
        const now = Date.now();
        if (now - state.current.lastPress < EXIT_WINDOW) {
          void App.exitApp();
          return;
        }
        state.current.lastPress = now;
        useToast.getState().show("Toque em voltar de novo para sair");
        return;
      }
      if (screenFor(screens, pathname)) {
        navigate("/", { replace: true });
        return;
      }
      // O React Router guarda a posição no histórico em `state.idx`.
      const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
      if (idx > 0 || canGoBack) navigate(-1);
      else navigate("/", { replace: true });
    };
    return () => {
      current.handler = null;
    };
  }, [navigate]);

  return null;
}
