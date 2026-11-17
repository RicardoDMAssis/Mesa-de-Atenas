import { expect, test } from "@playwright/test";

test("personalizar o Início: remover, reordenar, restaurar e manter ao recarregar", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("streak")).toBeVisible();
  await page.getByRole("button", { name: "Personalizar" }).click();

  await page.getByRole("button", { name: "Remover Foco" }).click();
  await page.getByRole("button", { name: "Subir Notas recentes" }).click();
  await page.getByRole("button", { name: "Pronto" }).click();

  await expect(page.getByRole("heading", { name: "Foco" })).toHaveCount(0);
  const titles = page.locator("main h2");
  await expect(titles).toContainText(["Hoje", "Notas recentes", "Atalhos"]);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Foco" })).toHaveCount(0);

  await page.getByRole("button", { name: "Personalizar" }).click();
  await page.getByRole("button", { name: "Adicionar widget" }).click();
  await page
    .getByRole("list", { name: "Widgets disponíveis" })
    .getByText("Foco", { exact: true })
    .click();
  await page.getByRole("button", { name: "Pronto" }).click();
  await expect(page.getByRole("heading", { name: "Foco" })).toBeVisible();

  await page.getByRole("button", { name: "Personalizar" }).click();
  await page.getByRole("button", { name: "Restaurar padrão" }).click();
  await page.getByRole("button", { name: "Pronto" }).click();
  await expect(titles).toContainText(["Hoje", "Atalhos", "Foco", "Notas recentes"]);
});

test("atalhos com telas escolhidas, incluindo a tela de um plugin", async ({ page }) => {
  // Ativa o dicionário para a tela dele existir.
  await page.goto("/plugins");
  await page.getByRole("switch", { name: "Ativar Dicionário PT" }).click();
  await page.getByRole("button", { name: "Permitir e ativar" }).click();

  await page.goto("/");
  await page.getByRole("button", { name: "Personalizar" }).click();
  await page.getByRole("button", { name: "Configurar Atalhos" }).click();
  const dialog = page.getByRole("dialog", { name: "Telas dos atalhos" });
  for (const name of ["Notas", "Revisão", "Buscar", "Grafo"]) {
    await dialog.getByRole("checkbox", { name }).uncheck();
  }
  await dialog.getByRole("checkbox", { name: "Progresso" }).check();
  await dialog.getByRole("checkbox", { name: /Dicionário/ }).check();
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await page.getByRole("button", { name: "Pronto" }).click();

  const shortcuts = page.getByRole("list", { name: "Atalhos" }).getByRole("link");
  await expect(shortcuts).toHaveText(["Progresso", "Dicionário"]);
  await shortcuts.filter({ hasText: "Dicionário" }).click();
  await expect(page).toHaveURL(/\/plugins\/dicionario-pt$/);
});

test("widget de plugin no Início: busca rápida do dicionário", async ({ page }) => {
  await page.context().route("https://pt.wiktionary.org/**", (route) =>
    route.fulfill({
      json: {
        parse: { title: "feliz", wikitext: "{{-pt-}}=\n==Adjetivo==\n# que sente [[alegria]]\n" },
      },
      headers: { "access-control-allow-origin": "*" },
    }),
  );
  await page.goto("/plugins");
  await page.getByRole("switch", { name: "Ativar Dicionário PT" }).click();
  await page.getByRole("button", { name: "Permitir e ativar" }).click();

  await page.goto("/");
  await page.getByRole("button", { name: "Personalizar" }).click();
  await page.getByRole("button", { name: "Adicionar widget" }).click();
  const option = page
    .getByRole("list", { name: "Widgets disponíveis" })
    .getByText("Plugin: Dicionário PT");
  await option.click();
  await page.getByRole("button", { name: "Pronto" }).click();

  const widget = page.getByTestId("widget-dicionario-pt-busca");
  await widget.scrollIntoViewIfNeeded();
  const frame = widget.frameLocator("iframe");
  await frame.getByLabel("Buscar palavra").fill("feliz");
  await frame.getByRole("button", { name: "Buscar" }).click();
  await expect(page).toHaveURL(/\/plugins\/dicionario-pt$/);
  await expect(
    page.frameLocator('iframe[title="Dicionário PT"]').getByText("que sente alegria"),
  ).toBeVisible();

  // Desativar o plugin tira o widget do Início; reativar traz de volta.
  await page.goto("/plugins");
  await page.getByRole("switch", { name: "Ativar Dicionário PT" }).click();
  await page.goto("/");
  await expect(page.getByTestId("widget-dicionario-pt-busca")).toHaveCount(0);
  await page.goto("/plugins");
  await page.getByRole("switch", { name: "Ativar Dicionário PT" }).click();
  await page.getByRole("button", { name: "Permitir e ativar" }).click();
  await page.goto("/");
  await expect(page.getByTestId("widget-dicionario-pt-busca")).toBeVisible();
});
