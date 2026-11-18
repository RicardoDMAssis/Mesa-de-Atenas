import { renderCloze } from "@estudarella/core";
import type { BasicContent, Card, CardFallback, ClozeContent } from "@estudarella/db";
import { useMemo } from "react";
import { useAssetUrl } from "../../data/hooks";
import { PluginSurface } from "../../plugin-host/PluginSurface";
import { usePlugins } from "../../plugin-host/registry";

export function AssetImage({ hash, alt }: { hash?: string; alt: string }) {
  const url = useAssetUrl(hash);
  if (!hash) return null;
  if (!url) return <div className="mx-auto h-40 w-full max-w-sm animate-pulse rounded-lg bg-bg" />;
  return <img src={url} alt={alt} className="mx-auto max-h-72 rounded-lg object-contain" />;
}

/** Versão estática de um card de plugin (reserva): texto e imagem. */
function FallbackView({ fallback, revealed }: { fallback: CardFallback; revealed: boolean }) {
  return (
    <div className="grid gap-4 text-center" data-testid="card-fallback">
      <div data-testid="card-front" className="grid gap-3">
        <AssetImage hash={fallback.imageAssetId} alt="Imagem do card" />
        <p className="whitespace-pre-wrap text-lg">{fallback.front}</p>
      </div>
      {revealed && (
        <div data-testid="card-back" className="border-t border-line pt-4">
          <p className="whitespace-pre-wrap text-lg">{fallback.back}</p>
        </div>
      )}
    </div>
  );
}

/**
 * Card visual: o plugin desenha a frente e o verso numa área de altura fixa. Os botões
 * de resposta continuam do app. Se o plugin faltar, falhar ou não responder em 10 s,
 * aparece a reserva. O mesmo iframe é reaproveitado entre cards do mesmo plugin.
 */
function PluginCardView({ card, revealed }: { card: Card; revealed: boolean }) {
  const fallback = (card.fallback ?? { front: "Card de plugin", back: "" }) as CardFallback;
  const renders = usePlugins((s) =>
    Boolean(
      s.plugins.find((p) => p.manifest.id === card.pluginId)?.manifest.contributes.cardRenderer,
    ),
  );
  const context = useMemo(
    () => ({
      card: { content: card.content, side: revealed ? ("back" as const) : ("front" as const) },
    }),
    [card.content, revealed],
  );
  const reserve = <FallbackView fallback={fallback} revealed={revealed} />;
  if (!card.pluginId || !renders) return reserve;
  return (
    <div className="grid gap-3" data-testid="plugin-card">
      {fallback.front && (
        <p data-testid="card-front" className="whitespace-pre-wrap text-center text-lg">
          {fallback.front}
        </p>
      )}
      <PluginSurface
        pluginId={card.pluginId}
        surface="card"
        context={context}
        className="h-80 w-full rounded-lg"
        fallback={reserve}
      />
      {revealed && (
        <p data-testid="card-back" className="whitespace-pre-wrap text-center text-lg">
          {fallback.back}
        </p>
      )}
    </div>
  );
}

/** Exibe um card na revisão: só a pergunta, ou pergunta e resposta. */
export function CardView({ card, revealed }: { card: Card; revealed: boolean }) {
  if (card.type === "plugin") return <PluginCardView card={card} revealed={revealed} />;
  if (card.type === "cloze") {
    const c = card.content as ClozeContent;
    return (
      <div className="grid gap-4">
        <p className="whitespace-pre-wrap text-lg leading-relaxed" data-testid="card-front">
          {renderCloze(c.text, c.index, revealed).map((s, i) =>
            s.kind === "text" ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: segmentos estáticos
              <span key={i}>{s.text}</span>
            ) : s.kind === "hidden" ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: segmentos estáticos
              <span key={i} className="rounded bg-accent-soft px-1.5 font-semibold text-accent">
                [{s.hint ?? "…"}]
              </span>
            ) : (
              // biome-ignore lint/suspicious/noArrayIndexKey: segmentos estáticos
              <span key={i} className="rounded bg-accent-soft px-1.5 font-semibold text-accent">
                {s.text}
              </span>
            ),
          )}
        </p>
        {revealed && c.extra && <p className="text-sm text-muted">{c.extra}</p>}
      </div>
    );
  }
  const c = card.content as BasicContent;
  return (
    <div className="grid gap-4 text-center">
      <div data-testid="card-front" className="grid gap-3">
        <AssetImage hash={c.frontImage} alt="Imagem da frente" />
        <p className="whitespace-pre-wrap text-lg">{c.front}</p>
      </div>
      {revealed && (
        <div data-testid="card-back" className="grid gap-3 border-t border-line pt-4">
          <AssetImage hash={c.backImage} alt="Imagem do verso" />
          <p className="whitespace-pre-wrap text-lg">{c.back}</p>
        </div>
      )}
    </div>
  );
}

/** Resumo de uma linha para listas. */
export function cardSummary(card: Card): { front: string; back: string; hasImage: boolean } {
  if (card.type === "plugin") {
    const f = (card.fallback ?? { front: "Card de plugin", back: "" }) as CardFallback;
    return { front: f.front, back: f.back, hasImage: Boolean(f.imageAssetId) };
  }
  if (card.type === "cloze") {
    const c = card.content as ClozeContent;
    return {
      front: renderCloze(c.text, c.index, false)
        .map((s) => (s.kind === "text" ? s.text : "[…]"))
        .join(""),
      back: `Lacuna ${c.index}`,
      hasImage: false,
    };
  }
  const c = card.content as BasicContent;
  return { front: c.front, back: c.back, hasImage: Boolean(c.frontImage || c.backImage) };
}
