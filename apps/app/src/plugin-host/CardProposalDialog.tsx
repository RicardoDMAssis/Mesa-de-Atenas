import { createCards, listDecks } from "@estudarella/db";
import { useEffect, useState } from "react";
import { Button, Dialog, DialogActions, Field, Select, Textarea } from "../components/ui";
import { useDatabase } from "../data/DatabaseProvider";
import { useLiveQuery } from "../data/useLiveQuery";
import { ImagePicker } from "../features/cards/CardEditor";
import { useCardProposal } from "./stores";

interface Draft {
  front: string;
  back: string;
  frontImage?: string;
  backImage?: string;
}

/**
 * Confirmação de um card proposto por plugin. Tudo é personalizável antes de criar:
 * pergunta, resposta e imagens. Num card visual, o modelo interativo continua sendo do
 * plugin; o texto e a imagem personalizados aparecem na revisão e servem de reserva.
 */
export function CardProposalDialog() {
  const { db, scheduler } = useDatabase();
  const proposal = useCardProposal((s) => s.proposal);
  const decks = useLiveQuery(["decks"], (db) => listDecks(db, Date.now()));
  const [draft, setDraft] = useState<Draft>({ front: "", back: "" });
  const [deckId, setDeckId] = useState("");

  // Só ao chegar uma proposta nova: a lista de baralhos mudar não apaga o que foi editado.
  useEffect(() => {
    if (!proposal) return;
    setDraft({ front: proposal.front, back: proposal.back, frontImage: proposal.visual?.image });
  }, [proposal]);

  useEffect(() => {
    setDeckId((current) => current || decks.data?.[0]?.id || "");
  }, [decks.data]);

  if (!proposal) return null;
  const list = decks.data ?? [];
  const visual = proposal.visual;
  const front = draft.front.trim();
  const back = draft.back.trim();
  const valid =
    Boolean(deckId) && (front || draft.frontImage) && (back || (!visual && draft.backImage));

  return (
    <Dialog
      open
      onClose={() => proposal.resolve(false)}
      title={visual ? "Criar card visual" : "Criar card"}
      description={`Sugerido por ${proposal.pluginName}. Personalize como quiser antes de criar.`}
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
            if (!valid) return;
            await createCards(
              db,
              deckId,
              [
                visual
                  ? {
                      type: "plugin",
                      pluginId: visual.pluginId,
                      content: visual.content,
                      fallback: {
                        front,
                        back,
                        ...(draft.frontImage ? { imageAssetId: draft.frontImage } : {}),
                      },
                      origin: { pluginId: proposal.pluginId },
                    }
                  : {
                      type: "basic",
                      content: {
                        front,
                        back,
                        ...(draft.frontImage ? { frontImage: draft.frontImage } : {}),
                        ...(draft.backImage ? { backImage: draft.backImage } : {}),
                      },
                      origin: { pluginId: proposal.pluginId },
                    },
              ],
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
          {visual && (
            <p className="text-sm text-muted">
              Na revisão, {proposal.pluginName} mostra o card interativo junto com a pergunta e a
              resposta abaixo.
            </p>
          )}
          <Field label={visual ? "Pergunta" : "Frente"}>
            {(id) => (
              <Textarea
                id={id}
                rows={2}
                value={draft.front}
                onChange={(e) => setDraft({ ...draft, front: e.target.value })}
              />
            )}
          </Field>
          <ImagePicker
            label={visual ? "Imagem de reserva" : "Imagem na frente"}
            value={draft.frontImage}
            onChange={(frontImage) => setDraft({ ...draft, frontImage })}
          />
          <Field label={visual ? "Resposta" : "Verso"}>
            {(id) => (
              <Textarea
                id={id}
                rows={visual ? 2 : 5}
                value={draft.back}
                onChange={(e) => setDraft({ ...draft, back: e.target.value })}
              />
            )}
          </Field>
          {!visual && (
            <ImagePicker
              label="Imagem no verso"
              value={draft.backImage}
              onChange={(backImage) => setDraft({ ...draft, backImage })}
            />
          )}
          <DialogActions>
            <Button onClick={() => proposal.resolve(false)}>Cancelar</Button>
            <Button type="submit" variant="primary" disabled={!valid}>
              Criar card
            </Button>
          </DialogActions>
        </form>
      )}
    </Dialog>
  );
}
