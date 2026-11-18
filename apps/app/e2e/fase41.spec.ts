import { expect, type Page, test } from "@playwright/test";
import { strToU8, zipSync } from "fflate";

/*
 * Plugin de teste da Fase 4.1: lote de cards, próprios cards (listar, estatísticas, corrigir,
 * excluir, conteúdo interno), destaques e arquivos. Fala o protocolo direto, sem o kit.
 */
const SCRIPT = `
  let port; const pending = new Map(); let next = 1; let ctx;
  const out = document.getElementById("out");
  const show = (v) => { out.textContent = typeof v === "string" ? v : JSON.stringify(v); };
  addEventListener("message", (e) => {
    if (e.data?.type !== "estudarella:init") return;
    port = e.ports[0]; ctx = e.data.context;
    port.onmessage = ({ data }) => {
      if (data.type === "response") pending.get(data.id)?.(data);
      if (data.type === "event" && data.event === "context.changed") { ctx = data.payload; ready(); }
    };
    call("host.getTheme").then(ready);
  });
  const call = (method, params) => new Promise((r) => {
    const id = next++; pending.set(id, r); port.postMessage({ type: "request", id, method, params });
  });
  const res = (r) => r.ok ? r.result : "erro: " + r.error.code;
  function ready() { show(ctx.command ? "comando: " + ctx.command.selection : "pronto"); }
  const on = (id, fn) => { document.getElementById(id).onclick = fn; };
  const own = async () => (await call("cards.listOwn", { limit: 200 })).result;

  on("lote", async () => {
    const cards = Array.from({ length: 30 }, (_, i) => ({ front: "Elemento " + i, back: "símbolo " + i, key: "el-" + i }));
    const r = await call("cards.proposeBatch", { cards, deckName: "Química" });
    show(r.ok ? "criados: " + r.result.created + " ids: " + r.result.ids.length : "erro: " + r.error.code);
  });
  on("invalido", async () => {
    const r = await call("cards.proposeBatch", { cards: [{ front: "ok", back: "ok" }, { front: "", back: "x" }] });
    show(res(r));
  });
  on("visual", async () => {
    const r = await call("cards.proposeBatch", { cards: [{ content: { v: 1 }, fallback: { front: "Molécula visual", back: "CO2" }, key: "co2" }] });
    show(res(r).created === 1 ? "visual criado" : res(r));
  });
  on("listar", async () => {
    const r = await call("cards.listOwn", { limit: 200 });
    if (!r.ok) return show("erro: " + r.error.code);
    const cards = r.result;
    show("meus: " + cards.length + " " + cards.slice(0, 2).map((c) => c.key).join(","));
  });
  on("stats", async () => {
    const [first] = await own();
    const r = await call("cards.statsOwn", { ids: [first.id] });
    show("estado: " + res(r)[0].state);
  });
  on("conteudo", async () => {
    const visual = (await own()).find((c) => c.type === "plugin");
    const r = await call("cards.updateContent", { id: visual.id, content: { v: 2 } });
    const after = (await own()).find((c) => c.id === visual.id);
    show(r.ok ? "conteúdo: " + after.content.v : res(r));
  });
  on("corrigir", async () => {
    const cards = await own();
    const r = await call("cards.proposeUpdate", { changes: cards.slice(0, 2).map((c) => ({ id: c.id, back: "corrigido " + c.key })) });
    show("corrigidos: " + res(r).updated);
  });
  on("excluir", async () => {
    const cards = await own();
    const r = await call("cards.proposeDelete", { ids: cards.slice(-3).map((c) => c.id) });
    show("excluídos: " + res(r).deleted);
  });
  on("destacar", async () => {
    const r = await call("highlights.set", { rules: [
      { term: "água", color: "blue", label: "substância" },
      { term: "H2SO4", color: "green", style: "formula", label: "ácido" },
      { term: "sódio", color: "orange", label: "elemento", command: "elemento" },
    ] });
    show(r.ok ? "destaques ok" : res(r));
  });
  on("cor-ruim", async () => show(res(await call("highlights.set", { rules: [{ term: "x", color: "dourado" }] }))));
  on("reservada", async () => show(res(await call("storage.set", { key: "__destaques", value: [] }))));
  on("arquivo", async () => {
    const data = new TextEncoder().encode("etanol\\n  RDKit 2D\\n").buffer;
    const saved = res(await call("storage.saveFile", { name: "etanol.mol", mime: "chemical/x-mdl-molfile", data }));
    const list = res(await call("storage.listFiles"));
    const back = res(await call("storage.readFile", { fileId: saved.fileId }));
    show("arquivos: " + list.length + " " + list[0].name + " " + new TextDecoder().decode(back).split("\\n")[0]);
  });
  on("html", async () => {
    show(res(await call("storage.saveFile", { name: "x.html", mime: "text/html", data: new ArrayBuffer(4) })));
  });
  on("apagar-arquivo", async () => {
    const [f] = res(await call("storage.listFiles"));
    await call("storage.deleteFile", { fileId: f.fileId });
    show("restam: " + res(await call("storage.listFiles")).length);
  });
  on("abrir", async () => {
    const r = res(await call("storage.pickFile", { accept: [".csv"] }));
    show(r ? "recebi: " + r.name + " " + r.data.byteLength : "cancelado");
  });
`;

