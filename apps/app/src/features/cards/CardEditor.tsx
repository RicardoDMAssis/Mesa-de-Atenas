import { clozeIndexes, nextClozeIndex } from "@estudarella/core";
import {
  type BasicContent,
  type Card,
  type CardFallback,
  type ClozeContent,
  createCards,
  updateCardContent,
  updateCardFallback,
} from "@estudarella/db";
import { ImagePlus, X } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { Button, Dialog, DialogActions, Field, Textarea } from "../../components/ui";
import { useDatabase } from "../../data/DatabaseProvider";
import { AssetImage } from "./CardView";
import { storeImage } from "./images";

type Kind = "basic" | "cloze" | "plugin";

interface Props {
  open: boolean;
  onClose: () => void;
  deckId: string;
  /** Card a editar; ausente = criar. */
  card?: Card;
}

export function ImagePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: string;
  onChange: (hash: string | undefined) => void;
}) {
  const database = useDatabase();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string>();
  return (
    <div className="grid gap-2">
      {value && (
        <div className="relative w-fit">
          <AssetImage hash={value} alt={label} />
          <button
            type="button"
            aria-label={`Remover ${label.toLowerCase()}`}
            onClick={() => onChange(undefined)}
            className="absolute right-1 top-1 rounded-full bg-surface p-1 shadow"
          >
            <X size={14} aria-hidden />
          </button>
        </div>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label={label}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            setError(undefined);
            onChange(await storeImage(database, file));
          } catch (err) {
            setError(err instanceof Error ? err.message : "Falha ao guardar a imagem.");
          }
        }}
      />
      {!value && (
        <Button size="sm" variant="ghost" className="w-fit" onClick={() => input.current?.click()}>
          <ImagePlus size={16} aria-hidden />
          {label}
        </Button>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

export function CardEditor({ open, onClose, deckId, card }: Props) {
  const { db, scheduler } = useDatabase();
  const [kind, setKind] = useState<Kind>("basic");
  const [basic, setBasic] = useState<BasicContent>({ front: "", back: "" });
  const [cloze, setCloze] = useState({ text: "", extra: "" });
  const [keepOpen, setKeepOpen] = useState(false);
  const clozeRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    if (card?.type === "plugin") {
      // Card de plugin: o que se personaliza é a parte de texto (pergunta, resposta e imagem).
      const f = (card.fallback ?? { front: "", back: "" }) as CardFallback;
      setKind("plugin");
      setBasic({ front: f.front, back: f.back, frontImage: f.imageAssetId });
    } else if (card?.type === "cloze") {
      const c = card.content as ClozeContent;
      setKind("cloze");
      setCloze({ text: c.text, extra: c.extra ?? "" });
    } else if (card) {
      setKind("basic");
      setBasic(card.content as BasicContent);
    } else {
      setBasic({ front: "", back: "" });
      setCloze({ text: "", extra: "" });
    }
  }, [open, card]);

  const indexes = clozeIndexes(cloze.text);
  const valid =
    kind === "basic" || kind === "plugin"
      ? (basic.front.trim() || basic.frontImage) && (basic.back.trim() || basic.backImage)
      : indexes.length > 0;

  /** Envolve o texto selecionado em uma nova lacuna. */
  const markCloze = () => {
    const el = clozeRef.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b, value } = el;
    const n = nextClozeIndex(value);
    const inner = value.slice(a, b) || "resposta";
    const text = `${value.slice(0, a)}{{c${n}::${inner}}}${value.slice(b)}`;
    setCloze((c) => ({ ...c, text }));
    requestAnimationFrame(() => el.focus());
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    const clean: BasicContent = {
      front: basic.front.trim(),
      back: basic.back.trim(),
      ...(basic.frontImage ? { frontImage: basic.frontImage } : {}),
      ...(basic.backImage ? { backImage: basic.backImage } : {}),
    };
    if (card?.type === "plugin") {
      await updateCardFallback(db, card.id, {
        front: clean.front,
        back: clean.back,
        ...(clean.frontImage ? { imageAssetId: clean.frontImage } : {}),
      });
      onClose();
      return;
    }
    if (card) {
      const content =
        card.type === "cloze"
          ? {
              ...(card.content as ClozeContent),
              text: cloze.text,
              extra: cloze.extra.trim() || undefined,
            }
          : clean;
      await updateCardContent(db, card.id, content);
      onClose();
      return;
    }
    const initial = scheduler.newCard(new Date());
    if (kind === "basic") {
      await createCards(db, deckId, [{ type: "basic", content: clean }], initial);
      setBasic({ front: "", back: "" });
    } else {
      await createCards(
        db,
        deckId,
        indexes.map((index) => ({
          type: "cloze" as const,
          content: { text: cloze.text, index, extra: cloze.extra.trim() || undefined },
        })),
        initial,
      );
      setCloze({ text: "", extra: "" });
    }
    if (!keepOpen) onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title={card ? "Editar card" : "Novo card"}>
      <form onSubmit={submit} className="grid gap-4">
        {!card && (
          <fieldset className="flex gap-2">
            <legend className="sr-only">Tipo de card</legend>
            {(
              [
                ["basic", "Frente e verso"],
                ["cloze", "Lacunas"],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className={`flex min-h-10 flex-1 cursor-pointer items-center justify-center rounded-lg border text-sm ${
                  kind === value
                    ? "border-accent bg-accent-soft font-medium text-accent"
                    : "border-line text-muted"
                }`}
              >
                <input
                  type="radio"
                  name="tipo"
                  className="sr-only"
                  checked={kind === value}
                  onChange={() => setKind(value)}
                />
                {label}
              </label>
            ))}
          </fieldset>
        )}

        {kind === "plugin" && (
          <p className="text-sm text-muted">
            Card de plugin: o modelo interativo continua o mesmo na revisão. Aqui você muda a
            pergunta, a resposta e a imagem que aparece quando o plugin não está disponível.
          </p>
        )}
        {kind === "basic" || kind === "plugin" ? (
          <>
            <Field label="Frente">
              {(id) => (
                <Textarea
                  id={id}
                  rows={2}
                  value={basic.front}
                  autoFocus
                  onChange={(e) => setBasic({ ...basic, front: e.target.value })}
                />
              )}
            </Field>
            <ImagePicker
              label={kind === "plugin" ? "Imagem de reserva" : "Imagem na frente"}
              value={basic.frontImage}
              onChange={(frontImage) => setBasic({ ...basic, frontImage })}
            />
            <Field label="Verso">
              {(id) => (
                <Textarea
                  id={id}
                  rows={2}
                  value={basic.back}
                  onChange={(e) => setBasic({ ...basic, back: e.target.value })}
                />
              )}
            </Field>
            {kind === "basic" && (
              <ImagePicker
                label="Imagem no verso"
                value={basic.backImage}
                onChange={(backImage) => setBasic({ ...basic, backImage })}
              />
            )}
          </>
        ) : (
          <>
            <Field
              label="Texto"
              hint="Selecione um trecho e toque em “Marcar lacuna”, ou escreva {{c1::resposta}}. Cada número vira um card."
            >
              {(id) => (
                <Textarea
                  id={id}
                  ref={clozeRef}
                  rows={4}
                  value={cloze.text}
                  autoFocus
                  onChange={(e) => setCloze({ ...cloze, text: e.target.value })}
                />
              )}
            </Field>
            <div className="flex items-center justify-between gap-2">
              <Button size="sm" onClick={markCloze} disabled={Boolean(card)}>
                Marcar lacuna
              </Button>
              <span className="text-xs text-muted">
                {indexes.length === 0
                  ? "Nenhuma lacuna"
                  : `${indexes.length} lacuna${indexes.length > 1 ? "s" : ""}`}
              </span>
            </div>
            <Field label="Observação no verso (opcional)">
              {(id) => (
                <Textarea
                  id={id}
                  rows={2}
                  value={cloze.extra}
                  onChange={(e) => setCloze({ ...cloze, extra: e.target.value })}
                />
              )}
            </Field>
          </>
        )}

        {!card && (
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={keepOpen}
              onChange={(e) => setKeepOpen(e.target.checked)}
            />
            Continuar adicionando
          </label>
        )}
        <DialogActions>
          <Button onClick={onClose}>Fechar</Button>
          <Button type="submit" variant="primary" disabled={!valid}>
            {card ? "Salvar" : "Adicionar"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
