/**
 * Converte texto puro (vindo de um plugin) num documento do editor, sem aceitar HTML: só
 * parágrafos, títulos (`## `, `### `), listas (`- `, `* `, `• `) e quebras de linha.
 */

type Inline = { type: "text"; text: string } | { type: "hardBreak" };
type Block =
  | { type: "paragraph"; content?: Inline[] }
  | { type: "heading"; attrs: { level: 2 | 3 }; content: Inline[] }
  | { type: "bulletList"; content: { type: "listItem"; content: Block[] }[] };

export interface NoteDoc {
  type: "doc";
  content: Block[];
}

const BULLET = /^\s*[-*•]\s+(.*)$/;
const HEADING = /^(#{2,3})\s+(.*)$/;

/** Texto com quebras de linha → nós de texto separados por `hardBreak`. */
function inline(lines: string[]): Inline[] {
  const out: Inline[] = [];
  lines.forEach((line, i) => {
    if (i > 0) out.push({ type: "hardBreak" });
    if (line) out.push({ type: "text", text: line });
  });
  return out;
}

export function textToNoteDoc(text: string): NoteDoc {
  const content: Block[] = [];
  let paragraph: string[] = [];
  let bullets: string[] = [];

  const flushParagraph = () => {
    const lines = paragraph.map((l) => l.trimEnd());
    while (lines.length && !lines.at(-1)) lines.pop();
    if (lines.length) content.push({ type: "paragraph", content: inline(lines) });
    paragraph = [];
  };
  const flushBullets = () => {
    if (bullets.length) {
      content.push({
        type: "bulletList",
        content: bullets.map((b) => ({
          type: "listItem",
          content: [b ? { type: "paragraph", content: inline([b]) } : { type: "paragraph" }],
        })),
      });
    }
    bullets = [];
  };

  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.replace(/\t/g, " ");
    if (!line.trim()) {
      flushParagraph();
      flushBullets();
      continue;
    }
    const heading = HEADING.exec(line.trim());
    if (heading?.[2]?.trim()) {
      flushParagraph();
      flushBullets();
      content.push({
        type: "heading",
        attrs: { level: heading[1] === "##" ? 2 : 3 },
        content: [{ type: "text", text: heading[2].trim() }],
      });
      continue;
    }
    const bullet = BULLET.exec(line);
    if (bullet) {
      flushParagraph();
      bullets.push((bullet[1] ?? "").trim());
      continue;
    }
    flushBullets();
    paragraph.push(line);
  }
  flushParagraph();
  flushBullets();
  return { type: "doc", content: content.length ? content : [{ type: "paragraph" }] };
}

/** Texto sem marcações, para a busca (o mesmo que o editor guardaria). */
export function plainTextOf(doc: NoteDoc): string {
  const parts: string[] = [];
  const walk = (blocks: Block[]) => {
    for (const block of blocks) {
      if (block.type === "bulletList") {
        for (const item of block.content) walk(item.content);
      } else {
        parts.push((block.content ?? []).map((n) => (n.type === "text" ? n.text : "\n")).join(""));
      }
    }
  };
  walk(doc.content);
  return parts.join("\n");
}
