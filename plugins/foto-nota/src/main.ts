import { app, PluginError } from "@estudarella/plugin-sdk";
import { guessTitle, tidyOcrText } from "./cleanup";
import { drawPhoto, type Photo, toJpeg } from "./image";
import { cancelReading, readText } from "./ocr";

/*
 * Foto para nota: o usuário tira ou escolhe fotos (livro, apostila, quadro), o plugin lê o
 * texto no próprio aparelho e sugere uma nota. O app mostra a nota para o usuário conferir,
 * escolher a matéria e confirmar. As fotos podem ficar guardadas num bloco no topo da nota.
 */

const MAX_PHOTOS = 10;
/** Lado maior da imagem entregue ao leitor (mais que isso só deixa lento). */
const OCR_SIDE = 2400;
/** Lado maior da foto guardada junto da nota. */
const KEEP_SIDE = 1800;
const LOW_CONFIDENCE = 60;

const root = document.getElementById("app") as HTMLElement;

interface EmbedData {
  fotos: string[];
}

interface Result {
  title: string;
  text: string;
  confidence: number;
}

const state: {
  photos: Photo[];
  result: Result | null;
  keepLines: boolean;
  raw: string;
  keepPhotos: boolean;
  hasNote: boolean;
} = { photos: [], result: null, keepLines: false, raw: "", keepPhotos: true, hasNote: false };

// ---------- DOM (sempre textContent) ----------

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> & { className?: string } = {},
  ...children: (Node | string | null | undefined | false)[]
): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  for (const child of children) if (child) node.append(child);
  return node;
}

function button(label: string, onClick: () => void, kind = "secondary", ariaLabel?: string) {
  const b = el("button", { type: "button", className: kind, textContent: label, onclick: onClick });
  if (ariaLabel) b.setAttribute("aria-label", ariaLabel);
  return b;
}

function show(...nodes: (Node | null | false)[]) {
  root.replaceChildren(...nodes.filter((n): n is Node => Boolean(n)));
}

function message(error: unknown): string {
  if (error instanceof PluginError) return error.message;
  return error instanceof Error ? error.message : String(error);
}

// ---------- escolher fotos ----------

/** Botão que abre a câmera ou a galeria (input de arquivo escondido atrás de um botão). */
function photoInput(label: string, kind: string, camera: boolean) {
  const input = el("input", {
    type: "file",
    accept: "image/*",
    multiple: !camera,
    className: "sr-only",
  });
  input.setAttribute("aria-label", label);
  if (camera) input.setAttribute("capture", "environment");
  input.onchange = () => {
    addPhotos([...(input.files ?? [])]);
    input.value = "";
  };
  const b = button(label, () => input.click(), kind);
  return el("span", {}, b, input);
}

function addPhotos(files: File[]) {
  const images = files.filter((f) => f.type.startsWith("image/"));
  const room = MAX_PHOTOS - state.photos.length;
  if (images.length > room) void app.ui.toast(`No máximo ${MAX_PHOTOS} fotos por nota.`);
  for (const file of images.slice(0, Math.max(0, room))) {
    state.photos.push({
      id: crypto.randomUUID(),
      file,
      rotation: 0,
      url: URL.createObjectURL(file),
    });
  }
  state.result = null;
  render();
}

function move(index: number, delta: number) {
  const target = index + delta;
  const [photo] = state.photos.splice(index, 1);
  if (photo) state.photos.splice(target, 0, photo);
  render();
}

function photoItem(photo: Photo, index: number) {
  const total = state.photos.length;
  const img = el("img", { src: photo.url, alt: `Foto ${index + 1}` });
  img.style.transform = `rotate(${photo.rotation}deg)`;
  return el(
    "li",
    { className: "photo" },
    el("div", { className: "thumb" }, img),
    el(
      "div",
      { className: "photo-actions" },
      el("span", { className: "muted" }, `Foto ${index + 1}`),
      button(
        "Girar",
        () => {
          photo.rotation = ((photo.rotation + 90) % 360) as Photo["rotation"];
          state.result = null;
          render();
        },
        "secondary small",
        `Girar a foto ${index + 1}`,
      ),
      total > 1 &&
        index > 0 &&
        button("↑", () => move(index, -1), "secondary small", `Subir a foto ${index + 1}`),
      total > 1 &&
        index < total - 1 &&
        button("↓", () => move(index, 1), "secondary small", `Descer a foto ${index + 1}`),
      button(
        "Remover",
        () => {
          URL.revokeObjectURL(photo.url);
          state.photos.splice(index, 1);
          state.result = null;
          render();
        },
        "secondary small",
        `Remover a foto ${index + 1}`,
      ),
    ),
  );
}

