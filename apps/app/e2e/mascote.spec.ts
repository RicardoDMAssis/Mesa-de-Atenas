import { expect, type Page, test } from "@playwright/test";

/** Opção de mascote nos Ajustes (o rádio fica escondido; clica-se no cartão). */
const option = (page: Page, name: string | RegExp) =>
  page.locator("label").filter({ has: page.getByRole("radio", { name, exact: true }) });

test("escolher mascote: Início, canto da tela, busca, revisão e desligar", async ({ page }) => {
  await page.goto("/ajustes");
  await option(page, "Sapinho").click();
  await page.getByLabel("Apelido").fill("Croaquinho");

  // Sem baralhos: boas-vindas no Início; nas outras telas, o mascote do canto abre o balão sozinho.
  await page.goto("/");
  const widget = page.getByLabel("Mascote").getByTestId("mascot-panel");
  await expect(widget).toHaveAttribute("data-kind", "welcome");
  await expect(widget).toContainText("Croaquinho");
  // No Início o recado já está no widget; o mascote do canto não repete.
  const companion = page.getByTestId("companion");
  await page.waitForTimeout(1500);
  await expect(companion.getByRole("status")).toHaveCount(0);
  await page.goto("/notas");
  await expect(companion.getByRole("status")).toContainText("Crie um baralho");
  await companion.getByRole("button", { name: "Uma dica" }).click();
  await expect(companion.getByRole("status")).toContainText("Dica:");
  await companion.getByRole("button", { name: "Não avisar mais hoje" }).click();
  await expect(companion.getByRole("status")).toHaveCount(0);

  // Na busca: sem resultado, sugere criar uma nota com o termo.
  await page.goto("/busca");
  await expect(page.getByTestId("companion")).toHaveCount(0);
  await page.getByLabel("Buscar em notas e cards").fill("fotossintese");
  const searchMascot = page.getByTestId("search-mascot");
  await expect(searchMascot).toContainText("Não achei nada com “fotossintese”");
  await searchMascot.getByRole("button", { name: "Criar nota “fotossintese”" }).click();
  await expect(page).toHaveURL(/\/notas\/.+/);
  await expect(page.getByLabel("Título da nota")).toHaveValue("fotossintese");
  await page.goto("/busca?q=fotossintese");
  await expect(searchMascot).toContainText("Achei 1 nota");
  await expect(searchMascot).toHaveAttribute("data-mood", "happy");

  // Na revisão: reage às respostas e comemora no fim.
  await page.goto("/revisao");
  await page.getByRole("button", { name: "Novo baralho" }).click();
  await page.getByLabel("Nome").fill("Biologia");
  await page.getByRole("button", { name: "Criar" }).click();
  await page.getByRole("button", { name: "Card", exact: true }).click();
  await page.getByLabel("Frente", { exact: true }).fill("Organela da fotossíntese");
  await page.getByLabel("Verso", { exact: true }).fill("Cloroplasto");
  await page.getByRole("button", { name: "Adicionar" }).click();
  await page.goto("/estudar");
  await expect(page.getByTestId("study-buddy")).toHaveAttribute("data-mood", "idle");
  await page.getByRole("button", { name: "Mostrar resposta" }).click();
  await page.getByRole("button", { name: /^Bom/ }).click();
  await expect(page.getByTestId("mascot-says")).toHaveAttribute("data-kind", "celebrate");
  await expect(page.getByTestId("mascot-says")).toContainText(/100%|Quase tudo certo/);

  // Tudo revisado: o Início comemora.
  await page.goto("/");
  await expect(widget).toHaveAttribute("data-kind", "done");

  // Desligar tira o mascote de todo lugar.
  await page.goto("/ajustes");
  await option(page, /Nenhum/).click();
  await page.goto("/");
  await expect(page.getByTestId("companion")).toHaveCount(0);
  await expect(page.getByText("Escolha um mascote em")).toBeVisible();
  await page.goto("/busca");
  await expect(page.getByTestId("search-mascot")).toHaveCount(0);
});

test("meta diária, quiz no balão, resumo da semana e recompensas", async ({ page }) => {
  await page.goto("/ajustes");
  await option(page, "Sapinho").click();
  await page.getByLabel("Meta diária").selectOption("10");
  // Recompensas: bloqueadas até a sequência chegar lá.
  await expect(page.getByRole("radio", { name: /Cérebro/ })).toBeDisabled();
  await expect(page.getByText("Sua melhor sequência: 0 dias")).toBeVisible();

  await page.goto("/revisao");
  await page.getByRole("button", { name: "Novo baralho" }).click();
  await page.getByLabel("Nome").fill("Química");
  await page.getByRole("button", { name: "Criar" }).click();
  await page.getByRole("button", { name: "Card", exact: true }).click();
  await page.getByLabel("Frente", { exact: true }).fill("Símbolo do ouro");
  await page.getByLabel("Verso", { exact: true }).fill("Au");
  await page.getByRole("button", { name: "Adicionar" }).click();

  await page.goto("/");
  const panel = page.getByLabel("Mascote").getByTestId("mascot-panel");
  await expect(panel.getByRole("progressbar", { name: "Meta do dia" })).toHaveAttribute(
    "aria-valuenow",
    "0",
  );
  await panel.getByRole("button", { name: "Quiz rápido" }).click();
  const quiz = panel.getByTestId("mascot-quiz");
  await expect(quiz).toContainText("Símbolo do ouro");
  await quiz.getByRole("button", { name: "Mostrar resposta" }).click();
  await expect(quiz).toContainText("Au");
  await quiz.getByRole("button", { name: "Bom" }).click();
  // Era o único card do dia: o quiz termina.
  await expect(quiz.getByRole("status")).toContainText("Fim do quiz: 1 card respondido");
  await quiz.getByRole("button", { name: "Fechar quiz" }).click();
  await expect(panel.getByRole("progressbar", { name: "Meta do dia" })).toHaveAttribute(
    "aria-valuenow",
    "1",
  );
  await expect(panel).toContainText("Não há mais cards hoje para a meta de 10");

  await panel.getByRole("button", { name: "Resumo da semana" }).click();
  await expect(panel).toHaveAttribute("data-kind", "week");
  await expect(panel).toContainText("1 resposta");
  await expect(panel).toContainText("1 dia de estudo");
});

test("o mascote comemora o fim do bloco de foco", async ({ page }) => {
  await page.goto("/ajustes");
  await option(page, "Sapinho").click();
  // Um bloco de foco que termina em 2 segundos.
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem("estudarella:foco") ?? '{"state":{}}');
    const now = Date.now();
    saved.state = {
      ...saved.state,
      timer: {
        phase: "focus",
        status: "running",
        endsAt: now + 2000,
        remaining: null,
        focusStartedAt: now - 25 * 60_000,
        completed: 0,
        subjectId: null,
      },
    };
    localStorage.setItem("estudarella:foco", JSON.stringify(saved));
  });
  await page.goto("/notas");
  const companion = page.getByTestId("companion");
  await expect(companion.getByTestId("mascot-panel")).toHaveAttribute("data-kind", "focus-done", {
    timeout: 10_000,
  });
  await expect(companion).toContainText("Bloco de foco concluído");
});
