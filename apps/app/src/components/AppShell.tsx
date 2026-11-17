import { LayoutGrid, Search } from "lucide-react";
import { useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import { FocusPill } from "../features/focus/FocusPill";
import { FocusTicker } from "../features/focus/useFocusTimer";
import { NoteTitlesSync } from "../features/notes/titles";
import { BackButton } from "../navigation/BackButton";
import { Launcher } from "../navigation/Launcher";
import { screenFor, useLauncher, useNavPrefs, useScreens } from "../navigation/screens";
import { CardProposalDialog } from "../plugin-host/CardProposalDialog";
import { PluginPanel } from "../plugin-host/PluginPanel";
import { PluginsSync } from "../plugin-host/registry";
import { Toast } from "./Toast";

export function AppShell() {
  const screens = useScreens();
  const pinned = useNavPrefs((s) => s.pinned);
  const visit = useNavPrefs((s) => s.visit);
  const openLauncher = useLauncher((s) => s.setOpen);
  const { pathname } = useLocation();

  // Lembra as telas visitadas, para o atalho "Recentes".
  useEffect(() => {
    const screen = screenFor(screens, pathname);
    if (screen) visit(screen.id);
  }, [pathname, screens, visit]);

  const bar = pinned
    .map((id) => screens.find((s) => s.id === id))
    .filter((s): s is (typeof screens)[number] => Boolean(s));
  const current = screenFor(screens, pathname);
  const inBar = current && bar.some((s) => s.id === current.id);
  const appScreens = screens.filter((s) => s.group === "app");
  const pluginScreens = screens.filter((s) => s.group === "plugin");

  const sideLink = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
      isActive ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-bg hover:text-fg"
    }`;

  return (
    <div className="flex h-full flex-col md:flex-row">
      <NoteTitlesSync />
      <FocusTicker />
      <FocusPill />
      <BackButton />
      <Launcher />
      <Toast />
      <PluginsSync />
      <PluginPanel />
      <CardProposalDialog />

      <nav
        aria-label="Principal"
        className="hidden w-56 shrink-0 flex-col gap-1 overflow-y-auto border-r border-line bg-surface p-3 md:flex"
      >
        <p className="px-3 pb-2 pt-2 text-lg font-semibold tracking-tight">Estudarella</p>
        <button
          type="button"
          onClick={() => openLauncher(true)}
          className="mb-2 flex min-h-9 items-center gap-2 rounded-lg border border-line px-3 text-sm text-muted hover:text-fg"
        >
          <Search size={16} aria-hidden />
          Ir para…
          <kbd className="ml-auto text-xs">Ctrl K</kbd>
        </button>
        {appScreens.map(({ id, to, label, icon: Icon }) => (
          <NavLink key={id} to={to} end={to === "/"} className={sideLink}>
            <Icon size={18} aria-hidden />
            {label}
          </NavLink>
        ))}
        {pluginScreens.length > 0 && (
          <>
            <p className="px-3 pt-4 pb-1 text-xs font-semibold uppercase tracking-wide text-muted">
              Plugins
            </p>
            {pluginScreens.map(({ id, to, label, icon: Icon }) => (
              <NavLink key={id} to={to} className={sideLink}>
                <Icon size={18} aria-hidden />
                {label}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-8 md:py-10">
          <Outlet />
        </div>
      </main>

      <nav
        aria-label="Barra inferior"
        className="flex shrink-0 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {bar.map(({ id, to, label, icon: Icon }) => (
          <NavLink
            key={id}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] ${
                isActive ? "font-medium text-accent" : "text-muted"
              }`
            }
          >
            <Icon size={20} aria-hidden />
            <span className="max-w-full truncate px-1">{label}</span>
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => openLauncher(true)}
          className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] ${
            current && !inBar ? "font-medium text-accent" : "text-muted"
          }`}
        >
          {current && !inBar ? (
            <current.icon size={20} aria-hidden />
          ) : (
            <LayoutGrid size={20} aria-hidden />
          )}
          {current && !inBar ? current.label : "Mais"}
        </button>
      </nav>
    </div>
  );
}
