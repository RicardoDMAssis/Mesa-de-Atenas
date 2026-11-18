import { expect, type Page, test } from "@playwright/test";
import { strToU8, zipSync } from "fflate";

/*
 * Plugin de teste com tudo da Fase 4: card visual (frente/verso desenhados pelo plugin),
 * bloco na nota, imagem salva e sugestão pela etiqueta "anatomia". Fala o protocolo direto,
 * sem o kit, para o teste não depender do build dos plugins.
 */
const SCRIPT = `
  let port; const pending = new Map(); let next = 1; let ctx;
  const out = document.getElementById("out");
  addEventListener("message", (e) => {
    if (e.data?.type !== "estudarella:init") return;
    port = e.ports[0];
    ctx = e.data.context;
    port.onmessage = ({ data }) => {
      if (data.type === "response") pending.get(data.id)?.(data);
      if (data.type === "event" && data.event === "context.changed") { ctx = data.payload; render(); }
    };
    // Um card "travado" nunca fala com o app: o app deve mostrar a reserva depois de 10 s.
    if (ctx.surface === "card" && ctx.card.content.travar) return;
    call("host.getTheme").then(render);
  });
  const call = (method, params) => new Promise((r) => {
    const id = next++; pending.set(id, r); port.postMessage({ type: "request", id, method, params });
  });
  function render() {
    if (ctx.surface === "card") {
      out.textContent = "Plugin: " + ctx.card.content.osso + " (" + ctx.card.side + ")";
    } else if (ctx.embed) {
      out.textContent = "Aberto pelo bloco: " + ctx.embed.data.osso;
    } else {
      out.textContent = "Painel pronto";
    }
  }
  async function image() {
    const c = document.createElement("canvas"); c.width = 40; c.height = 40;
    const g = c.getContext("2d"); g.fillStyle = "#e11"; g.fillRect(0, 0, 40, 40);
    const blob = await new Promise((r) => c.toBlob(r, "image/png"));
    const res = await call("assets.save", { data: await blob.arrayBuffer(), mime: "image/png" });
    return res.ok ? res.result.assetId : undefined;
  }
  async function propose(travar) {
    const res = await call("cards.proposeVisual", {
      content: { osso: travar ? "travado" : "femur", travar },
      fallback: { front: "Que osso está destacado?", back: "Fêmur (esquerdo)", image: await image() },
    });
    out.textContent = res.ok ? "criado: " + res.result.created : "erro: " + res.error.code;
  }
  document.getElementById("card").onclick = () => propose(false);
  document.getElementById("travado").onclick = () => propose(true);
  document.getElementById("bloco").onclick = async () => {
    const res = await call("notes.insertEmbed", {
      data: { osso: "femur" }, label: "Fêmur (esquerdo)", thumbnail: await image(),
    });
    out.textContent = res.ok ? "bloco inserido" : "erro: " + res.error.code;
  };
`;

function visualPluginZip() {
  return Buffer.from(
    zipSync({
      "visual/manifest.json": strToU8(
        JSON.stringify({
          id: "visual",
          name: "Plugin visual",
          version: "0.1.0",
          apiVersion: "1",
          contributes: {
            panel: { title: "Painel visual" },
            cardRenderer: true,
            noteEmbed: true,
          },
          activation: ["onSubjectTag:Anatomia"],
          permissions: ["notes:write", "cards:write", "assets:write"],
        }),
      ),
      "visual/index.html": strToU8(
        `<!doctype html><p id="out">esperando</p>
         <button id="card">Propor card</button>
         <button id="travado">Propor card travado</button>
         <button id="bloco">Inserir bloco</button>
         <script src="app.js"></script>`,
      ),
      "visual/app.js": strToU8(SCRIPT),
    }),
  );
}

async function installVisualPlugin(page: Page) {
  await page.goto("/plugins");
  await page.getByLabel("Arquivo do plugin (.zip)").setInputFiles({
    name: "visual.zip",
    mimeType: "application/zip",
    buffer: visualPluginZip(),
  });
  await page
    .getByRole("dialog", { name: "Instalar Plugin visual" })
    .getByRole("button", { name: "Instalar e ativar" })
    .click();
  await expect(page.getByTestId("plugin-visual")).toBeVisible();
}

async function createDeck(page: Page, name: string) {
  await page.goto("/revisao");
  await page.getByRole("button", { name: "Novo baralho" }).click();
  await page.getByLabel("Nome").fill(name);
  await page.getByRole("button", { name: "Criar" }).click();
}