// ---------- leitura ----------

async function read() {
  const status = el("p", { className: "status", role: "status" }, "Preparando o leitor…");
  const bar = el("progress", { max: 1, value: 0 });
  show(
    el("h1", {}, "Lendo o texto"),
    status,
    bar,
    el("p", { className: "muted" }, "Na primeira vez demora um pouco mais: o leitor é carregado."),
    el(
      "div",
      { className: "actions" },
      button("Cancelar", () => {
        cancelled = true;
        void cancelReading().then(render);
      }),
    ),
  );
  let cancelled = false;
  const texts: string[] = [];
  let confidence = 0;
  try {
    const total = state.photos.length;
    for (const [i, photo] of state.photos.entries()) {
      const canvas = await drawPhoto(photo, OCR_SIDE, true);
      if (cancelled) return;
      const label = total > 1 ? `Lendo a foto ${i + 1} de ${total}` : "Lendo a foto";
      const result = await readText(canvas, (p) => {
        if (p.stage === "loading") {
          status.textContent = "Preparando o leitor…";
          bar.value = p.progress;
        } else {
          status.textContent = `${label}… ${Math.round(p.progress * 100)}%`;
          bar.value = (i + p.progress) / total;
        }
      });
      texts.push(result.text);
      confidence += result.confidence / total;
    }
  } catch (error) {
    if (cancelled) return;
    show(
      el("h1", {}, "Não deu para ler"),
      el("p", {}, message(error)),
      el("div", { className: "actions" }, button("Voltar", render, "primary")),
    );
    return;
  }
  if (cancelled) return;
  state.raw = texts.join("\n\n");
  const tidy = tidyOcrText(state.raw, { keepLines: state.keepLines });
  const { title, rest } = guessTitle(tidy);
  state.result = { title, text: rest, confidence };
  render();
}

// ---------- criar a nota ----------

/** Guarda as fotos (para o bloco na nota) e a miniatura. */
async function savePhotos(): Promise<{ fileIds: string[]; thumbnail?: string }> {
  const fileIds: string[] = [];
  let thumbnail: string | undefined;
  for (const [i, photo] of state.photos.entries()) {
    const jpeg = await toJpeg(await drawPhoto(photo, KEEP_SIDE));
    const data = await jpeg.arrayBuffer();
    const { fileId } = await app.storage.saveFile({
      name: `foto-${i + 1}.jpg`,
      mime: "image/jpeg",
      data,
    });
    fileIds.push(fileId);
    if (i === 0) {
      const small = await toJpeg(await drawPhoto(photo, 320), 0.8);
      thumbnail = (await app.assets.save({ data: await small.arrayBuffer(), mime: "image/jpeg" }))
        .assetId;
    }
  }
  return { fileIds, thumbnail };
}

async function createNote(title: string, text: string, busy: HTMLButtonElement) {
  busy.disabled = true;
  busy.textContent = "Preparando…";
  let saved: { fileIds: string[]; thumbnail?: string } | null = null;
  try {
    if (state.keepPhotos && state.photos.length) saved = await savePhotos();
    const n = state.photos.length;
    const { noteId } = await app.notes.propose({
      title,
      text,
      ...(saved
        ? {
            embed: {
              data: { fotos: saved.fileIds } satisfies EmbedData,
              label: n > 1 ? `${n} fotos originais` : "Foto original",
              ...(saved.thumbnail ? { thumbnail: saved.thumbnail } : {}),
            },
          }
        : {}),
    });
    if (!noteId) {
      // Cancelou: as fotos guardadas não servem para nada.
      for (const id of saved?.fileIds ?? []) await app.storage.deleteFile(id).catch(() => {});
      busy.disabled = false;
      busy.textContent = "Criar nota";
      return;
    }
    for (const photo of state.photos) URL.revokeObjectURL(photo.url);
    state.photos = [];
    state.result = null;
    render();
  } catch (error) {
    busy.disabled = false;
    busy.textContent = "Criar nota";
    void app.ui.toast(message(error));
  }
}

// ---------- telas ----------

