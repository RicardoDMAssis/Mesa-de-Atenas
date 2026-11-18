import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { useEffect } from "react";
import { useMascotStore } from "../../stores/mascot";
import { notifyNow } from "../focus/notify";
import { useMascot, useStudyContext } from "./useMascot";

const NOTIFICATION_ID = 7101;
const native = () => Capacitor.isNativePlatform();

const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * No Android, agenda uma notificação que se repete todo dia na hora escolhida
 * (aparece mesmo com o app fechado). Sem hora, cancela.
 */
export async function scheduleDailyReminder(hour: number | null, name: string): Promise<void> {
  if (!native()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: NOTIFICATION_ID }] });
    if (hour === null) return;
    await LocalNotifications.schedule({
      notifications: [
        {
          id: NOTIFICATION_ID,
          title: `${name} está chamando`,
          body: "Hora de estudar! Seus cards de hoje estão esperando.",
          schedule: { on: { hour, minute: 0 }, allowWhileIdle: true },
        },
      ],
    });
  } catch (error) {
    console.warn("[mascote] não foi possível agendar o lembrete diário", error);
  }
}

/**
 * Mantém o lembrete diário em dia. Na web não há como avisar com o app fechado:
 * enquanto ele estiver aberto, avisa uma vez por dia a partir da hora escolhida,
 * só se houver cards para revisar.
 */
export function DailyReminder() {
  const active = useMascot();
  const hour = useMascotStore((s) => s.dailyHour);
  const ctx = useStudyContext();
  const name = active?.persona.name;

  useEffect(() => {
    void scheduleDailyReminder(name ? hour : null, name ?? "");
  }, [hour, name]);

  const due = ctx ? ctx.due + ctx.fresh : 0;
  useEffect(() => {
    if (native() || hour === null || !name) return;
    const check = () => {
      const now = new Date();
      const { lastDailyReminder, set } = useMascotStore.getState();
      if (now.getHours() < hour || lastDailyReminder === dayKey(now) || due === 0) return;
      set({ lastDailyReminder: dayKey(now) });
      notifyNow({
        title: `${name} está chamando`,
        body: `Hora de estudar! ${due} ${due === 1 ? "card espera" : "cards esperam"} por você.`,
      });
    };
    check();
    const timer = setInterval(check, 60_000);
    return () => clearInterval(timer);
  }, [hour, name, due]);

  return null;
}
