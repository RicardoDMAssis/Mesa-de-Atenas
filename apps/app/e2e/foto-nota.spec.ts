import { expect, test } from "@playwright/test";

/*
 * Plugin "Foto para nota": lê o texto de uma foto no próprio aparelho (Tesseract, sem internet)
 * e sugere uma nota, que o usuário confere e confirma. A foto é gerada no teste: texto impresso
 * renderizado pelo navegador e fotografado com screenshot.
 */

async function photoOfText(page: import("@playwright/test").Page): Promise<Buffer> {
  const other = await page.context().newPage();
  await other.setViewportSize({ width: 1000, height: 600 });
  await other.setContent(`
    <div id="pagina" style="background:#fff;color:#111;font:34px/1.5 Georgia,serif;padding:48px;width:900px">
      <p style="margin:0 0 30px;font-weight:bold">Citologia</p>
      <p style="margin:0">A mitocôndria é a orga-<br>nela responsável pela<br>respiração celular.</p>
    </div>`);
  const shot = await other.locator("#pagina").screenshot();
  await other.close();
  return shot;
}

test("Foto para nota: lê o texto da foto, cria a nota e guarda a foto original", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const photo = await photoOfText(page);

  await page.goto("/plugins");
  await page.getByRole("switch", { name: "Ativar Foto para nota" }).click();
  await expect(
    page.getByText("Criar notas novas (você confere e confirma cada uma)"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Permitir e ativar" }).click();
  await page.goto("/plugins/foto-nota");

  const plugin = page.frameLocator('iframe[title="Foto para nota"]');
  await expect(plugin.getByRole("heading", { name: "Foto para nota" })).toBeVisible();
  await plugin
    .getByLabel("Escolher fotos")
    .setInputFiles({ name: "pagina.png", mimeType: "image/png", buffer: photo });
  await expect(plugin.getByRole("img", { name: "Foto 1" })).toBeVisible();
  await plugin.getByRole("button", { name: "Ler texto" }).click();

  await expect(plugin.getByRole("heading", { name: "Confira o texto" })).toBeVisible({
    timeout: 90_000,
  });
  await expect(plugin.getByLabel("Título")).toHaveValue("Citologia");
  // Linhas juntadas e hifenização desfeita ("orga-" + "nela").
  await expect(plugin.getByLabel("Texto lido")).toHaveValue(
    /mitoc[oô]ndria [eé] a organela respons[aá]vel pela respira[cç][aã]o celular/,
  );

  await plugin.getByRole("button", { name: "Criar nota" }).click();
  const dialog = page.getByRole("dialog", { name: "Criar nota" });
  await expect(dialog.getByText("Sugerida por Foto para nota.")).toBeVisible();
  await expect(dialog.getByLabel("Título")).toHaveValue("Citologia");
  await expect(dialog.getByLabel("Guardar junto na nota: Foto original")).toBeChecked();
  // O usuário pode corrigir o texto antes de criar.
  await dialog
    .getByLabel("Texto")
    .fill("A mitocôndria é a organela da respiração celular.\n\n- ATP");
  await dialog.getByRole("button", { name: "Criar nota" }).click();

  await expect(page).toHaveURL(/\/notas\//);
  await expect(page.getByLabel("Título da nota")).toHaveValue("Citologia");
  const editor = page.locator(".ProseMirror");
  await expect(editor.getByText("A mitocôndria é a organela da respiração celular.")).toBeVisible();
  await expect(editor.locator("ul li")).toHaveText("ATP");
  const block = page.locator('[data-plugin-embed="foto-nota"]');
  await expect(block).toContainText("Foto original");
  await expect(block.locator("img")).toBeVisible();

  // Tocar no bloco mostra a foto guardada.
  await block.getByRole("button").first().click();
  const panel = page.frameLocator('iframe[title="Foto para nota"]');
  await expect(panel.getByRole("img", { name: "Foto original 1" })).toBeVisible();

  // A nota aparece na busca pelo texto.
  await page.goto("/busca?q=organela");
  await expect(page.getByText("Citologia").first()).toBeVisible();
});

test("Foto para nota: cancelar a nota apaga as fotos guardadas", async ({ page }) => {
  test.setTimeout(120_000);
  const photo = await photoOfText(page);
  await page.goto("/plugins");
  await page.getByRole("switch", { name: "Ativar Foto para nota" }).click();
  await page.getByRole("button", { name: "Permitir e ativar" }).click();
  await page.goto("/plugins/foto-nota");

  const plugin = page.frameLocator('iframe[title="Foto para nota"]');
  await plugin
    .getByLabel("Escolher fotos")
    .setInputFiles({ name: "pagina.png", mimeType: "image/png", buffer: photo });
  await plugin.getByRole("button", { name: "Ler texto" }).click();
  await expect(plugin.getByRole("heading", { name: "Confira o texto" })).toBeVisible({
    timeout: 90_000,
  });
  await plugin.getByRole("button", { name: "Criar nota" }).click();
  await page
    .getByRole("dialog", { name: "Criar nota" })
    .getByRole("button", { name: "Cancelar" })
    .click();
  await expect(plugin.getByRole("button", { name: "Criar nota" })).toBeEnabled();

  await page.goto("/plugins");
  // Nenhum arquivo ficou guardado pelo plugin.
  await expect(page.getByRole("switch", { name: "Ativar Foto para nota" })).toBeVisible();
  await expect(page.getByText(/arquivos? guardados?/)).toHaveCount(0);
});
