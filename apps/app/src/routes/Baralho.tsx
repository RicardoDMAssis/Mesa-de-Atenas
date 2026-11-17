import { type Card, deleteCard, deleteDeck, getDeck, listCards, updateDeck } from "@estudarella/db";
import { ArrowLeft, ImageIcon, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { PageTitle } from "../components/Card";
import { SubjectSelect } from "../components/SubjectSelect";
import {
  Button,
  ConfirmDialog,
  Dialog,
  DialogActions,
  EmptyState,
  Field,
  Input,
  Menu,
} from "../components/ui";
import { useDatabase } from "../data/DatabaseProvider";
import { useLiveQuery } from "../data/useLiveQuery";
import { CardEditor } from "../features/cards/CardEditor";
import { cardSummary } from "../features/cards/CardView";

const dueFormat = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" });

export function Baralho() {
  const { id = "" } = useParams();
  const { db } = useDatabase();
  const navigate = useNavigate();
  const deck = useLiveQuery(["decks"], (db) => getDeck(db, id), [id]);
  const cards = useLiveQuery(["cards"], (db) => listCards(db, id), [id]);
  const [editing, setEditing] = useState<Card | "new" | null>(null);
  const [removing, setRemoving] = useState<Card | "deck" | null>(null);
  const [settings, setSettings] = useState(false);
  const [form, setForm] = useState({ name: "", subjectId: null as string | null });

  useEffect(() => {
    if (deck.data) setForm({ name: deck.data.name, subjectId: deck.data.subjectId });
  }, [deck.data]);

  if (deck.loading) return null;
  if (!deck.data) {
    return <EmptyState title="Baralho não encontrado" action={<Link to="/revisao">Voltar</Link>} />;
  }

  const list = cards.data ?? [];
  return (
    <>
      <Link
        to="/revisao"
        className="mb-4 inline-flex min-h-9 items-center gap-1.5 text-sm text-muted hover:text-fg"
      >
        <ArrowLeft size={16} aria-hidden />
        Revisão
      </Link>
      <div className="flex items-start justify-between gap-2">
        <PageTitle subtitle={`${list.length} cards`}>{deck.data.name}</PageTitle>
        <div className="flex items-center gap-1">
          <Button variant="primary" onClick={() => setEditing("new")}>
            <Plus size={18} aria-hidden />
            Card
          </Button>
          <Menu
            label="Ações do baralho"
            items={[
              { label: "Renomear / matéria", onSelect: () => setSettings(true) },
              { label: "Estudar agora", onSelect: () => navigate(`/estudar?baralho=${id}`) },
              { label: "Excluir baralho", danger: true, onSelect: () => setRemoving("deck") },
            ]}
          />
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState
          title="Baralho vazio"
          action={
            <Button variant="primary" onClick={() => setEditing("new")}>
              Adicionar o primeiro card
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-2">
          {list.map((card) => {
            const s = cardSummary(card);
            return (
              <li
                key={card.id}
                className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3"
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => setEditing(card)}
                >
                  <p className="truncate text-sm font-medium">
                    {s.hasImage && (
                      <ImageIcon
                        size={14}
                        className="mr-1 inline text-muted"
                        aria-label="Com imagem"
                      />
                    )}
                    {s.front || "(imagem)"}
                  </p>
                  <p className="truncate text-xs text-muted">{s.back}</p>
                </button>
                <span className="shrink-0 text-xs text-muted">
                  {card.state === 0 ? "novo" : dueFormat.format(card.due)}
                </span>
                <Menu
                  label="Ações do card"
                  items={[
                    { label: "Editar", onSelect: () => setEditing(card) },
                    { label: "Excluir", danger: true, onSelect: () => setRemoving(card) },
                  ]}
                />
              </li>
            );
          })}
        </ul>
      )}

      <CardEditor
        open={editing !== null}
        onClose={() => setEditing(null)}
        deckId={id}
        card={editing === "new" || editing === null ? undefined : editing}
      />

      <Dialog open={settings} onClose={() => setSettings(false)} title="Baralho">
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!form.name.trim()) return;
            await updateDeck(db, id, form);
            setSettings(false);
          }}
        >
          <Field label="Nome">
            {(fid) => (
              <Input
                id={fid}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            )}
          </Field>
          <Field label="Matéria">
            {(fid) => (
              <SubjectSelect
                id={fid}
                value={form.subjectId}
                onChange={(subjectId) => setForm({ ...form, subjectId })}
              />
            )}
          </Field>
          <DialogActions>
            <Button onClick={() => setSettings(false)}>Cancelar</Button>
            <Button type="submit" variant="primary">
              Salvar
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={removing === "deck" ? "Excluir este baralho?" : "Excluir este card?"}
        message={
          removing === "deck"
            ? "Todos os cards dele e o histórico de revisão deixam de aparecer."
            : "O histórico de revisão dele deixa de aparecer."
        }
        confirmLabel="Excluir"
        onConfirm={async () => {
          if (removing === "deck") {
            await deleteDeck(db, id);
            navigate("/revisao");
          } else if (removing) {
            await deleteCard(db, removing.id);
          }
        }}
      />
    </>
  );
}