function startScreen() {
  const hasPhotos = state.photos.length > 0;
  show(
    el("h1", {}, "Foto para nota"),
    el(
      "p",
      { className: "muted" },
      "Fotografe uma página de livro, apostila ou o quadro. O texto é lido neste aparelho: as fotos não são enviadas para lugar nenhum.",
    ),
    el(
      "div",
      { className: "actions" },
      state.photos.length < MAX_PHOTOS &&
        photoInput("Tirar foto", hasPhotos ? "secondary" : "primary", true),
      state.photos.length < MAX_PHOTOS &&
        photoInput(hasPhotos ? "Adicionar fotos" : "Escolher fotos", "secondary", false),
    ),
    hasPhotos && el("ol", { className: "photos" }, ...state.photos.map(photoItem)),
    hasPhotos &&
      el(
        "label",
        { className: "check" },
        el("input", {
          type: "checkbox",
          checked: state.keepLines,
          onchange: (e: Event) => {
            state.keepLines = (e.target as HTMLInputElement).checked;
          },
        }),
        "Manter as quebras de linha da foto (poemas, tabelas, listas)",
      ),
    hasPhotos &&
      el(
        "div",
        { className: "actions" },
        button(
          state.photos.length > 1 ? `Ler texto das ${state.photos.length} fotos` : "Ler texto",
          () => void read(),
          "primary",
        ),
      ),
    el(
      "p",
      { className: "muted small" },
      "Dica: foto de frente, com boa luz e a página inteira no quadro. Texto impresso funciona melhor que letra de mão.",
    ),
  );
}

function resultScreen(result: Result) {
  const title = el("input", { value: result.title, placeholder: "Sem título" });
  const titleLabel = el("label", { className: "field" }, el("span", {}, "Título"), title);
  const text = el("textarea", { value: result.text, rows: 14 });
  const textLabel = el("label", { className: "field" }, el("span", {}, "Texto lido"), text);
  const create = button(
    "Criar nota",
    () => void createNote(title.value, text.value, create),
    "primary",
  );
  const empty = !result.text.trim();

  show(
    el("h1", {}, "Confira o texto"),
    result.confidence < LOW_CONFIDENCE && !empty
      ? el(
          "p",
          { className: "warning", role: "note" },
          "Parte do texto pode ter sido lida errado (foto escura, torta ou letra de mão). Confira antes de criar.",
        )
      : null,
    empty
      ? el(
          "p",
          { className: "warning", role: "note" },
          "Nenhum texto encontrado. Tente uma foto mais nítida, de frente e com boa luz.",
        )
      : null,
    titleLabel,
    textLabel,
    el(
      "label",
      { className: "check" },
      el("input", {
        type: "checkbox",
        checked: state.keepLines,
        onchange: (e: Event) => {
          state.keepLines = (e.target as HTMLInputElement).checked;
          text.value = guessTitle(tidyOcrText(state.raw, { keepLines: state.keepLines })).rest;
        },
      }),
      "Manter as quebras de linha da foto",
    ),
    el(
      "label",
      { className: "check" },
      el("input", {
        type: "checkbox",
        checked: state.keepPhotos,
        onchange: (e: Event) => {
          state.keepPhotos = (e.target as HTMLInputElement).checked;
        },
      }),
      state.photos.length > 1 ? "Guardar as fotos junto da nota" : "Guardar a foto junto da nota",
    ),
    el(
      "div",
      { className: "actions" },
      create,
      state.hasNote &&
        button("Inserir na nota aberta", async () => {
          try {
            await app.notes.insertText(text.value);
            void app.ui.toast("Texto inserido na nota.");
          } catch (error) {
            void app.ui.toast(message(error));
          }
        }),
      button("Voltar às fotos", () => {
        state.result = null;
        render();
      }),
    ),
  );
}

/** Bloco da nota aberto: mostra as fotos originais. */
async function embedScreen(data: EmbedData) {
  show(el("p", { className: "muted" }, "Carregando…"));
  const images: Node[] = [];
  for (const [i, id] of (data.fotos ?? []).entries()) {
    try {
      const bytes = await app.storage.readFile(id);
      const url = URL.createObjectURL(new Blob([bytes], { type: "image/jpeg" }));
      images.push(el("img", { src: url, alt: `Foto original ${i + 1}`, className: "original" }));
    } catch {
      images.push(el("p", { className: "muted" }, `Foto ${i + 1} não encontrada.`));
    }
  }
  show(el("h1", {}, images.length > 1 ? "Fotos originais" : "Foto original"), ...images);
}

function render() {
  if (state.result) resultScreen(state.result);
  else startScreen();
}

async function main() {
  const ctx = await app.ready();
  const embed = ctx.embed?.data as EmbedData | undefined;
  if (embed?.fotos) {
    await embedScreen(embed);
  } else {
    render();
  }
  if (ctx.surface === "panel") {
    state.hasNote = Boolean(await app.notes.getCurrent().catch(() => null));
    if (!embed?.fotos) render();
  }
  app.on("context.changed", (next) => {
    const data = next.embed?.data as EmbedData | undefined;
    if (data?.fotos) void embedScreen(data);
    else render();
  });
}

void main();
