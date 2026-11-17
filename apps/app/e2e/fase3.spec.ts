import { expect, type Page, test } from "@playwright/test";
import { strToU8, zipSync } from "fflate";

// Wikcionário simulado (mesmo formato da API real).
const WIKITEXT = `{{-pt-}}=
==Adjetivo==
# que sente [[alegria]]
#* ''Estou muito '''feliz''' hoje.''
# bem-sucedido

===Antônimo===
* [[infeliz]]

===Sinônimos===
* [[alegre]]
* [[contente]]
`;

async function fakeWiktionary(page: Page, state = { online: true, calls: 0 }) {
  await page.context().route("https://pt.wiktionary.org/**", async (route) => {
    state.calls++;
    if (!state.online) return route.abort();
    const word = new URL(route.request().url()).searchParams.get("page");
    const body =
      word === "feliz"
        ? { parse: { title: "feliz", wikitext: WIKITEXT } }
        : { error: { code: "missingtitle" } };
    return route.fulfill({
      json: body,
      headers: { "access-control-allow-origin": "*" },
    });
  });
  return state;
}

async function enableDictionary(page: Page) {
  await page.goto("/plugins");
  const item = page.getByTestId("plugin-dicionario-pt");
  await expect(item).toContainText("Oficial");
  // O interruptor só liga depois de aprovar as permissões.
  await item.getByRole("switch", { name: "Ativar Dicionário PT" }).click();
  const summary = page.getByTestId("permission-summary");
  await expect(summary).toContainText("Ler a nota aberta e o texto selecionado");
  await expect(summary).toContainText("Criar flashcards (você confirma cada um)");
  await expect(summary).toContainText("pt.wiktionary.org");
  await page.getByRole("button", { name: "Permitir e ativar" }).click();
  await expect(item.getByRole("switch")).toBeChecked();
}

async function noteWith(page: Page, title: string, body: string) {
  await page.goto("/notas");
  await page.getByRole("button", { name: "Nova nota" }).click();
  await page.getByLabel("Título da nota").fill(title);
  await page.getByLabel("Conteúdo da nota").click();
  await page.getByLabel("Conteúdo da nota").pressSequentially(body);
  await expect(page.getByTestId("save-status")).toHaveText("Salvo");
}

/** Seleciona uma palavra dentro do conteúdo da nota. */
async function selectWord(page: Page, word: string) {
  await page.getByLabel("Conteúdo da nota").evaluate((el, w) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const i = node.textContent?.indexOf(w) ?? -1;
      if (i >= 0) {
        const range = document.createRange();
        range.setStart(node, i);
        range.setEnd(node, i + w.length);
        const sel = document.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        return;
      }
    }
    throw new Error(`palavra não encontrada: ${w}`);
  }, word);
}

test("dicionário: ativar, definir palavra selecionada (também em leitura) e criar card", async ({
  page,
}) => {
  await fakeWiktionary(page);
  await page.goto("/revisao");
  await page.getByRole("button", { name: "Novo baralho" }).click();
  await page.getByLabel("Nome").fill("Vocabulário");
  await page.getByRole("button", { name: "Criar" }).click();
  await enableDictionary(page);

  await noteWith(page, "Sentimentos", "Hoje estou feliz.");
  await page.getByRole("button", { name: "Ler" }).click();
  await selectWord(page, "feliz");
  await page
    .getByRole("toolbar", { name: "Ações para o texto selecionado" })
    .getByRole("button", { name: "Definir palavra" })
    .click();

  const panel = page.locator("[data-plugin-panel]");
  await expect(panel).toBeVisible();
  const plugin = panel.frameLocator("iframe");
  await expect(plugin.getByRole("heading", { name: "feliz" })).toBeVisible();
  await expect(plugin.getByText("que sente alegria")).toBeVisible();
  await expect(plugin.getByText("Estou muito feliz hoje.")).toBeVisible();
  await expect(plugin.getByRole("button", { name: "contente" })).toBeVisible();
  await expect(plugin.getByText(/Fonte: Wikcionário/)).toBeVisible();

  // Criar card: o app pede confirmação e o baralho.
  await plugin.getByRole("button", { name: "Criar card" }).click();
  const dialog = page.getByRole("dialog", { name: "Criar card" });
  await expect(dialog.getByLabel("Frente")).toHaveValue("feliz");
  await expect(dialog.getByLabel("Verso")).toHaveValue(/1\. que sente alegria/);
  await dialog.getByRole("button", { name: "Criar card" }).click();
  await expect(page.getByText("Dicionário PT: Card criado")).toBeVisible();

  await page.getByRole("button", { name: "Fechar painel" }).click();
  await expect(panel).toHaveCount(0);
  await page.goto("/revisao");
  await expect(page.getByTestId("deck-counts-Vocabulário")).toContainText("1 novos");
});

