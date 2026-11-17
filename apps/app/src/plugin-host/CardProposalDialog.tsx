import { createCards, listDecks } from "@estudarella/db";
import { useEffect, useState } from "react";
import { Button, Dialog, DialogActions, Field, Select, Textarea } from "../components/ui";
import { useDatabase } from "../data/DatabaseProvider";
import { useLiveQuery } from "../data/useLiveQuery";
import { useCardProposal } from "./stores";

/** Confirmação de um card proposto por plugin: o usuário revisa, escolhe o baralho e cria. */
export function CardProposalDialog() {
  const { db, scheduler } = useDatabase();
  const proposal = useCardProposal((s) => s.proposal);
  const decks = useLiveQuery(["decks"], (db) => listDecks(db, Date.now()));
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [deckId, setDeckId] = useState("");

  useEffect(() => {
    if (!proposal) return;
    setFront(proposal.front);
    setBack(proposal.back);
    setDeckId((current) => current || decks.data?.[0]?.id || "");
  }, [proposal, decks.data]);

  if (!proposal) return null;
  const list = decks.data ?? [];
  return (
    <Dialog
      open
      onClose={() => proposal.resolve(false)}
      title="Criar card"
      description={`Sugerido por ${proposal.pluginName}. Revise antes de criar.`}
    >
      {list.length === 0 ? (
        <>
          <p className="text-sm text-muted">Crie um baralho em Revisão antes de adicionar cards.</p>
          <DialogActions>
            <Button onClick={() => proposal.resolve(false)}>Fechar</Button>
          </DialogActions>
        </>
      ) : (
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!front.trim() || !back.trim() || !deckId) return;
            await createCards(
              db,
              deckId,
              [{ type: "basic", content: { front: front.trim(), back: back.trim() } }],
              scheduler.newCard(new Date()),
            );
            proposal.resolve(true);
          }}
        >
          <Field label="Baralho">
            {(id) => (
              <Select id={id} value={deckId} onChange={(e) => setDeckId(e.target.value)}>
                {list.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Frente">
            {(id) => (
              <Textarea id={id} rows={2} value={front} onChange={(e) => setFront(e.target.value)} />
            )}
          </Field>
          <Field label="Verso">
            {(id) => (
              <Textarea id={id} rows={5} value={back} onChange={(e) => setBack(e.target.value)} />
            )}
          </Field>
          <DialogActions>
            <Button onClick={() => proposal.resolve(false)}>Cancelar</Button>
            <Button type="submit" variant="primary" disabled={!front.trim() || !back.trim()}>
              Criar card
            </Button>
          </DialogActions>
        </form>
      )}
    </Dialog>
  );
}
