import {
  createSubject,
  deleteSubject,
  moveSubject,
  normalizeTag,
  renameSubject,
  type Subject,
  setSubjectTags,
  subtreeIds,
} from "@estudarella/db";
import { Plus } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { SubjectSelect } from "../../components/SubjectSelect";
import {
  Button,
  ConfirmDialog,
  Dialog,
  DialogActions,
  Field,
  IconButton,
  Input,
  Menu,
  PromptDialog,
} from "../../components/ui";
import { useDatabase } from "../../data/DatabaseProvider";
import { useSubjects } from "../../data/hooks";
import { subjectTagActivations } from "../../plugin-host/activation";
import { usePlugins } from "../../plugin-host/registry";

/** Filtro escolhido na árvore: tudo, só o que não tem matéria, ou uma matéria. */
export type SubjectFilter = "all" | "none" | string;

type Action =
  | { kind: "create"; parent: Subject | null }
  | { kind: "rename"; subject: Subject }
  | { kind: "tags"; subject: Subject }
  | { kind: "move"; subject: Subject }
  | { kind: "delete"; subject: Subject };

const LEVEL = ["matéria", "tópico", "subtópico"];

export function SubjectTree({
  selected,
  onSelect,
}: {
  selected: SubjectFilter;
  onSelect: (filter: SubjectFilter) => void;
}) {
  const { db } = useDatabase();
  const { flat, list } = useSubjects();
  const [action, setAction] = useState<Action | null>(null);
  const [moveTarget, setMoveTarget] = useState<string | null>(null);
  const close = () => setAction(null);

  const row = (active: boolean) =>
    `flex min-h-10 w-full items-center rounded-lg px-3 text-left text-sm ${
      active ? "bg-accent-soft font-medium text-accent" : "text-fg hover:bg-bg"
    }`;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <h2 className="px-3 text-xs font-semibold uppercase tracking-wide text-muted">Matérias</h2>
        <IconButton
          label="Nova matéria"
          onClick={() => setAction({ kind: "create", parent: null })}
        >
          <Plus size={18} aria-hidden />
        </IconButton>
      </div>
      <ul className="grid gap-0.5">
        <li>
          <button type="button" className={row(selected === "all")} onClick={() => onSelect("all")}>
            Todas as notas
          </button>
        </li>
        {flat.map(({ item, depth }) => (
          <li key={item.id} className="flex items-center" style={{ paddingLeft: depth * 14 }}>
            <button
              type="button"
              className={`${row(selected === item.id)} min-w-0 flex-1`}
              onClick={() => onSelect(item.id)}
            >
              <span className="truncate">{item.name}</span>
            </button>
            <Menu
              label={`Ações de ${item.name}`}
              items={[
                {
                  label: `Novo ${LEVEL[Math.min(depth + 1, 2)]} aqui`,
                  onSelect: () => setAction({ kind: "create", parent: item }),
                },
                { label: "Renomear", onSelect: () => setAction({ kind: "rename", subject: item }) },
                { label: "Etiquetas", onSelect: () => setAction({ kind: "tags", subject: item }) },
                {
                  label: "Mover",
                  onSelect: () => {
                    setMoveTarget(item.parentId);
                    setAction({ kind: "move", subject: item });
                  },
                },
                {
                  label: "Excluir",
                  danger: true,
                  onSelect: () => setAction({ kind: "delete", subject: item }),
                },
              ]}
            />
          </li>
        ))}
        <li>
          <button
            type="button"
            className={row(selected === "none")}
            onClick={() => onSelect("none")}
          >
            Sem matéria
          </button>
        </li>
      </ul>

      <PromptDialog
        open={action?.kind === "create"}
        onClose={close}
        title={
          action?.kind === "create" && action.parent
            ? `Novo item em ${action.parent.name}`
            : "Nova matéria"
        }
        label="Nome"
        confirmLabel="Criar"
        onSubmit={async (name) => {
          if (action?.kind !== "create") return;
          const created = await createSubject(db, { name, parentId: action.parent?.id });
          onSelect(created.id);
        }}
      />
      <PromptDialog
        open={action?.kind === "rename"}
        onClose={close}
        title="Renomear"
        label="Nome"
        initial={action?.kind === "rename" ? action.subject.name : ""}
        onSubmit={async (name) => {
          if (action?.kind === "rename") await renameSubject(db, action.subject.id, name);
        }}
      />
      <TagsDialog
        subject={action?.kind === "tags" ? action.subject : null}
        onClose={close}
        onSave={async (tags) => {
          if (action?.kind === "tags") await setSubjectTags(db, action.subject.id, tags);
        }}
      />
      <Dialog
        open={action?.kind === "move"}
        onClose={close}
        title={action?.kind === "move" ? `Mover ${action.subject.name}` : "Mover"}
      >
        {action?.kind === "move" && (
          <>
            <Field label="Colocar dentro de">
              {(id) => (
                <SubjectSelect
                  id={id}
                  value={moveTarget}
                  onChange={setMoveTarget}
                  exclude={subtreeIds(list, action.subject.id)}
                  emptyLabel="Nenhuma (nível principal)"
                />
              )}
            </Field>
            <DialogActions>
              <Button onClick={close}>Cancelar</Button>
              <Button
                variant="primary"
                onClick={async () => {
                  await moveSubject(db, action.subject.id, moveTarget);
                  close();
                }}
              >
                Mover
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
      <ConfirmDialog
        open={action?.kind === "delete"}
        onClose={close}
        title={action?.kind === "delete" ? `Excluir ${action.subject.name}?` : "Excluir?"}
        message="Os tópicos dentro dela também são excluídos. Notas e baralhos são mantidos e ficam sem matéria."
        confirmLabel="Excluir"
        onConfirm={async () => {
          if (action?.kind !== "delete") return;
          const removed = subtreeIds(list, action.subject.id);
          await deleteSubject(db, action.subject.id);
          if (removed.includes(selected)) onSelect("all");
        }}
      />
    </div>
  );
}

/**
 * Etiquetas da matéria (ex.: "anatomia"). Valem também para os tópicos dentro dela e
 * fazem os plugins que as usam sugerirem abrir junto das notas.
 */
function TagsDialog({
  subject,
  onClose,
  onSave,
}: {
  subject: Subject | null;
  onClose: () => void;
  onSave: (tags: string[]) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const plugins = usePlugins((s) => s.plugins);
  useEffect(() => {
    if (subject) setValue(subject.tags.join(", "));
  }, [subject]);
  const known = subjectTagActivations(plugins);
  const tags = value.split(",").map(normalizeTag).filter(Boolean);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await onSave(tags);
    onClose();
  };

  return (
    <Dialog
      open={subject !== null}
      onClose={onClose}
      title={subject ? `Etiquetas de ${subject.name}` : "Etiquetas"}
      description="Valem também para os tópicos dentro desta matéria. Separe por vírgula."
    >
      <form onSubmit={submit} className="grid gap-3">
        <Field label="Etiquetas">
          {(id) => (
            <Input
              id={id}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="ex.: anatomia, fisiologia"
              autoFocus
              maxLength={200}
            />
          )}
        </Field>
        {known.length > 0 && (
          <div className="text-xs text-muted">
            <p>Etiquetas usadas pelos seus plugins:</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {known.map(({ tag, plugin }) => (
                <button
                  key={`${tag}-${plugin}`}
                  type="button"
                  className="rounded-full border border-line px-2 py-0.5 hover:border-accent"
                  onClick={() => !tags.includes(tag) && setValue([...tags, tag].join(", "))}
                >
                  {tag} · {plugin}
                </button>
              ))}
            </div>
          </div>
        )}
        <DialogActions>
          <Button onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="primary">
            Salvar
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