test("dicionário: tela própria, palavras guardadas sem internet e configurações", async ({
  page,
}) => {
  const net = await fakeWiktionary(page);
  await enableDictionary(page);

  // A tela do plugin aparece no painel "Ir para".
  await page.goto("/");
  await page.getByTestId("streak").waitFor();
  await page.keyboard.press("Control+k");
  await page.getByLabel("Ir para tela ou nota").fill("dicion");
  await page
    .getByRole("list", { name: "Telas" })
    .getByRole("button", { name: "Dicionário" })
    .click();
  await expect(page).toHaveURL(/\/plugins\/dicionario-pt$/);

  const plugin = page.frameLocator('iframe[title="Dicionário PT"]');
  await plugin.getByLabel("Buscar palavra").fill("feliz");
  await plugin.getByRole("button", { name: "Buscar" }).click();
  await expect(plugin.getByText("que sente alegria")).toBeVisible();
  await plugin.getByLabel("Buscar palavra").fill("xyzabc");
  await plugin.getByRole("button", { name: "Buscar" }).click();
  await expect(plugin.getByText("Nenhum verbete em português")).toBeVisible();

  // Sem internet, a palavra já consultada continua disponível.
  net.online = false;
  const callsBefore = net.calls;
  await plugin.getByLabel("Buscar palavra").fill("feliz");
  await plugin.getByRole("button", { name: "Buscar" }).click();
  await expect(plugin.getByText("que sente alegria")).toBeVisible();
  expect(net.calls).toBe(callsBefore);

  // Configurações: quantidade guardada e limpeza.
  await page.goto("/plugins");
  await page.getByRole("button", { name: "Ações de Dicionário PT" }).click();
  await page.getByRole("menuitem", { name: "Configurações" }).click();
  const settings = page.getByRole("dialog").frameLocator("iframe");
  await expect(settings.locator("#uso")).toContainText("2 palavras guardadas");
  await settings.getByLabel("Quantas palavras guardar").selectOption("100");
  await settings.getByRole("button", { name: "Limpar palavras guardadas" }).click();
  await expect(settings.locator("#uso")).toContainText("0 palavras guardadas");
});

// ---------- plugins de terceiros ----------

const RAW_PLUGIN_SCRIPT = `
  let port; const pending = new Map(); let next = 1;
  addEventListener("message", (e) => {
    if (e.data?.type !== "estudarella:init") return;
    port = e.ports[0];
    port.onmessage = ({ data }) => { if (data.type === "response") pending.get(data.id)?.(data); };
    run();
  });
  const call = (method, params) => new Promise((r) => { const id = next++; pending.set(id, r); port.postMessage({ type: "request", id, method, params }); });
  async function run() {
    await call("host.getTheme");
    const res = await call("notes.getCurrent");
    document.getElementById("out").textContent = res.ok ? "permitido" : "recusado: " + res.error.code;
  }
`;

function thirdPartyZip(id: string, script = RAW_PLUGIN_SCRIPT) {
  return Buffer.from(
    zipSync({
      [`${id}-main/manifest.json`]: strToU8(
        JSON.stringify({
          id,
          name: `Plugin ${id}`,
          description: "Plugin de teste",
          version: "0.1.0",
          apiVersion: "1",
          contributes: { page: { title: `Tela ${id}` } },
          permissions: [],
        }),
      ),
      [`${id}-main/index.html`]: strToU8(
        `<!doctype html><p id="out">esperando</p><script src="app.js"></script>`,
      ),
      [`${id}-main/app.js`]: strToU8(script),
    }),
  );
}

test("instalar de arquivo: aviso de origem, permissão negada e remoção", async ({ page }) => {
  await page.goto("/plugins");
  await page.getByLabel("Arquivo do plugin (.zip)").setInputFiles({
    name: "p.zip",
    mimeType: "application/zip",
    buffer: thirdPartyZip("terceiro"),
  });
  const dialog = page.getByRole("dialog", { name: "Instalar Plugin terceiro" });
  await expect(dialog).toContainText("Origem não verificada");
  await expect(dialog).toContainText("Nada além de mostrar a própria tela");
  await dialog.getByRole("button", { name: "Instalar e ativar" }).click();

  const item = page.getByTestId("plugin-terceiro");
  await expect(item).toContainText("De arquivo · origem não verificada");
  await page.goto("/plugins/terceiro");
  // Pediu a nota sem ter a permissão: o app recusa.
  await expect(page.frameLocator('iframe[title="Plugin terceiro"]').locator("#out")).toHaveText(
    "recusado: forbidden",
  );

  await page.goto("/plugins");
  await page.getByRole("button", { name: "Ações de Plugin terceiro" }).click();
  await page.getByRole("menuitem", { name: "Remover" }).click();
  await page.getByRole("button", { name: "Remover" }).click();
  await expect(page.getByTestId("plugin-terceiro")).toHaveCount(0);
});

test("instalar de link e plugin travado não derruba o app", async ({ page }) => {
  await page.context().route("https://exemplo.test/travado.zip", (route) =>
    route.fulfill({
      body: thirdPartyZip("travado", "/* nunca fala com o app */"),
      headers: { "content-type": "application/zip", "access-control-allow-origin": "*" },
    }),
  );
  await page.clock.install();
  await page.goto("/plugins");
  await page.getByRole("button", { name: "De um link" }).click();
  await page.getByLabel("Endereço do arquivo .zip").fill("https://exemplo.test/travado.zip");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Instalar e ativar" }).click();
  await expect(page.getByTestId("plugin-travado")).toContainText("De link");

  await page.goto("/plugins/travado");
  await expect(page.locator('iframe[title="Plugin travado"]')).toBeVisible();
  await page.clock.fastForward("00:11");
  await expect(page.getByText("Plugin travado não respondeu.")).toBeVisible();
  // O resto do app segue normal.
  await page.goto("/notas");
  await expect(page.getByRole("button", { name: "Nova nota" })).toBeVisible();
});

test("dicionário desativado não mostra o comando na seleção", async ({ page }) => {
  await noteWith(page, "Sem plugin", "palavra solta");
  await selectWord(page, "palavra");
  await page.waitForTimeout(300);
  await expect(page.getByRole("toolbar", { name: "Ações para o texto selecionado" })).toHaveCount(
    0,
  );
});