const BUTTONS = [
  ["lote", "Lote"],
  ["invalido", "Lote inválido"],
  ["visual", "Visual"],
  ["listar", "Listar"],
  ["stats", "Estatísticas"],
  ["conteudo", "Conteúdo"],
  ["corrigir", "Corrigir"],
  ["excluir", "Excluir"],
  ["destacar", "Destacar"],
  ["cor-ruim", "Cor ruim"],
  ["reservada", "Chave reservada"],
  ["arquivo", "Arquivo"],
  ["html", "Arquivo HTML"],
  ["apagar-arquivo", "Apagar arquivo"],
  ["abrir", "Abrir arquivo"],
];

function pluginZip(id: string, permissions: string[], script: string) {
  return Buffer.from(
    zipSync({
      [`${id}/manifest.json`]: strToU8(
        JSON.stringify({
          id,
          name: `Plugin ${id}`,
          version: "0.1.0",
          apiVersion: "1",
          contributes: {
            page: { title: id },
            panel: { title: `Painel ${id}` },
            cardRenderer: true,
            highlights: true,
            commands: [{ id: "elemento", title: "Elemento", context: "selection" }],
          },
          permissions,
        }),
      ),
      [`${id}/index.html`]: strToU8(
        `<!doctype html><p id="out">esperando</p>${BUTTONS.map(
          ([b, label]) => `<button id="${b}">${label}</button>`,
        ).join("")}<script src="app.js"></script>`,
      ),
      [`${id}/app.js`]: strToU8(script),
    }),
  );
}

async function install(page: Page, id: string, permissions: string[]) {
  await page.goto("/plugins");
  await page.getByLabel("Arquivo do plugin (.zip)").setInputFiles({
    name: `${id}.zip`,
    mimeType: "application/zip",
    buffer: pluginZip(id, permissions, SCRIPT),
  });
  await page
    .getByRole("dialog", { name: `Instalar Plugin ${id}` })
    .getByRole("button", { name: "Instalar e ativar" })
    .click();
  await expect(page.getByTestId(`plugin-${id}`)).toBeVisible();
}

const ALL = ["cards:write", "cards:own", "storage", "notes:highlight"];

async function openPlugin(page: Page, id: string) {
  await page.goto(`/plugins/${id}`);
  const frame = page.frameLocator(`iframe[title="Plugin ${id}"]`);
  await expect(frame.locator("#out")).toHaveText("pronto");
  return frame;
}

