import { useEffect } from "react";
import { useMascotEvents, useMascotStore } from "../../stores/mascot";
import { useFocusStore } from "../focus/store";
import { focusPhaseMessage } from "./messages";
import { useMascot } from "./useMascot";

/**
 * Faz o mascote reagir ao timer de foco: comemora o fim do bloco (com uma dica
 * para a pausa) e chama de volta quando a pausa acaba. Montado uma vez, no layout.
 */
export function FocusWatcher() {
  const persona = useMascot()?.persona;

  useEffect(() => {
    if (!persona) return;
    return useFocusStore.subscribe((state, prev) => {
      const before = prev.timer;
      const after = state.timer;
      // Só a passagem natural de fase (o tempo acabou), não "reiniciar" nem pular.
      const finished =
        before.status === "running" &&
        before.phase !== after.phase &&
        before.endsAt !== null &&
        before.endsAt <= Date.now() + 1000 &&
        Date.now() - before.endsAt < 60_000;
      if (!finished || !useMascotStore.getState().celebrate) return;
      useMascotEvents.getState().push(focusPhaseMessage(before.phase, persona));
    });
  }, [persona]);

  return null;
}
