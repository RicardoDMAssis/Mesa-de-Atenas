import { clozeIndexes } from "@estudarella/core";
import {
  applyCardText,
  createCards,
  createDeck,
  deleteCards,
  existingFronts,
  existingOwnKeys,
  listDecks,
  type NewCard,
  visibleText,
} from "@estudarella/db";
import type { BatchCardItem } from "@estudarella/plugin-api";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Dialog, DialogActions, Field, Select, Textarea } from "../components/ui";
import { useDatabase } from "../data/DatabaseProvider";
import { useLiveQuery } from "../data/useLiveQuery";
import { AssetImage } from "../features/cards/CardView";
import { type CardRequest, usePluginRequest } from "./stores";

/** Telas em que o usuário confirma o que um plugin pediu (Fase 4.1). */
export function PluginRequestDialog() {
  const request = usePluginRequest((s) => s.request);
  if (!request) return null;
  if (request.kind === "batch") return <BatchDialog request={request} />;
  if (request.kind === "update") return <UpdateDialog request={request} />;
  if (request.kind === "delete") return <DeleteDialog request={request} />;
  return <PickFileDialog request={request} />;
}

type Req<K extends CardRequest["kind"]> = Extract<CardRequest, { kind: K }>;

/** Frente e verso editáveis de um item do lote. */
interface Draft {
  item: BatchCardItem;
  front: string;
  back: string;
  checked: boolean;
}

const draftOf = (item: BatchCardItem): Draft => {
  if ("content" in item) {
    return { item, front: item.fallback.front, back: item.fallback.back, checked: true };
  }
  if ("cloze" in item) return { item, front: item.cloze, back: "", checked: true };
  return { item, front: item.front, back: item.back, checked: true };
};

const kindLabel = (item: BatchCardItem) =>
  "content" in item ? "visual" : "cloze" in item ? "lacunas" : null;

