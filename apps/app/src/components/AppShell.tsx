import {
  BookOpen,
  House,
  Layers,
  type LucideIcon,
  Puzzle,
  Search,
  Settings,
  Timer,
  Waypoints,
} from "lucide-react";
import { NavLink, Outlet } from "react-router";
import { NoteTitlesSync } from "../features/notes/titles";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Aparece na barra inferior do celular (máximo de cinco). */
  mobile: boolean;
}

const NAV: NavItem[] = [
  { to: "/", label: "Início", icon: House, mobile: true },
  { to: "/notas", label: "Notas", icon: BookOpen, mobile: true },
  { to: "/revisao", label: "Revisão", icon: Layers, mobile: true },
  { to: "/busca", label: "Buscar", icon: Search, mobile: true },
  { to: "/grafo", label: "Grafo", icon: Waypoints, mobile: false },
  { to: "/foco", label: "Foco", icon: Timer, mobile: false },
  { to: "/plugins", label: "Plugins", icon: Puzzle, mobile: false },
  { to: "/ajustes", label: "Ajustes", icon: Settings, mobile: true },
];

export function AppShell() {
  return (
    <div className="flex h-full flex-col md:flex-row">
      <NoteTitlesSync />
      <nav
        aria-label="Principal"
        className="hidden w-56 shrink-0 flex-col gap-1 border-r border-line bg-surface p-3 md:flex"
      >
        <p className="px-3 pb-3 pt-2 text-lg font-semibold tracking-tight">Estudarella</p>
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                isActive
                  ? "bg-accent-soft font-medium text-accent"
                  : "text-muted hover:bg-bg hover:text-fg"
              }`
            }
          >
            <Icon size={18} aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-8 md:py-10">
          <Outlet />
        </div>
      </main>

      <nav
        aria-label="Principal"
        className="flex shrink-0 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {NAV.filter((item) => item.mobile).map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] ${
                isActive ? "font-medium text-accent" : "text-muted"
              }`
            }
          >
            <Icon size={20} aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
