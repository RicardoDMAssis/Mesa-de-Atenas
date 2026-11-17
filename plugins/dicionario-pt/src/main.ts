import { app, PluginError } from "@estudarella/plugin-sdk";
import type { Entry } from "./wikitext";
import { parseEntry } from "./wikitext";

/*
 * Dicionário PT: consulta o Wikcionário em português e guarda as últimas palavras
 * consultadas (cache local do plugin). Uma mesma página serve às três "superfícies":
 * painel (palavra selecionada na nota), tela própria (busca) e configurações.
 */

const API = "https://pt.wiktionary.org/w/api.php";
const INDEX_KEY = "indice";
const CONFIG_KEY = "config";
const LAST_KEY = "ultimaBusca";
const DEFAULT_LIMIT = 500;
const root = document.getElementById("app") as HTMLElement;

interface IndexItem {
  w: string;
  /** Tamanho guardado, em bytes. */
  s: number;
}

// ---------- utilidades de DOM (sempre textContent: nada de HTML vindo de fora) ----------

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> & { className?: string } = {},
  ...children: (Node | string | null | undefined)[]
): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  for (const child of children) if (child != null) node.append(child);
  return node;
}

function show(...nodes: (Node | null)[]) {
  root.replaceChildren(...nodes.filter((n): n is Node => n !== null));
}

const attribution = () =>
  el("footer", {}, "Fonte: Wikcionário, a enciclopédia livre de palavras (CC BY-SA).");

