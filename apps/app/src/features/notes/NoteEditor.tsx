import Placeholder from "@tiptap/extension-placeholder";
import { type Editor, EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Heading2, Italic, Link2, List, ListOrdered, Quote } from "lucide-react";
import { useEffect, useMemo } from "react";
import { createNoteLink } from "./noteLink";

export interface EditorSnapshot {
  content: unknown;
  plainText: string;
}

export const snapshot = (editor: Editor): EditorSnapshot => ({
  content: editor.getJSON(),
  plainText: editor.getText({ blockSeparator: "\n" }),
});

interface NoteEditorProps {
  noteId: string;
  initialContent: unknown;
  createNote: (title: string) => Promise<string>;
  onChange: (snapshot: EditorSnapshot) => void;
  /** `false` = modo leitura: sem barra de formatação e sem edição (links continuam clicáveis). */
  editable?: boolean;
}

export function NoteEditor({
  noteId,
  initialContent,
  createNote,
  onChange,
  editable = true,
}: NoteEditorProps) {
  const extensions = useMemo(
    () => [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Placeholder.configure({
        placeholder:
          "Escreva aqui. Para citar outra nota: [[Título]] ou [[Título]](texto do link).",
      }),
      createNoteLink({ currentNoteId: noteId, createNote }),
    ],
    [noteId, createNote],
  );

  const editor = useEditor({
    extensions,
    editable,
    content: (initialContent as object | null) ?? "",
    editorProps: {
      attributes: {
        class: "note-content min-h-64 outline-none",
        "aria-label": "Conteúdo da nota",
      },
    },
    onUpdate: ({ editor }) => onChange(snapshot(editor)),
  });

  useEffect(() => {
    // Troca de modo sem disparar onChange (não é uma edição do conteúdo).
    if (editor && editor.isEditable !== editable) editor.setEditable(editable, false);
  }, [editor, editable]);

  if (!editor) return null;
  return (
    <div>
      {editable && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const active = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      heading: editor.isActive("heading", { level: 2 }),
      bullet: editor.isActive("bulletList"),
      ordered: editor.isActive("orderedList"),
      quote: editor.isActive("blockquote"),
    }),
  });

  const tools = [
    {
      label: "Negrito",
      icon: Bold,
      on: active.bold,
      run: () => editor.chain().focus().toggleBold().run(),
    },
    {
      label: "Itálico",
      icon: Italic,
      on: active.italic,
      run: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      label: "Título",
      icon: Heading2,
      on: active.heading,
      run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      label: "Lista",
      icon: List,
      on: active.bullet,
      run: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      label: "Lista numerada",
      icon: ListOrdered,
      on: active.ordered,
      run: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      label: "Citação",
      icon: Quote,
      on: active.quote,
      run: () => editor.chain().focus().toggleBlockquote().run(),
    },
    {
      label: "Citar outra nota",
      icon: Link2,
      on: false,
      run: () => editor.chain().focus().insertContent("[[").run(),
    },
  ];

  return (
    <div
      role="toolbar"
      aria-label="Formatação"
      className="sticky top-0 z-10 -mx-1 mb-3 flex gap-0.5 overflow-x-auto border-b border-line bg-bg px-1 py-1.5"
    >
      {tools.map(({ label, icon: Icon, on, run }) => (
        <button
          key={label}
          type="button"
          aria-label={label}
          title={label}
          aria-pressed={on}
          // Mantém a seleção do texto ao tocar no botão.
          onMouseDown={(event) => event.preventDefault()}
          onClick={run}
          className={`inline-flex size-10 shrink-0 items-center justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-accent ${
            on ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface hover:text-fg"
          }`}
        >
          <Icon size={18} aria-hidden />
        </button>
      ))}
    </div>
  );
}
