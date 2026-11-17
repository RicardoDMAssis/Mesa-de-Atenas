import { renderCloze } from "@estudarella/core";
import type { BasicContent, Card, ClozeContent } from "@estudarella/db";
import { useAssetUrl } from "../../data/hooks";

export function AssetImage({ hash, alt }: { hash?: string; alt: string }) {
  const url = useAssetUrl(hash);
  if (!hash) return null;
  if (!url) return <div className="mx-auto h-40 w-full max-w-sm animate-pulse rounded-lg bg-bg" />;
  return <img src={url} alt={alt} className="mx-auto max-h-72 rounded-lg object-contain" />;
}

/** Exibe um card na revisão: só a pergunta, ou pergunta e resposta. */
export function CardView({ card, revealed }: { card: Card; revealed: boolean }) {
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