function BatchDialog({ request }: { request: Req<"batch"> }) {
  const { db, scheduler } = useDatabase();
  const decks = useLiveQuery(["decks"], (db) => listDecks(db, Date.now()));
  const NEW = "__novo";
  const [deckId, setDeckId] = useState("");
  const [drafts, setDrafts] = useState(() => request.items.map(draftOf));
  const [duplicates, setDuplicates] = useState<Set<number>>(new Set());
  const [open, setOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDeckId((current) => current || decks.data?.[0]?.id || NEW);
  }, [decks.data]);

  // Duplicados: a mesma chave já usada pelo plugin, ou (sem chave) a mesma frente no baralho.
  useEffect(() => {
    let cancelled = false;
    const keys = request.items.flatMap((i) => (i.key ? [i.key] : []));
    Promise.all([
      existingOwnKeys(db, request.pluginId, keys),
      deckId && deckId !== NEW ? existingFronts(db, deckId) : Promise.resolve(new Set<string>()),
    ]).then(([usedKeys, fronts]) => {
      if (cancelled) return;
      const dupes = new Set<number>();
      request.items.forEach((item, i) => {
        const front = draftOf(item).front.trim().toLowerCase();
        if (item.key ? usedKeys.has(item.key) : fronts.has(front)) dupes.add(i);
      });
      setDuplicates(dupes);
      setDrafts((all) => all.map((d, i) => ({ ...d, checked: !dupes.has(i) })));
    });
    return () => {
      cancelled = true;
    };
  }, [db, deckId, request]);

  const chosen = drafts.filter((d) => d.checked && d.front.trim());
  const setAll = (checked: boolean) => setDrafts((all) => all.map((d) => ({ ...d, checked })));
  const update = (i: number, patch: Partial<Draft>) =>
    setDrafts((all) => all.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  const create = async () => {
    setBusy(true);
    try {
      const target =
        deckId === NEW
          ? (await createDeck(db, { name: request.deckName ?? `Cards de ${request.pluginName}` }))
              .id
          : deckId;
      const origin = (key?: string) => ({ pluginId: request.pluginId, key });
      type Item = NewCard & { origin: ReturnType<typeof origin> };
      const items: Item[] = chosen.flatMap(({ item, front, back }): Item[] => {
        if ("content" in item) {
          return [
            {
              type: "plugin" as const,
              pluginId: request.pluginId,
              content: item.content,
              fallback: {
                front: front.trim(),
                back: back.trim(),
                ...(item.fallback.image ? { imageAssetId: item.fallback.image } : {}),
              },
              origin: origin(item.key),
            },
          ];
        }
        if ("cloze" in item) {
          return clozeIndexes(front).map((index) => ({
            type: "cloze" as const,
            content: { text: front, index, extra: back.trim() || undefined },
            origin: origin(item.key),
          }));
        }
        return [
          {
            type: "basic" as const,
            content: { front: front.trim(), back: back.trim() },
            origin: origin(item.key),
          },
        ];
      });
      request.resolve(await createCards(db, target, items, scheduler.newCard(new Date())));
    } finally {
      setBusy(false);
    }
  };

  const list = decks.data ?? [];
  return (
    <Dialog
      open
      onClose={() => request.resolve([])}
      title={`Criar ${request.items.length} cards`}
      description={`Sugeridos por ${request.pluginName}. Marque os que quer criar; toque num card para editar.`}
    >
      <div className="grid gap-3">
        <Field label="Baralho">
          {(id) => (
            <Select id={id} value={deckId} onChange={(e) => setDeckId(e.target.value)}>
              {list.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
              <option value={NEW}>
                + Novo baralho: {request.deckName ?? `Cards de ${request.pluginName}`}
              </option>
            </Select>
          )}
        </Field>
        <div className="flex items-center justify-between text-xs text-muted">
          <span>
            {chosen.length} de {drafts.length} marcados
            {duplicates.size > 0 && ` · ${duplicates.size} já existem`}
          </span>
          <span className="flex gap-3">
            <button type="button" className="font-medium text-accent" onClick={() => setAll(true)}>
              Marcar todos
            </button>
            <button type="button" className="font-medium text-accent" onClick={() => setAll(false)}>
              Nenhum
            </button>
          </span>
        </div>
        <ul className="grid max-h-[45dvh] gap-1 overflow-y-auto" aria-label="Cards sugeridos">
          {drafts.map((d, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a ordem do lote é fixa
            <li key={i} className="rounded-lg border border-line">
              <div className="flex items-center gap-2 p-2">
                <input
                  type="checkbox"
                  aria-label={`Criar o card ${d.front}`}
                  checked={d.checked}
                  onChange={(e) => update(i, { checked: e.target.checked })}
                />
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  aria-expanded={open === i}
                  onClick={() => setOpen(open === i ? null : i)}
                >
                  <span className="block truncate text-sm">{d.front}</span>
                  <span className="block truncate text-xs text-muted">
                    {[kindLabel(d.item), duplicates.has(i) ? "já existe" : null, d.back]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </button>
              </div>
              {open === i && (
                <div className="grid gap-2 border-t border-line p-2">
                  {"content" in d.item && d.item.fallback.image && (
                    <AssetImage hash={d.item.fallback.image} alt="Imagem do card" />
                  )}
                  <Field label={"cloze" in d.item ? "Texto com lacunas" : "Frente"}>
                    {(id) => (
                      <Textarea
                        id={id}
                        rows={2}
                        value={d.front}
                        onChange={(e) => update(i, { front: e.target.value })}
                      />
                    )}
                  </Field>
                  <Field label={"cloze" in d.item ? "Observação no verso" : "Verso"}>
                    {(id) => (
                      <Textarea
                        id={id}
                        rows={2}
                        value={d.back}
                        onChange={(e) => update(i, { back: e.target.value })}
                      />
                    )}
                  </Field>
                </div>
              )}
            </li>
          ))}
        </ul>
        <DialogActions>
          <Button onClick={() => request.resolve([])}>Cancelar</Button>
          <Button
            variant="primary"
            disabled={busy || chosen.length === 0 || !deckId}
            onClick={create}
          >
            Criar {chosen.length} {chosen.length === 1 ? "card" : "cards"}
          </Button>
        </DialogActions>
      </div>
    </Dialog>
  );
}

const dateFormat = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });

