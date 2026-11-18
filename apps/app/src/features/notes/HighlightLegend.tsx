import { useEffect, useState } from "react";
import { type ActiveRule, useHighlightPrefs, useHighlights } from "../../plugin-host/highlights";

/**
 * Legenda dos destaques presentes na nota: cada rótulo (ou termo) com a sua cor e o plugin.
 * Recalcula com um pequeno atraso enquanto o usuário digita.
 */
export function HighlightLegend({ text }: { text: string }) {
  const highlighter = useHighlights((s) => s.highlighter);
  const show = useHighlightPrefs((s) => s.show);
  const [items, setItems] = useState<ActiveRule[]>([]);

  useEffect(() => {
    if (!show || highlighter.size === 0) {
      setItems([]);
      return;
    }
    const timer = setTimeout(() => {
      const seen = new Map<string, ActiveRule>();
      for (const m of highlighter.find(text, 2000)) {
        const key = `${m.rule.pluginId}|${m.rule.label ?? m.rule.term}|${m.rule.color}`;
        if (!seen.has(key)) seen.set(key, m.rule);
        if (seen.size >= 12) break;
      }
      setItems([...seen.values()]);
    }, 300);
    return () => clearTimeout(timer);
  }, [text, highlighter, show]);

  if (items.length === 0) return null;
  return (
    <ul className="mb-3 flex flex-wrap gap-1.5 text-xs" aria-label="Legenda dos destaques">
      {items.map((rule) => (
        <li
          key={`${rule.pluginId}|${rule.label ?? rule.term}|${rule.color}`}
          className={`hl hl-${rule.style === "formula" ? "text" : rule.style} hl-${rule.color} rounded-full border border-line px-2 py-0.5`}
          title={rule.pluginName}
        >
          {rule.label ?? rule.term}
        </li>
      ))}
    </ul>
  );
}
