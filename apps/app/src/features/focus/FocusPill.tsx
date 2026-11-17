import { Timer } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { useFocusStore } from "./store";
import { formatClock, remainingMs } from "./timer";

/** Indicador do timer em andamento, em qualquer tela (some na própria tela de foco). */
export function FocusPill() {
  const timer = useFocusStore((s) => s.timer);
  const settings = useFocusStore((s) => s.settings);
  const { pathname } = useLocation();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (timer.status !== "running") return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [timer.status]);

  if (timer.status === "idle" || ["/", "/foco", "/estudar"].includes(pathname)) return null;
  return (
    <Link
      to="/foco"
      data-testid="focus-pill"
      className="fixed right-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 inline-flex min-h-10 items-center gap-2 rounded-full border border-line bg-surface px-3 text-sm font-medium tabular-nums shadow-lg md:bottom-4"
    >
      <Timer
        size={16}
        className={timer.phase === "focus" ? "text-accent" : "text-ok"}
        aria-hidden
      />
      {formatClock(remainingMs(timer, settings, now))}
      {timer.status === "paused" && <span className="text-xs font-normal text-muted">pausado</span>}
    </Link>
  );
}
