import {
  CalendarDays,
  Flame,
  LayoutGrid,
  type LucideIcon,
  NotebookText,
  Smile,
  Timer,
} from "lucide-react";
import type { ReactNode } from "react";
import { iconFor, usePlugins } from "../../plugin-host/registry";
import { MascotWidget } from "../mascot/MascotWidget";
import {
  FocusWidget,
  RecentNotesWidget,
  ShortcutsWidget,
  StreakWidget,
  TodayWidget,
} from "./AppWidgets";
import type { HomeItem } from "./layout";
import { PluginWidget } from "./PluginWidget";

export interface WidgetDef {
  key: string;
  title: string;
  description: string;
  icon: LucideIcon;
  /** Nome do plugin, para widgets de plugins. */
  plugin?: string;
  configurable?: boolean;
  render: (item: HomeItem) => ReactNode;
}

export const MASCOT_WIDGET = "app:mascote";

const APP_WIDGETS: WidgetDef[] = [
  {
    key: MASCOT_WIDGET,
    title: "Mascote",
    description: "Lembra dos cards, incentiva e dá dicas",
    icon: Smile,
    render: () => <MascotWidget />,
  },
  {
    key: "app:sequencia",
    title: "Sequência",
    description: "Dias seguidos de estudo",
    icon: Flame,
    render: () => <StreakWidget />,
  },
  {
    key: "app:hoje",
    title: "Hoje",
    description: "Cards para revisar, novos e respondidos",
    icon: CalendarDays,
    render: () => <TodayWidget />,
  },
  {
    key: "app:atalhos",
    title: "Atalhos",
    description: "Botões para as telas que você escolher",
    icon: LayoutGrid,
    configurable: true,
    render: (item) => <ShortcutsWidget screenIds={item.config?.screens ?? []} />,
  },
  {
    key: "app:foco",
    title: "Foco",
    description: "Timer e minutos de foco do dia",
    icon: Timer,
    render: () => <FocusWidget />,
  },
  {
    key: "app:notas-recentes",
    title: "Notas recentes",
    description: "Últimas notas e nova nota",
    icon: NotebookText,
    render: () => <RecentNotesWidget />,
  },
];

/** Widgets disponíveis: os do app e os dos plugins ativos. */
export function useWidgetDefs(): WidgetDef[] {
  const plugins = usePlugins((s) => s.plugins);
  const fromPlugins: WidgetDef[] = plugins
    .filter((p) => p.record.enabled)
    .flatMap((p) =>
      p.manifest.contributes.widgets.map((w) => ({
        key: `plugin:${p.manifest.id}:${w.id}`,
        title: w.title,
        description: p.manifest.name,
        icon: iconFor(p.manifest.icon),
        plugin: p.manifest.name,
        render: () => (
          <PluginWidget pluginId={p.manifest.id} widgetId={w.id} title={w.title} size={w.size} />
        ),
      })),
    );
  return [...APP_WIDGETS, ...fromPlugins];
}