/** Primeira palavra de um trecho selecionado, sem pontuação nas pontas. */
export function firstWord(text: string): string {
  const match = text.trim().match(/[\p{L}\p{M}][\p{L}\p{M}'’-]*/u);
  return match ? match[0] : "";
}

// ---------- cache ----------

async function getLimit(): Promise<number> {
  const config = await app.storage.get<{ limit?: number }>(CONFIG_KEY);
  return config?.limit ?? DEFAULT_LIMIT;
}

async function getIndex(): Promise<IndexItem[]> {
  return (await app.storage.get<IndexItem[]>(INDEX_KEY)) ?? [];
}

async function remember(word: string, entry: Entry | null) {
  const value = entry ?? { word, classes: [] };
  const size = JSON.stringify(value).length;
  await app.storage.set(`p:${word}`, value);
  const limit = await getLimit();
  const index = [{ w: word, s: size }, ...(await getIndex()).filter((i) => i.w !== word)];
  for (const old of index.splice(limit)) await app.storage.delete(`p:${old.w}`);
  await app.storage.set(INDEX_KEY, index);
}

async function fromCache(word: string): Promise<Entry | null | undefined> {
  const cached = await app.storage.get<Entry>(`p:${word}`);
  if (!cached) return undefined;
  return cached.classes.length ? cached : null;
}

// ---------- consulta ----------

async function fetchWikitext(title: string): Promise<string | null> {
  const url = new URL(API);
  for (const [k, v] of Object.entries({
    action: "parse",
    page: title,
    prop: "wikitext",
    format: "json",
    formatversion: "2",
    origin: "*",
    redirects: "1",
  }))
    url.searchParams.set(k, v);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { parse?: { wikitext: string }; error?: { code: string } };
  return data.parse?.wikitext ?? null;
}

/** Busca no cache e, se não houver, no Wikcionário. `null` = palavra sem verbete. */
async function lookup(word: string): Promise<{ entry: Entry | null; offline?: boolean }> {
  const key = word.toLocaleLowerCase("pt-BR");
  const cached = await fromCache(key);
  if (cached !== undefined) {
    await remember(key, cached); // atualiza a posição no histórico
    return { entry: cached };
  }
  try {
    let wikitext = await fetchWikitext(key);
    if (!wikitext && key !== word) wikitext = await fetchWikitext(word);
    const entry = wikitext ? parseEntry(key, wikitext) : null;
    await remember(key, entry);
    return { entry };
  } catch {
    return { entry: null, offline: true };
  }
}

// ---------- telas ----------

function renderEntry(entry: Entry, onWord: (w: string) => void): Node[] {
  return entry.classes.map((c) => {
    const words = (title: string, list: string[]) =>
      list.length
        ? el(
            "div",
            {},
            el("h2", {}, title),
            el(
              "div",
              { className: "chips" },
              ...list.map((w) =>
                el("button", { className: "chip", type: "button", onclick: () => onWord(w) }, w),
              ),
            ),
          )
        : null;
    return el(
      "section",
      { className: "card" },
      el("h2", {}, c.name),
      c.definitions.length
        ? el(
            "ol",
            {},
            ...c.definitions.map((d) =>
              el(
                "li",
                {},
                d.text,
                d.example ? el("span", { className: "example" }, d.example) : null,
              ),
            ),
          )
        : null,
      words("Sinônimos", c.synonyms),
      words("Antônimos", c.antonyms),
    );
  });
}

/** Texto do verso do card: classe e até 3 definições. */
function cardBack(entry: Entry): string {
  const c = entry.classes[0];
  if (!c) return "";
  const defs = c.definitions.slice(0, 3).map((d, i) => `${i + 1}. ${d.text}`);
  return [`(${c.name.toLowerCase()})`, ...defs].join("\n");
}

async function showWord(word: string, mode: "panel" | "page") {
  if (!word) {
    show(
      el(
        "p",
        { className: "muted" },
        "Selecione uma palavra na nota e toque em “Definir palavra”.",
      ),
    );
    return;
  }
  show(el("h1", {}, word), el("p", { className: "muted" }, "Consultando…"));
  const { entry, offline } = await lookup(word);
  await app.storage.set(LAST_KEY, word);
  const goTo = (w: string) => void showWord(w, mode);

  if (!entry) {
    show(
      mode === "page" ? searchForm(word) : null,
      el("h1", {}, word),
      el(
        "p",
        { className: "muted" },
        offline
          ? "Sem conexão com o Wikcionário. Palavras já consultadas continuam disponíveis sem internet."
          : "Nenhum verbete em português encontrado para esta palavra.",
      ),
      attribution(),
    );
    return;
  }

  const actions = el(
    "div",
    { className: "actions" },
    el(
      "button",
      {
        className: "primary",
        type: "button",
        onclick: async () => {
          try {
            const { created } = await app.cards.propose({
              front: entry.word,
              back: cardBack(entry),
            });
            if (created) await app.ui.toast("Card criado");
          } catch (error) {
            if (error instanceof PluginError && error.code === "forbidden") {
              await app.ui.toast("O dicionário não tem permissão para criar cards");
            }
          }
        },
      },
      "Criar card",
    ),
    mode === "panel"
      ? el(
          "button",
          { className: "secondary", type: "button", onclick: () => app.ui.openPage() },
          "Abrir no dicionário",
        )
      : null,
  );
  show(
    mode === "page" ? searchForm(word) : null,
    el("h1", {}, entry.word),
    actions,
    ...renderEntry(entry, goTo),
    attribution(),
  );
}

function searchForm(initial = ""): HTMLFormElement {
  const input = el("input", {
    type: "search",
    value: initial,
    placeholder: "Buscar palavra",
    ariaLabel: "Buscar palavra",
    autocapitalize: "none",
  });
  return el(
    "form",
    {
      role: "search",
      onsubmit: (e: Event) => {
        e.preventDefault();
        const word = firstWord(input.value);
        if (word) void showWord(word, "page");
      },
    },
    input,
    el("button", { className: "primary", type: "submit" }, "Buscar"),
  );
}

async function showPage() {
  const last = await app.storage.get<string>(LAST_KEY);
  const recent = (await getIndex()).slice(0, 20);
  if (last) {
    await showWord(last, "page");
    return;
  }
  show(
    el("h1", {}, "Dicionário"),
    searchForm(),
    recent.length
      ? el(
          "div",
          {},
          el("h2", {}, "Consultadas recentemente"),
          el(
            "div",
            { className: "chips" },
            ...recent.map((i) =>
              el(
                "button",
                { className: "chip", type: "button", onclick: () => void showWord(i.w, "page") },
                i.w,
              ),
            ),
          ),
        )
      : null,
    attribution(),
  );
}

async function showSettings() {
  const limit = await getLimit();
  const index = await getIndex();
  const bytes = index.reduce((n, i) => n + i.s, 0);
  const select = el(
    "select",
    { id: "limite", ariaLabel: "Quantas palavras guardar" },
    ...[100, 250, 500, 1000, 2000].map((n) =>
      el("option", { value: String(n), selected: n === limit }, `${n} palavras`),
    ),
  );
  select.onchange = async () => {
    const next = Number(select.value);
    await app.storage.set(CONFIG_KEY, { limit: next });
    const kept = await getIndex();
    for (const old of kept.splice(next)) await app.storage.delete(`p:${old.w}`);
    await app.storage.set(INDEX_KEY, kept);
    await showSettings();
  };
  show(
    el("h2", {}, "Palavras guardadas para uso sem internet"),
    select,
    el(
      "p",
      { className: "muted", id: "uso" },
      `${index.length} palavra${index.length === 1 ? "" : "s"} guardada${index.length === 1 ? "" : "s"}, ${(bytes / 1024).toFixed(1)} KB.`,
    ),
    el(
      "div",
      { className: "actions" },
      el(
        "button",
        {
          className: "secondary",
          type: "button",
          disabled: index.length === 0,
          onclick: async () => {
            for (const i of index) await app.storage.delete(`p:${i.w}`);
            await app.storage.delete(INDEX_KEY);
            await app.storage.delete(LAST_KEY);
            await showSettings();
          },
        },
        "Limpar palavras guardadas",
      ),
    ),
  );
}

async function main() {
  const context = await app.ready();
  if (context.surface === "settings") return showSettings();
  if (context.surface === "page") return showPage();
  await showWord(firstWord(context.command?.selection ?? ""), "panel");
  app.on(
    "context.changed",
    (next) => void showWord(firstWord(next.command?.selection ?? ""), "panel"),
  );
}

void main();
