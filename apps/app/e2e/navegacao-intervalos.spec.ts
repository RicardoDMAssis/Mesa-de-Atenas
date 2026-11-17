import { expect, type Page, test } from "@playwright/test";

async function deckWithCard(page: Page, name: string) {
  await page.goto("/revisao");
  await page.getByRole("button", { name: "Novo baralho" }).click();
  await page.getByLabel("Nome").fill(name);
  await page.getByRole("button", { name: "Criar" }).click();
  for (const [front, back] of [
    ["ser", "to be"],
    ["ter", "to have"],
  ] as const) {
    await page.getByRole("button", { name: "Card", exact: true }).click();
    await page.getByLabel("Frente", { exact: true }).fill(front);
    await page.getByLabel("Verso", { exact: true }).fill(back);
    await page.getByRole("button", { name: "Adicionar" }).click();
  }
  await expect(page.getByText("2 cards")).toBeVisible();
}

test("intervalos personalizados aparecem nos botões e valem ao responder", async ({ page }) => {
  await deckWithCard(page, "Verbos");
  await page.getByRole("button", { name: "Ações do baralho" }).click();
  await page.getByRole("menuitem", { name: "Intervalos de revisão" }).click();
  await page.getByText("Personalizado", { exact: true }).click();
  await page.getByLabel("Errei", { exact: true }).fill("5");
  await page.getByLabel("Unidade de Errei").selectOption("min");
  await page.getByLabel("Difícil", { exact: true }).fill("2");
  await page.getByLabel("Unidade de Difícil").selectOption("h");
  await page.getByLabel("Bom", { exact: true }).fill("4");
  await page.getByLabel("Unidade de Bom").selectOption("d");
  await page.getByLabel("Fácil", { exact: true }).fill("10");
  await page.getByLabel("Unidade de Fácil").selectOption("d");
  await page.getByLabel("Ao acertar de novo").selectOption("2");
  await expect(page.getByTestId("interval-example")).toContainText("4 d → 8 d → 16 d");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("intervalos personalizados")).toBeVisible();

  await page.goto("/estudar");
  await page.getByRole("button", { name: "Mostrar resposta" }).click();
  for (const [label, interval] of [
    ["Errei", "5 min"],
    ["Difícil", "2 h"],
    ["Bom", "4 d"],
    ["Fácil", "10 d"],
  ] as const) {
    await expect(page.getByRole("button", { name: new RegExp(`^${label}`) })).toContainText(
      interval,
    );
  }
  await page.getByRole("button", { name: /^Bom/ }).click();

  // O card respondido volta em 4 dias.
  await page.goto("/revisao");
  await page.getByRole("link", { name: /Verbos/ }).click();
  const due = new Date(Date.now() + 4 * 86_400_000).toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "short",
  });
  await expect(page.getByText(due, { exact: true })).toBeVisible();
});

test("praticar um baralho sem cards vencidos não muda o agendamento", async ({ page }) => {
  await deckWithCard(page, "Verbos");
  await page.goto("/estudar");
  for (let i = 0; i < 2; i++) {
    await page.getByRole("button", { name: "Mostrar resposta" }).click();
    await page.getByRole("button", { name: /^Fácil/ }).click();
  }
  await expect(page.getByText("Sessão concluída!")).toBeVisible();

  // Nada vence, mas o baralho pode ser praticado.
  await page.goto("/revisao");
  await page.getByRole("button", { name: "Praticar" }).click();
  await expect(page.getByText("Prática", { exact: true })).toBeVisible();
  await expect(page.getByTestId("queue-size")).toHaveText("2 restantes");
  await page.getByRole("button", { name: "Mostrar resposta" }).click();
  await page.getByRole("button", { name: /^Errei/ }).click();
  await expect(page.getByTestId("queue-size")).toHaveText("2 restantes"); // errado volta ao fim
  for (let i = 0; i < 2; i++) {
    await page.getByRole("button", { name: "Mostrar resposta" }).click();
    await page.getByRole("button", { name: /^Bom/ }).click();
  }
  await expect(page.getByText("Prática concluída!")).toBeVisible();

  // A prática não contou como revisão nem alterou o que vence hoje.
  await page.goto("/");
  await expect(page.getByTestId("today")).toContainText("2Respondidos");
  await expect(page.getByText("Tudo em dia por hoje.")).toBeVisible();
});

test("painel de telas: busca, abre telas e notas", async ({ page, isMobile }) => {
  await page.goto("/notas");
  await page.getByRole("button", { name: "Nova nota" }).click();
  await page.getByLabel("Título da nota").fill("Fonologia");
  await expect(page.getByTestId("save-status")).toHaveText("Salvo");

  await page.goto("/");
  await expect(page.getByTestId("streak")).toBeVisible(); // app pronto
  if (isMobile) await page.getByRole("button", { name: "Mais" }).click();
  else await page.keyboard.press("Control+k");
  const input = page.getByLabel("Ir para tela ou nota");
  await input.fill("pomo");
  await expect(page.getByRole("list", { name: "Telas" }).getByRole("button")).toHaveText(["Foco"]);
  await input.press("Enter");
  await expect(page).toHaveURL(/\/foco$/);

  // No celular, o botão "Mais" mostra o nome da tela atual quando ela não está na barra.
  if (isMobile)
    await page.getByRole("navigation", { name: "Barra inferior" }).getByRole("button").click();
  else await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog").getByText("Recentes")).toBeVisible();
  await input.fill("fono");
  await page.getByRole("list", { name: "Notas encontradas" }).getByRole("button").click();
  await expect(page.getByLabel("Título da nota")).toHaveValue("Fonologia");
});

test("celular: personalizar as telas da barra inferior", async ({ page, isMobile }) => {
  test.skip(!isMobile, "barra inferior só existe no celular");
  await page.goto("/");
  const bar = page.getByRole("navigation", { name: "Barra inferior" });
  await expect(bar.getByRole("link")).toHaveText(["Início", "Notas", "Revisão", "Grafo"]);
  await bar.getByRole("button", { name: "Mais" }).click();
  await page.getByRole("button", { name: "Personalizar barra" }).click();
  await page.getByRole("button", { name: "Grafo" }).click(); // desafixa
  await page.getByRole("button", { name: "Foco" }).click(); // fixa
  await page.getByRole("button", { name: "Pronto" }).click();
  await page.keyboard.press("Escape");
  await expect(bar.getByRole("link")).toHaveText(["Início", "Notas", "Revisão", "Foco"]);
  await page.reload();
  await expect(bar.getByRole("link")).toHaveText(["Início", "Notas", "Revisão", "Foco"]);
});