/** Matéria com etiqueta e uma nota nela; devolve o painel do plugin aberto pela sugestão. */
async function noteInTaggedSubject(page: Page, isMobile: boolean) {
  await page.goto("/notas");
  // No celular a árvore de matérias fica recolhida.
  if (isMobile) await page.getByText(/^Matérias:/).click();
  const tree = page.locator(isMobile ? "details" : "aside > div.hidden");
  await tree.getByRole("button", { name: "Nova matéria" }).click();
  await page.getByLabel("Nome").fill("Medicina");
  await page.getByRole("button", { name: "Criar" }).click();
  if (isMobile && !(await tree.getByRole("button", { name: "Ações de Medicina" }).isVisible())) {
    await page.getByText(/^Matérias:/).click();
  }
  await tree.getByRole("button", { name: "Ações de Medicina" }).click();
  await page.getByRole("menuitem", { name: "Etiquetas" }).click();
  const dialog = page.getByRole("dialog", { name: "Etiquetas de Medicina" });
  // A etiqueta do plugin aparece como atalho.
  await dialog.getByRole("button", { name: "anatomia · Plugin visual" }).click();
  await expect(dialog.getByLabel("Etiquetas")).toHaveValue("anatomia");
  await dialog.getByRole("button", { name: "Salvar" }).click();

  await page.getByRole("button", { name: "Nova nota" }).click();
  await page.getByLabel("Título da nota").fill("Ossos da perna");
  await page.getByLabel("Matéria").selectOption({ label: "Medicina" });
}