function UpdateDialog({ request }: { request: Req<"update"> }) {
  const { db } = useDatabase();
  // Cards que o usuário já personalizou vêm desmarcados.
  const [checked, setChecked] = useState(() =>
    request.changes.map((c) => c.card.editedAt === null),
  );
  const count = checked.filter(Boolean).length;
  return (
    <Dialog
      open
      onClose={() => request.resolve(0)}
      title={`Corrigir ${request.changes.length} ${request.changes.length === 1 ? "card" : "cards"}`}
      description={`${request.pluginName} sugere mudar o texto destes cards. Veja antes e depois.`}
    >
      <ul className="grid max-h-[50dvh] gap-2 overflow-y-auto" aria-label="Correções sugeridas">
        {request.changes.map((change, i) => {
          const before = visibleText(change.card);
          return (
            <li key={change.card.id} className="rounded-lg border border-line p-2 text-sm">
              <label className="flex gap-2">
                <input
                  type="checkbox"
                  checked={checked[i] ?? false}
                  aria-label={`Aplicar a correção em ${before.front}`}
                  onChange={(e) =>
                    setChecked((all) => all.map((v, j) => (j === i ? e.target.checked : v)))
                  }
                />
                <span className="grid min-w-0 flex-1 gap-1">
                  {change.card.editedAt !== null && (
                    <span className="text-xs text-danger">
                      Você editou este card em {dateFormat.format(change.card.editedAt)}
                    </span>
                  )}
                  {(["front", "back"] as const).map((side) =>
                    change[side] !== undefined && change[side] !== before[side] ? (
                      <span key={side} className="grid gap-0.5">
                        <span className="text-xs text-muted">
                          {side === "front" ? "Frente" : "Verso"}
                        </span>
                        <del className="text-muted">{before[side] || "(vazio)"}</del>
                        <ins className="no-underline font-medium">{change[side]}</ins>
                      </span>
                    ) : null,
                  )}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <DialogActions>
        <Button onClick={() => request.resolve(0)}>Cancelar</Button>
        <Button
          variant="primary"
          disabled={count === 0}
          onClick={async () => {
            const chosen = request.changes.filter((_, i) => checked[i]);
            for (const c of chosen) await applyCardText(db, c.card, c);
            request.resolve(chosen.length);
          }}
        >
          Aplicar {count}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function DeleteDialog({ request }: { request: Req<"delete"> }) {
  const { db } = useDatabase();
  const [checked, setChecked] = useState(() => request.cards.map(() => true));
  const count = checked.filter(Boolean).length;
  return (
    <Dialog
      open
      onClose={() => request.resolve(0)}
      title={`Excluir ${request.cards.length} ${request.cards.length === 1 ? "card" : "cards"}?`}
      description={`${request.pluginName} sugere excluir estes cards (e o histórico de revisões deles).`}
    >
      <ul className="grid max-h-[50dvh] gap-1 overflow-y-auto" aria-label="Cards a excluir">
        {request.cards.map((card, i) => (
          <li key={card.id}>
            <label className="flex items-center gap-2 rounded-lg border border-line p-2 text-sm">
              <input
                type="checkbox"
                checked={checked[i] ?? false}
                onChange={(e) =>
                  setChecked((all) => all.map((v, j) => (j === i ? e.target.checked : v)))
                }
              />
              <span className="truncate">{visibleText(card).front}</span>
            </label>
          </li>
        ))}
      </ul>
      <DialogActions>
        <Button onClick={() => request.resolve(0)}>Cancelar</Button>
        <Button
          variant="danger"
          disabled={count === 0}
          onClick={async () => {
            const ids = request.cards.filter((_, i) => checked[i]).map((c) => c.id);
            await deleteCards(db, ids);
            request.resolve(ids.length);
          }}
        >
          Excluir {count}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** O seletor de arquivos só abre com um toque do usuário (e assim ele sabe quem pediu). */
function PickFileDialog({ request }: { request: Req<"pickFile"> }) {
  const input = useRef<HTMLInputElement>(null);
  const accept = useMemo(() => request.accept?.join(","), [request.accept]);
  return (
    <Dialog
      open
      onClose={() => request.resolve(null)}
      title="Abrir um arquivo"
      description={`${request.pluginName} quer abrir um arquivo. Ele recebe só o arquivo que você escolher.`}
    >
      <input
        ref={input}
        type="file"
        accept={accept}
        className="sr-only"
        aria-label="Arquivo para o plugin"
        onChange={(e) => request.resolve(e.target.files?.[0] ?? null)}
      />
      <DialogActions>
        <Button onClick={() => request.resolve(null)}>Cancelar</Button>
        <Button variant="primary" onClick={() => input.current?.click()}>
          Escolher arquivo
        </Button>
      </DialogActions>
    </Dialog>
  );
}
