import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

const NOTIFICATION_ID = 7001;
const native = () => Capacitor.isNativePlatform();

export const MESSAGES = {
  focus: { title: "Foco concluído", body: "Hora de uma pausa." },
  short: { title: "Pausa encerrada", body: "Vamos voltar ao foco?" },
  long: { title: "Pausa longa encerrada", body: "Vamos voltar ao foco?" },
} as const;

/** Pede permissão para avisar. Devolve se ficou permitido. */
export async function requestNotifyPermission(): Promise<boolean> {
  try {
    if (native()) {
      const { display } = await LocalNotifications.requestPermissions();
      return display === "granted";
    }
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    return (await Notification.requestPermission()) === "granted";
  } catch {
    return false;
  }
}

/**
 * No Android, agenda a notificação para o horário de término: ela aparece mesmo
 * com o app fechado. Na web, o aviso é dado pela própria página (ver `notifyNow`).
 */
export async function scheduleEnd(at: number, message: { title: string; body: string }) {
  if (!native()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: NOTIFICATION_ID }] });
    await LocalNotifications.schedule({
      notifications: [
        {
          id: NOTIFICATION_ID,
          title: message.title,
          body: message.body,
          schedule: { at: new Date(at), allowWhileIdle: true },
        },
      ],
    });
  } catch (error) {
    console.warn("[foco] não foi possível agendar a notificação", error);
  }
}

export async function cancelScheduled() {
  if (!native()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: NOTIFICATION_ID }] });
  } catch {
    // Nada agendado.
  }
}

/** Aviso imediato (web): notificação do navegador, se permitida, e um som curto. */
export function notifyNow(message: { title: string; body: string }) {
  beep();
  if (native()) return; // No Android a notificação agendada já cuida disso.
  try {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(message.title, { body: message.body, icon: "/icons/icon-192.png" });
    }
  } catch {
    // Alguns navegadores só permitem notificações por service worker.
  }
}

function beep() {
  try {
    const audio = new AudioContext();
    const gain = audio.createGain();
    gain.connect(audio.destination);
    for (const [i, freq] of [880, 1175].entries()) {
      const osc = audio.createOscillator();
      osc.frequency.value = freq;
      osc.connect(gain);
      const t = audio.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0.15, t);
      osc.start(t);
      osc.stop(t + 0.15);
    }
    setTimeout(() => void audio.close(), 800);
  } catch {
    // Sem áudio disponível.
  }
}