test("card visual, bloco na nota, sugestão por etiqueta e reserva sem o plugin", async ({
  page,
  isMobile,
}) => {
  await installVisualPlugin(page);
  await createDeck(page, "Anatomia");
  await noteInTaggedSubject(page, isMobile);

  // Sugestão discreta: nada abre sozinho.
  await expect(page.locator('iframe[title="Plugin visual"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Abrir Painel visual" }).click();
  const panel = page.frameLocator('iframe[title="Plugin visual"]');
  await expect(panel.locator("#out")).toHaveText("Painel pronto");

  // Bloco na nota, com miniatura e rótulo.
  await panel.getByRole("button", { name: "Inserir bloco" }).click();
  await expect(panel.locator("#out")).toHaveText("bloco inserido");
  const block = page.locator("[data-plugin-embed=visual]");
  await expect(block).toContainText("Fêmur (esquerdo)");
  await expect(block.locator("img")).toBeVisible();
  await expect(page.getByTestId("save-status")).toHaveText("Salvo");

  // Card visual: na confirmação, o usuário personaliza a pergunta e escolhe o baralho.
  await panel.getByRole("button", { name: "Propor card", exact: true }).click();
  const confirm = page.getByRole("dialog", { name: "Criar card visual" });
  await expect(confirm.getByLabel("Pergunta")).toHaveValue("Que osso está destacado?");
  await expect(confirm.getByLabel("Resposta")).toHaveValue("Fêmur (esquerdo)");
  await expect(confirm.locator("img")).toBeVisible();
  await confirm.getByLabel("Pergunta").fill("Qual é este osso da coxa?");
  await confirm.getByRole("button", { name: "Criar card" }).click();
  await expect(panel.locator("#out")).toHaveText("criado: true");

  // Tocar no bloco abre o painel no ponto certo.
  await page.reload();
  await page.locator("[data-plugin-embed=visual] button").first().click();
  await expect(page.frameLocator('iframe[title="Plugin visual"]').locator("#out")).toHaveText(
    "Aberto pelo bloco: femur",
  );

  // Revisão: o plugin desenha frente e verso; os botões continuam do app.
  await page.goto("/estudar");
  const card = page.frameLocator("[data-testid=plugin-card] iframe");
  await expect(card.locator("#out")).toHaveText("Plugin: femur (front)");
  await expect(page.getByTestId("card-front")).toHaveText("Qual é este osso da coxa?");
  await page.getByRole("button", { name: "Mostrar resposta" }).click();
  await expect(card.locator("#out")).toHaveText("Plugin: femur (back)");
  await expect(page.getByTestId("card-back")).toHaveText("Fêmur (esquerdo)");
  await page.getByRole("button", { name: /^Bom/ }).click();
  await expect(page.getByText("Sessão concluída!")).toBeVisible();

  // Depois de criado, o card continua personalizável no baralho.
  await page.goto("/revisao");
  await page.getByRole("link", { name: /Anatomia/ }).click();
  await page.getByRole("button", { name: /Qual é este osso da coxa/ }).click();
  const editor = page.getByRole("dialog", { name: "Editar card" });
  await editor.getByLabel("Verso").fill("Fêmur, o maior osso do corpo");
  await editor.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Fêmur, o maior osso do corpo")).toBeVisible();

  // A busca encontra o card pelo texto personalizado.
  await page.goto("/busca?q=maior");
  await expect(page.getByRole("list", { name: "Resultados" }).getByLabel("Card")).toBeVisible();

  // Plugin desativado: a revisão usa a reserva e o bloco fica "indisponível".
  await page.goto("/plugins");
  await page.getByRole("switch", { name: "Ativar Plugin visual" }).click();
  await expect(page.getByRole("switch", { name: "Ativar Plugin visual" })).toHaveAttribute(
    "aria-checked",
    "false",
  );
  await page.goto("/revisao");
  await page.getByRole("link", { name: /Anatomia/ }).click();
  await page.getByRole("button", { name: "Ações do baralho" }).click();
  await page.getByRole("menuitem", { name: "Praticar todos os cards" }).click();
  await expect(page.getByTestId("card-fallback")).toContainText("Qual é este osso da coxa?");
  await expect(page.getByTestId("card-fallback").locator("img")).toBeVisible();
  await page.goto("/notas");
  await page.getByText("Ossos da perna").click();
  await expect(page.locator("[data-plugin-embed=visual]")).toContainText("Plugin indisponível");
  // Plugin desativado também não é sugerido.
  await expect(page.getByTestId("plugin-suggestions")).toHaveCount(0);
});

test("card visual de plugin que não responde mostra a reserva depois de 10 s", async ({
  page,
  isMobile,
}) => {
  await page.clock.install();
  await installVisualPlugin(page);
  await createDeck(page, "Anatomia");
  await noteInTaggedSubject(page, isMobile);
  await page.getByRole("button", { name: "Abrir Painel visual" }).click();
  const panel = page.frameLocator('iframe[title="Plugin visual"]');
  await panel.getByRole("button", { name: "Propor card travado" }).click();
  await page
    .getByRole("dialog", { name: "Criar card visual" })
    .getByRole("button", { name: "Criar card" })
    .click();
  await expect(panel.locator("#out")).toHaveText("criado: true");

  await page.goto("/estudar");
  await expect(page.locator("[data-testid=plugin-card] iframe")).toBeVisible();
  await page.clock.fastForward("00:11");
  await expect(page.getByTestId("card-fallback")).toContainText("Que osso está destacado?");
  // A revisão continua funcionando com a reserva.
  await page.getByRole("button", { name: "Mostrar resposta" }).click();
  await page.getByRole("button", { name: /^Bom/ }).click();
  await expect(page.getByText("Sessão concluída!")).toBeVisible();
});

test("sem etiqueta na matéria, nenhum plugin é sugerido", async ({ page }) => {
  await installVisualPlugin(page);
  await page.goto("/notas");
  await page.getByRole("button", { name: "Nova nota" }).click();
  await page.getByLabel("Título da nota").fill("Sem matéria");
  await expect(page.getByTestId("save-status")).toHaveText("Salvo");
  await expect(page.getByTestId("plugin-suggestions")).toHaveCount(0);
});

test("Esqueleto 3D: buscar um osso, criar questão visual e revisar com o modelo", async ({
  page,
}) => {
  await createDeck(page, "Ossos");
  await page.goto("/plugins");
  await page.getByRole("switch", { name: "Ativar Esqueleto 3D" }).click();
  await page.getByRole("button", { name: "Permitir e ativar" }).click();
  await page.goto("/plugins/esqueleto-3d");

  const plugin = page.frameLocator('iframe[title="Esqueleto 3D"]');
  await expect(plugin.locator("canvas")).toBeVisible();
  await plugin.getByLabel("Buscar osso").fill("femur");
  await plugin.getByRole("button", { name: "Fêmur (lado esquerdo)" }).click();
  await expect(plugin.getByRole("heading", { name: "Fêmur (lado esquerdo)" })).toBeVisible();
  await expect(plugin.getByText("Os femoris · Membro inferior")).toBeVisible();

  await plugin.getByRole("button", { name: "Criar questão visual" }).click();
  const confirm = page.getByRole("dialog", { name: "Criar card visual" });
  await expect(confirm.getByLabel("Pergunta")).toHaveValue("Que osso está destacado?");
  await expect(confirm.getByLabel("Resposta")).toHaveValue("Fêmur (lado esquerdo) · Os femoris");
  await expect(confirm.locator("img")).toBeVisible();
  await confirm.getByRole("button", { name: "Criar card" }).click();
  await expect(plugin.getByRole("status")).toHaveText("Card criado.");

  await page.goto("/estudar");
  const card = page.frameLocator("[data-testid=plugin-card] iframe");
  await expect(card.locator("canvas")).toBeVisible();
  // Frente: só a pergunta; verso: a resposta, abaixo do modelo.
  await expect(page.getByTestId("card-front")).toHaveText("Que osso está destacado?");
  await expect(page.getByTestId("card-back")).toHaveCount(0);
  await page.getByRole("button", { name: "Mostrar resposta" }).click();
  await expect(page.getByTestId("card-back")).toHaveText("Fêmur (lado esquerdo) · Os femoris");
  await page.getByRole("button", { name: /^Bom/ }).click();
  await expect(page.getByText("Sessão concluída!")).toBeVisible();
});
