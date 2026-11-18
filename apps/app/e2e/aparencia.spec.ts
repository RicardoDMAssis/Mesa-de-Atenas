import { expect, test } from "@playwright/test";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

const accent = (el: HTMLElement) => getComputedStyle(el).getPropertyValue("--accent").trim();

test("paleta, cor própria, fonte e tamanho do texto ficam salvos", async ({ page }) => {
  await page.goto("/ajustes");
  const html = page.locator("html");

  await page.getByText("Oceano", { exact: true }).click();
  await expect.poll(() => html.evaluate(accent)).toBe("#0b6e99");

  // No escuro, a mesma paleta usa a versão escura.
  await page.getByText("Escuro", { exact: true }).click();
  await expect.poll(() => html.evaluate(accent)).toBe("#5cc3ea");
  await page.getByText("Claro", { exact: true }).click();

  await page.locator("label").filter({ hasText: "Feita para leitura fácil" }).click();
  await expect
    .poll(() => page.locator("body").evaluate((b) => getComputedStyle(b).fontFamily))
    .toContain("Estudarella Lexend");

  await page.getByText("Grande", { exact: true }).click();
  await expect(html).toHaveAttribute("style", /font-size: 112%/);

  await page.getByLabel("Cor de destaque personalizada").fill("#ff0000");
  await expect.poll(() => html.evaluate(accent)).toBe("#ff0000");

  await page.reload();
  await expect.poll(() => html.evaluate(accent)).toBe("#ff0000");
  await expect(html).toHaveAttribute("style", /font-size: 112%/);

  await page.getByRole("button", { name: "Usar a da paleta" }).click();
  await expect.poll(() => html.evaluate(accent)).toBe("#0b6e99");

  await page.getByRole("button", { name: "Restaurar cores e fontes padrão" }).click();
  await expect.poll(() => html.evaluate(accent)).toBe("#5b4bd6");
  await expect(html).not.toHaveAttribute("style", /font-size/);
});

test("imagem de fundo: escolher, ajustar, manter ao recarregar e remover", async ({ page }) => {
  await page.goto("/ajustes");
  await page
    .getByLabel("Arquivo da imagem de fundo")
    .setInputFiles({ name: "fundo.png", mimeType: "image/png", buffer: PNG });

  const layer = page.getByTestId("app-background");
  await expect(layer).toBeAttached();
  await expect(page.locator("html")).toHaveAttribute("data-bg", "");

  await page.getByLabel("Desfoque").fill("8");
  await expect(layer).toHaveAttribute("style", /blur\(8px\)/);

  await page.reload();
  await expect(page.getByTestId("app-background")).toBeAttached();

  await page.getByRole("button", { name: "Remover" }).click();
  await expect(page.getByTestId("app-background")).toHaveCount(0);
  await expect(page.locator("html")).not.toHaveAttribute("data-bg");
});
