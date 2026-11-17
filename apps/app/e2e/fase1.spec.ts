import { expect, type Page, test } from "@playwright/test";

// Cada teste começa com o banco vazio: o OPFS é por contexto, e o Playwright cria um por teste.

async function newNote(page: Page, title: string, body: string) {
  await page.goto("/notas");
  await page.getByRole("button", { name: "Nova nota" }).click();
  await page.getByLabel("Título da nota").fill(title);
  const editor = page.getByLabel("Conteúdo da nota");
  await editor.click();
  await editor.pressSequentially(body);
  await expect(page.getByTestId("save-status")).toHaveText("Salvo");
}

test("matérias: criar, criar tópico dentro e filtrar notas", async ({ page, isMobile }) => {
  await page.goto("/notas");
  if (isMobile) await page.getByText(/^Matérias:/).click();
  const tree = page.locator(isMobile ? "details" : "aside > div.hidden");
  await tree.getByRole("button", { name: "Nova matéria" }).click();
  await page.getByLabel("Nome").fill("Linguística");
  await page.getByRole("button", { name: "Criar" }).click();
  await expect(page.getByRole("heading", { name: "Linguística" })).toBeVisible();

  if (isMobile) await page.getByText(/^Matérias:/).click();
  await tree.getByRole("button", { name: "Ações de Linguística" }).click();
  await page.getByRole("menuitem", { name: /Novo tópico/ }).click();
  await page.getByLabel("Nome").fill("Fonologia");
  await page.getByRole("button", { name: "Criar" }).click();
  await expect(page.getByRole("heading", { name: "Fonologia" })).toBeVisible();

  // Nota criada com o tópico selecionado já nasce nele.
  await page.getByRole("button", { name: "Nova nota" }).click();
  await page.getByLabel("Título da nota").fill("Fonemas");
  await expect(page.getByTestId("save-status")).toHaveText("Salvo");
  await expect(page.getByLabel("Matéria")).toHaveValue(/.+/);
  await page.getByRole("link", { name: "Notas" }).first().click();
  await expect(page.getByRole("link", { name: /Fonemas/ })).toBeVisible();
});

test("notas: salvamento automático, link [[ ]] e notas que apontam para esta", async ({ page }) => {
  await newNote(page, "Sílaba", "Unidade fonológica.");
  await newNote(page, "Acento", "Recai sobre a ");

  const editor = page.getByLabel("Conteúdo da nota");
  await editor.pressSequentially("[[Síl");
  await page.getByRole("option", { name: "Sílaba" }).click();
  await expect(page.locator("[data-note-link]")).toHaveText("Sílaba");
  await expect(page.getByTestId("save-status")).toHaveText("Salvo");

  // O link leva à nota citada, que mostra de onde vem a citação.
  await page.locator("[data-note-link]").click();
  await expect(page.getByLabel("Título da nota")).toHaveValue("Sílaba");
  await expect(page.getByRole("link", { name: "Acento" })).toBeVisible();

  // Renomear não quebra o link.
  await page.getByLabel("Título da nota").fill("Sílaba tônica");
  await expect(page.getByTestId("save-status")).toHaveText("Salvo");
  await page.getByRole("link", { name: "Acento" }).click();
  await expect(page.locator("[data-note-link]")).toHaveText("Sílaba tônica");

  // Persistência real: recarregar mantém tudo.
  await page.reload();
  await expect(page.getByLabel("Conteúdo da nota")).toContainText("Recai sobre a");
  await expect(page.locator("[data-note-link]")).toHaveText("Sílaba tônica");
});

test("[[ com título novo cria a nota citada", async ({ page }) => {
  await newNote(page, "Morfologia", "Ver ");
  await page.getByLabel("Conteúdo da nota").pressSequentially("[[Radical");
  await page.getByRole("option", { name: "Criar nota “Radical”" }).click();
  await expect(page.locator("[data-note-link]")).toHaveText("Radical");
  await page.locator("[data-note-link]").click();
  await expect(page.getByLabel("Título da nota")).toHaveValue("Radical");
});

