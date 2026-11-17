import { InputRule } from "@tiptap/core";
import Mention from "@tiptap/extension-mention";
import { type NodeViewProps, NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { useNavigate } from "react-router";
import { normalize, noteLabel, useNoteTitles } from "./titles";

interface Suggestion {
  /** `null` = criar uma nota nova com o texto digitado. */
  id: string | null;
  label: string;
}

interface NoteLinkOptions {
  /** Nota que está sendo editada (não aparece nas sugestões). */
  currentNoteId: string;
  createNote: (title: string) => Promise<string>;
}

/** Link dentro do texto: mostra o título atual da nota e leva até ela. */
function NoteLinkView({ node }: NodeViewProps) {
  const navigate = useNavigate();
  const id = node.attrs.id as string;
  /** Texto escolhido pelo usuário com `[[Nota]](texto)`; sem ele, mostra o título da nota. */
  const custom = node.attrs.text as string | null;
  const title = useNoteTitles((s) => s.titles.get(id));
  const missing = useNoteTitles((s) => s.loaded && !s.titles.has(id));
  return (
    <NodeViewWrapper as="span" className="inline">
      <button
        type="button"
        contentEditable={false}
        data-note-link={id}
        disabled={missing}
        title={
          missing
            ? "Esta nota foi excluída"
            : custom
              ? `Abre a nota “${noteLabel(title)}”`
              : undefined
        }
        onClick={() => navigate(`/notas/${id}`)}
        className={
          missing
            ? "cursor-default rounded px-1 text-muted line-through"
            : "cursor-pointer rounded bg-accent-soft px-1 font-medium text-accent hover:underline"
        }
      >
        {custom ||
          (missing
            ? (node.attrs.label as string)
            : noteLabel(title ?? (node.attrs.label as string)))}
      </button>
    </NodeViewWrapper>
  );
}

/** Lista de sugestões que aparece ao digitar `[[`. DOM puro, posicionado no cursor. */
function suggestionPopup() {
  let el: HTMLDivElement | null = null;
  let items: Suggestion[] = [];
  let selected = 0;
  let pick: (item: Suggestion) => void = () => {};

  const draw = () => {
    if (!el) return;
    el.replaceChildren(
      ...items.map((item, index) => {
        const option = document.createElement("button");
        option.type = "button";
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", String(index === selected));
        option.className = `flex min-h-10 w-full items-center rounded-lg px-3 text-left text-sm ${
          index === selected ? "bg-accent-soft text-accent" : "text-fg"
        }`;
        option.textContent = item.id ? noteLabel(item.label) : `Criar nota “${item.label}”`;
        // mousedown (e não click) para não tirar o foco do editor antes de inserir.
        option.addEventListener("mousedown", (event) => {
          event.preventDefault();
          pick(item);
        });
        return option;
      }),
    );
    if (items.length === 0) {
      const empty = document.createElement("p");
      empty.className = "px-3 py-2 text-sm text-muted";
      empty.textContent = "Digite o título da nota";
      el.append(empty);
    }
  };

  const place = (rect: DOMRect | null | undefined) => {
    if (!el || !rect) return;
    const width = Math.min(320, window.innerWidth - 16);
    el.style.width = `${width}px`;
    el.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`;
    const below = rect.bottom + 6;
    const fitsBelow = below + el.offsetHeight < window.innerHeight - 8;
    el.style.top = `${fitsBelow ? below : Math.max(8, rect.top - el.offsetHeight - 6)}px`;
  };

  type Props = {
    items: Suggestion[];
    command: (item: Suggestion) => void;
    clientRect?: (() => DOMRect | null) | null;
  };
  const update = (props: Props) => {
    items = props.items;
    selected = Math.min(selected, Math.max(items.length - 1, 0));
    pick = props.command;
    draw();
    place(props.clientRect?.());
  };

  return {
    onStart(props: Props) {
      el = document.createElement("div");
      el.setAttribute("role", "listbox");
      el.setAttribute("aria-label", "Notas");
      el.className =
        "fixed z-50 grid gap-0.5 rounded-xl border border-line bg-surface p-1 text-fg shadow-lg";
      document.body.append(el);
      selected = 0;
      update(props);
    },
    onUpdate: update,
    onKeyDown({ event }: { event: KeyboardEvent }) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        const step = event.key === "ArrowDown" ? 1 : -1;
        selected = (selected + step + items.length) % Math.max(items.length, 1);
        draw();
        return true;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        const item = items[selected];
        if (item) pick(item);
        return true;
      }
      return false;
    },
    onExit() {
      el?.remove();
      el = null;
    },
  };
}

/**
 * Extensão do editor para links entre notas. Digitar `[[` abre a lista de notas;
 * escolher uma insere um link que guarda o id (renomear a nota não quebra o link).
 */
export function createNoteLink({ currentNoteId, createNote }: NoteLinkOptions) {
  /** Id da nota com esse título (sem diferenciar acentos); `undefined` se não existir. */
  const findByTitle = (wanted: string) => {
    const key = normalize(wanted.trim());
    for (const [id, title] of useNoteTitles.getState().titles) {
      if (id !== currentNoteId && normalize(noteLabel(title)) === key) return id;
    }
    return undefined;
  };

  return Mention.extend({
    name: "noteLink",
    addAttributes() {
      return {
        ...this.parent?.(),
        text: {
          default: null,
          parseHTML: (el) => el.getAttribute("data-text"),
          renderHTML: (attrs) => (attrs.text ? { "data-text": attrs.text } : {}),
        },
      };
    },
    addInputRules() {
      const type = this.type;
      return [
        // Digitar [[Título]] vira link (criando a nota se ela não existir).
        new InputRule({
          find: /\[\[([^[\]\n]+)\]\]$/,
          handler: ({ state, range, match, chain }) => {
            const title = (match[1] ?? "").trim();
            if (!title) return null;
            const existing = findByTitle(title);
            if (existing) {
              state.tr.replaceWith(
                range.from,
                range.to,
                type.create({ id: existing, label: title }),
              );
              return;
            }
            // Nota nova: remove o texto agora e insere o link quando ela estiver criada.
            const at = range.from;
            chain().deleteRange(range).run();
            void createNote(title).then((id) =>
              this.editor
                .chain()
                .insertContentAt(Math.min(at, this.editor.state.doc.content.size), {
                  type: "noteLink",
                  attrs: { id, label: title },
                })
                .run(),
            );
          },
        }),
        // Digitar (texto) logo depois de um link define o texto exibido: [[Nota]](texto).
        new InputRule({
          find: /\(([^()\n]+)\)$/,
          handler: ({ state, range, match }) => {
            const before = state.doc.resolve(range.from).nodeBefore;
            if (before?.type !== type) return null;
            const text = (match[1] ?? "").trim();
            if (!text) return null;
            const linkPos = range.from - before.nodeSize;
            state.tr
              .delete(range.from, range.to)
              .setNodeMarkup(linkPos, undefined, { ...before.attrs, text });
          },
        }),
      ];
    },
    addNodeView() {
      return ReactNodeViewRenderer(NoteLinkView);
    },
  }).configure({
    // No texto plano (busca), o link aparece como o título da nota.
    renderText: ({ node }) =>
      node.attrs.text ||
      noteLabel(useNoteTitles.getState().titles.get(node.attrs.id) ?? node.attrs.label),
    suggestion: {
      char: "[[",
      // Abre a lista mesmo colado a uma palavra (ex.: "ver[[") ou inserido pelo botão.
      allowedPrefixes: null,
      allowSpaces: true,
      items: ({ query }): Suggestion[] => {
        const wanted = normalize(query.replace(/\]+$/, "").trim());
        const matches: Suggestion[] = [];
        let exact = false;
        for (const [id, title] of useNoteTitles.getState().titles) {
          if (id === currentNoteId) continue;
          const candidate = normalize(noteLabel(title));
          if (candidate === wanted) exact = true;
          if (candidate.includes(wanted) && matches.length < 7) matches.push({ id, label: title });
        }
        const typed = query.replace(/\]+$/, "").trim();
        return typed && !exact ? [...matches, { id: null, label: typed }] : matches;
      },
      command: ({ editor, range, props }) => {
        const item = props as Suggestion;
        const insert = (id: string) =>
          editor
            .chain()
            .focus()
            .insertContentAt(range, [
              { type: "noteLink", attrs: { id, label: item.label } },
              { type: "text", text: " " },
            ])
            .run();
        if (item.id) insert(item.id);
        else void createNote(item.label).then(insert);
      },
      render: suggestionPopup,
    },
  });
}

/** Ids das notas citadas em um documento do editor. */
export function linkTargets(doc: unknown): string[] {
  const found: string[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const n = node as { type?: string; attrs?: { id?: unknown }; content?: unknown[] };
    if (n.type === "noteLink" && typeof n.attrs?.id === "string") found.push(n.attrs.id);
    n.content?.forEach(walk);
  };
  walk(doc);
  return found;
}
