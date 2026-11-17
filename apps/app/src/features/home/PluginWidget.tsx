import { useEffect, useMemo, useRef, useState } from "react";
import { PluginSurface } from "../../plugin-host/PluginSurface";

export const WIDGET_HEIGHT = { small: 120, medium: 200, large: 320 } as const;

/**
 * Quadro com o widget de um plugin. Altura fixa (o plugin não pode crescer na
 * tela do app) e carregamento só quando o quadro aparece na tela.
 */
export function PluginWidget({
  pluginId,
  widgetId,
  title,
  size,
}: {
  pluginId: string;
  widgetId: string;
  title: string;
  size: keyof typeof WIDGET_HEIGHT;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const context = useMemo(() => ({ widget: { id: widgetId, size } }), [widgetId, size]);

  useEffect(() => {
    const el = box.current;
    if (!el || visible) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setVisible(true);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <section
      className="overflow-hidden rounded-xl border border-line bg-surface"
      data-testid={`widget-${pluginId}-${widgetId}`}
    >
      <h2 className="px-4 pt-3 text-base font-semibold">{title}</h2>
      <div ref={box} style={{ height: WIDGET_HEIGHT[size] }}>
        {visible && <PluginSurface pluginId={pluginId} surface="widget" context={context} />}
      </div>
    </section>
  );
}