test("cards: básico com imagem, cloze, revisão e busca", async ({ page }) => {
  await page.goto("/revisao");
  await page.getByRole("button", { name: "Novo baralho" }).click();
  await page.getByLabel("Nome").fill("Fonética");
  await page.getByRole("button", { name: "Criar" }).click();
  await expect(page.getByRole("heading", { name: "Fonética" })).toBeVisible();

  // Básico com imagem na frente.
  await page.getByRole("button", { name: "Card", exact: true }).click();
  await page.getByLabel("Frente", { exact: true }).fill("Que fonema é este?");
  await page.getByLabel("Verso", { exact: true }).fill("Oclusiva bilabial");
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGOI9r6GFTEMLQkAADNfAf9/2pgAAAAASUVORK5CYII=",
    "base64",
  );
  await page
    .getByLabel("Imagem na frente")
    .setInputFiles({ name: "boca.png", mimeType: "image/png", buffer: png });
  await expect(page.getByRole("img", { name: "Imagem na frente" })).toBeVisible();
  await page.getByRole("button", { name: "Adicionar" }).click();

  // Cloze com duas lacunas vira dois cards.
  await page.getByRole("button", { name: "Card", exact: true }).click();
  await page.getByText("Lacunas").click();
  await page.getByLabel("Texto").fill("O {{c1::fonema}} é a menor unidade {{c2::distintiva}}.");
  await expect(page.getByText("2 lacunas")).toBeVisible();
  await page.getByRole("button", { name: "Adicionar" }).click();
  await expect(page.getByText("3 cards")).toBeVisible();

  // Revisão: três cards, todos novos.
  await page.getByRole("button", { name: "Ações do baralho" }).click();
  await page.getByRole("menuitem", { name: "Estudar agora" }).click();
  await expect(page.getByTestId("queue-size")).toHaveText("3 restantes");
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: "Mostrar resposta" }).click();
    await page.getByRole("button", { name: /^Fácil/ }).click();
  }
  await expect(page.getByText("Sessão concluída!")).toBeVisible();

  // Nada mais para hoje, e o início reflete as respostas.
  await page.goto("/");
  await expect(page.getByTestId("today")).toContainText("3Respondidos");
  await expect(page.getByText("Tudo em dia por hoje.")).toBeVisible();

  // Busca encontra o card sem acento.
  await page.goto("/busca");
  await page.getByLabel("Buscar em notas e cards").fill("distint");
  await expect(page.getByRole("list", { name: "Resultados" }).getByRole("link")).toHaveCount(2);
});

test("errar traz o card de volta na mesma sessão", async ({ page }) => {
  await page.goto("/revisao");
  await page.getByRole("button", { name: "Novo baralho" }).click();
  await page.getByLabel("Nome").fill("Verbos");
  await page.getByRole("button", { name: "Criar" }).click();
  await page.getByRole("button", { name: "Card", exact: true }).click();
  await page.getByLabel("Frente", { exact: true }).fill("ser");
  await page.getByLabel("Verso", { exact: true }).fill("to be");
  await page.getByRole("button", { name: "Adicionar" }).click();

  await page.goto("/estudar");
  await page.getByRole("button", { name: "Mostrar resposta" }).click();
  await page.getByRole("button", { name: /^Errei/ }).click();
  await expect(page.getByTestId("queue-size")).toHaveText("1 restante");
  await expect(page.getByTestId("card-front")).toContainText("ser");
});

test("backup: exportar e restaurar", async ({ page }) => {
  await newNote(page, "Nota do backup", "conteúdo importante");
  await page.goto("/ajustes");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar backup" }).click();
  const file = await (await download).path();

  // Muda o estado, depois restaura.
  await page.goto("/notas");
  await page.getByRole("link", { name: /Nota do backup/ }).click();
  await page.getByRole("button", { name: "Ações da nota" }).click();
  await page.getByRole("menuitem", { name: "Excluir nota" }).click();
  await page.getByRole("button", { name: "Excluir" }).click();
  await expect(page.getByText("Nenhuma nota aqui ainda")).toBeVisible();

  await page.goto("/ajustes");
  await page.getByLabel("Arquivo de backup").setInputFiles(file);
  await page.getByRole("button", { name: "Restaurar" }).click();
  await expect(page.getByText("Backup restaurado.")).toBeVisible();
  await page.goto("/notas");
  await expect(page.getByRole("link", { name: /Nota do backup/ })).toBeVisible();
});

test("a busca é refeita ao voltar para a página e ao recarregar", async ({ page }) => {
  await newNote(page, "Morfossintaxe", "análise das classes de palavras");
  await page.goto("/busca");
  await page.getByLabel("Buscar em notas e cards").fill("morfo");
  const results = page.getByRole("list", { name: "Resultados" }).getByRole("link");
  await expect(results).toHaveCount(1);
  await expect(page).toHaveURL(/q=morfo/);

  await page.reload();
  await expect(page.getByLabel("Buscar em notas e cards")).toHaveValue("morfo");
  await expect(results).toHaveCount(1);

  // Saindo e voltando pelo menu (sem ?q= na URL), a última busca é refeita.
  await page.goto("/");
  await page.goto("/busca");
  await expect(page.getByLabel("Buscar em notas e cards")).toHaveValue("morfo");
  await expect(results).toHaveCount(1);
});

test("com o campo de busca vazio, lista todas as notas e cards", async ({ page }) => {
  await newNote(page, "Primeira", "um");
  await newNote(page, "Segunda", "dois");
  await page.goto("/busca");
  const field = page.getByLabel("Buscar em notas e cards");
  await field.fill("");
  const results = page.getByRole("list", { name: "Resultados" }).getByRole("link");
  await expect(results).toHaveCount(2);
  await field.fill("prim");
  await expect(results).toHaveCount(1);
  await field.fill("");
  await expect(results).toHaveCount(2);
});