test("cards em lote e próprios cards: criar, duplicados, listar, corrigir, excluir", async ({
  page,
}) => {
  await install(page, "quimica", ALL);
  // Um card do próprio usuário, que o plugin não pode ver.
  await page.goto("/revisao");
  await page.getByRole("button", { name: "Novo baralho" }).click();
  await page.getByLabel("Nome").fill("Meu baralho");
  await page.getByRole("button", { name: "Criar" }).click();
  await page.getByRole("button", { name: "Card", exact: true }).click();
  await page.getByLabel("Frente", { exact: true }).fill("Card do usuário");
  await page.getByLabel("Verso", { exact: true }).fill("meu");
  await page.getByRole("button", { name: "Adicionar" }).click();

  const plugin = await openPlugin(page, "quimica");

  // Lote de 30: novo baralho, desmarcar 2, editar 1.
  await plugin.getByRole("button", { name: "Lote", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Criar 30 cards" });
  await dialog.getByLabel("Baralho").selectOption({ label: "+ Novo baralho: Química" });
  await dialog.getByLabel("Criar o card Elemento 1", { exact: true }).uncheck();
  await dialog.getByLabel("Criar o card Elemento 2", { exact: true }).uncheck();
  await dialog.getByRole("button", { name: /^Elemento 3 / }).click();
  await dialog.getByLabel("Frente").fill("Elemento 3 (editado)");
  await expect(dialog).toContainText("28 de 30 marcados");
  await dialog.getByRole("button", { name: "Criar 28 cards" }).click();
  await expect(plugin.locator("#out")).toHaveText("criados: 28 ids: 28");

  // O mesmo lote de novo: os 28 aparecem como "já existe".
  await plugin.getByRole("button", { name: "Lote", exact: true }).click();
  const again = page.getByRole("dialog", { name: "Criar 30 cards" });
  await again.getByLabel("Baralho").selectOption({ label: "Química" });
  await expect(again).toContainText("2 de 30 marcados · 28 já existem");
  await again.getByRole("button", { name: "Cancelar" }).click();
  await expect(plugin.locator("#out")).toHaveText("criados: 0 ids: 0");

  // Item inválido recusa o lote inteiro.
  await plugin.getByRole("button", { name: "Lote inválido" }).click();
  await expect(plugin.locator("#out")).toHaveText("erro: invalid_params");

  // Só os próprios cards; estatísticas.
  await plugin.getByRole("button", { name: "Listar" }).click();
  await expect(plugin.locator("#out")).toHaveText("meus: 28 el-0,el-3");
  await plugin.getByRole("button", { name: "Estatísticas" }).click();
  await expect(plugin.locator("#out")).toHaveText("estado: novo");

  // Card visual no lote e troca do conteúdo interno sem pedir.
  await plugin.getByRole("button", { name: "Visual" }).click();
  await page
    .getByRole("dialog", { name: "Criar 1 cards" })
    .getByRole("button", { name: "Criar 1 card" })
    .click();
  await expect(plugin.locator("#out")).toHaveText("visual criado");
  await plugin.getByRole("button", { name: "Conteúdo" }).click();
  await expect(plugin.locator("#out")).toHaveText("conteúdo: 2");

  // Editar um card pelo app marca como personalizado: ele vem desmarcado na correção.
  await page.goto("/revisao");
  await page.getByRole("link", { name: /^Química/ }).click();
  await page.getByRole("button", { name: /Elemento 0/ }).click();
  await page
    .getByRole("dialog", { name: "Editar card" })
    .getByLabel("Verso", { exact: true })
    .fill("minha resposta");
  await page.getByRole("button", { name: "Salvar" }).click();

  const plugin2 = await openPlugin(page, "quimica");
  await plugin2.getByRole("button", { name: "Corrigir" }).click();
  const fix = page.getByRole("dialog", { name: "Corrigir 2 cards" });
  await expect(fix).toContainText("Você editou este card");
  await expect(fix.getByLabel("Aplicar a correção em Elemento 0")).not.toBeChecked();
  await expect(fix.getByLabel("Aplicar a correção em Elemento 3 (editado)")).toBeChecked();
  await fix.getByRole("button", { name: "Aplicar 1" }).click();
  await expect(plugin2.locator("#out")).toHaveText("corrigidos: 1");

  await plugin2.getByRole("button", { name: "Excluir" }).click();
  const del = page.getByRole("dialog", { name: "Excluir 3 cards?" });
  await del.getByRole("button", { name: "Excluir 3" }).click();
  await expect(plugin2.locator("#out")).toHaveText("excluídos: 3");
  await plugin2.getByRole("button", { name: "Listar" }).click();
  await expect(plugin2.locator("#out")).toHaveText(/^meus: 26 /);

  // A busca acompanha a correção; o card do usuário continua.
  await page.goto("/busca?q=corrigido");
  await expect(page.getByRole("list", { name: "Resultados" }).getByLabel("Card")).toHaveCount(1);
  await page.goto("/busca?q=usuario");
  await expect(page.getByRole("list", { name: "Resultados" }).getByLabel("Card")).toHaveCount(1);

  // Outro plugin sem a permissão não alcança os cards.
  await install(page, "outro", ["cards:write"]);
  const outro = await openPlugin(page, "outro");
  await outro.getByRole("button", { name: "Listar" }).click();
  await expect(outro.locator("#out")).toHaveText("erro: forbidden");
});

test("destaques: pintar, fórmula, comando, esconder e sumir ao desativar", async ({ page }) => {
  await install(page, "quimica", ALL);
  const plugin = await openPlugin(page, "quimica");
  await plugin.getByRole("button", { name: "Cor ruim" }).click();
  await expect(plugin.locator("#out")).toHaveText("erro: invalid_params");
  await plugin.getByRole("button", { name: "Chave reservada" }).click();
  await expect(plugin.locator("#out")).toHaveText("erro: invalid_params");
  await plugin.getByRole("button", { name: "Destacar" }).click();
  await expect(plugin.locator("#out")).toHaveText("destaques ok");

  await page.goto("/notas");
  await page.getByRole("button", { name: "Nova nota" }).click();
  await page.getByLabel("Título da nota").fill("Ácidos");
  await page.getByLabel("Conteúdo da nota").click();
  await page.getByLabel("Conteúdo da nota").pressSequentially("A agua e o H2SO4 com sodio.");
  await expect(page.getByTestId("save-status")).toHaveText("Salvo");

  const editor = page.getByLabel("Conteúdo da nota");
  await expect(editor.locator(".hl-blue")).toHaveText("agua");
  // No estilo fórmula o trecho é dividido (H, 2, SO, 4) para o subscrito.
  await expect
    .poll(() =>
      editor
        .locator(".hl-green")
        .allTextContents()
        .then((t) => t.join("")),
    )
    .toBe("H2SO4");
  await expect(editor.locator(".hl-sub")).toHaveText(["2", "4"]);
  await expect(page.getByRole("list", { name: "Legenda dos destaques" })).toContainText(
    "substância",
  );
  // O texto salvo não muda.
  await page.reload();
  await expect(page.getByLabel("Conteúdo da nota")).toHaveText("A agua e o H2SO4 com sodio.");

  // Tocar na palavra com comando abre o painel do plugin com ela.
  await page.getByLabel("Conteúdo da nota").locator("[data-hl-command]").click();
  await expect(page.frameLocator('iframe[title="Plugin quimica"]').locator("#out")).toHaveText(
    "comando: sodio",
  );
  await page.getByRole("button", { name: "Fechar painel" }).click();

  // Esconder pelo menu da nota.
  await page.getByRole("button", { name: "Ações da nota" }).click();
  await page.getByRole("menuitem", { name: "Esconder destaques" }).click();
  await expect(page.getByLabel("Conteúdo da nota").locator(".hl")).toHaveCount(0);
  await page.getByRole("button", { name: "Ações da nota" }).click();
  await page.getByRole("menuitem", { name: "Mostrar destaques" }).click();
  await expect(page.getByLabel("Conteúdo da nota").locator(".hl-blue")).toHaveCount(1);

  // Desativar o plugin faz os destaques sumirem.
  const url = page.url();
  await page.goto("/plugins");
  await expect(page.getByTestId("plugin-quimica")).toContainText("destaca 3 termos nas notas");
  await page.getByRole("switch", { name: "Ativar Plugin quimica" }).click();
  await page.goto(url);
  await expect(page.getByLabel("Conteúdo da nota")).toContainText("H2SO4");
  await expect(page.getByLabel("Conteúdo da nota").locator(".hl")).toHaveCount(0);
});

test("arquivos: guardar, ler, tipo proibido, abrir, apagar e perguntar ao remover", async ({
  page,
}) => {
  await install(page, "quimica", ALL);
  const plugin = await openPlugin(page, "quimica");
  await plugin.getByRole("button", { name: "Arquivo", exact: true }).click();
  await expect(plugin.locator("#out")).toHaveText("arquivos: 1 etanol.mol etanol");
  await plugin.getByRole("button", { name: "Arquivo HTML" }).click();
  await expect(plugin.locator("#out")).toHaveText("erro: invalid_params");

  // Abrir: o app pede ao usuário e entrega só o arquivo escolhido.
  await plugin.getByRole("button", { name: "Abrir arquivo" }).click();
  const pick = page.getByRole("dialog", { name: "Abrir um arquivo" });
  await expect(pick).toContainText("Plugin quimica quer abrir um arquivo");
  await pick.getByLabel("Arquivo para o plugin").setInputFiles({
    name: "dados.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("a,b\n1,2\n"),
  });
  await expect(plugin.locator("#out")).toHaveText("recebi: dados.csv 8");

  await page.goto("/plugins");
  await expect(page.getByTestId("plugin-quimica")).toContainText("1 arquivo guardado");
  await page.getByRole("button", { name: "Ações de Plugin quimica" }).click();
  await page.getByRole("menuitem", { name: "Remover" }).click();
  await expect(page.getByText("Apagar também os arquivos guardados por ele")).toBeVisible();
  await page.getByRole("button", { name: "Cancelar" }).click();

  const again = await openPlugin(page, "quimica");
  await again.getByRole("button", { name: "Apagar arquivo" }).click();
  await expect(again.locator("#out")).toHaveText("restam: 0");
});
