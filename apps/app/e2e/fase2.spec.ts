import { writeFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";

async function newNote(page: Page, title: string, body = "") {
  await page.goto("/notas");
  await page.getByRole("button", { name: "Nova nota" }).click();
  await page.getByLabel("Título da nota").fill(title);
  if (body) {
    await page.getByLabel("Conteúdo da nota").click();
    await page.getByLabel("Conteúdo da nota").pressSequentially(body);
  }
  await expect(page.getByTestId("save-status")).toHaveText("Salvo");
}

test("timer: foco concluído vira pausa, conta no progresso e na sequência", async ({ page }) => {
  await page.clock.install();
  await page.goto("/foco");
  await expect(page.getByTestId("focus-clock")).toHaveText("25:00");
  await page.getByRole("button", { name: "Começar foco" }).click();
  await page.clock.fastForward("10:00");
  await expect(page.getByTestId("focus-clock")).toHaveText("15:00");

  // Recarregar não perde o timer.
  await page.reload();
  await expect(page.getByTestId("focus-clock")).toHaveText("15:00");

  // Pausar congela o tempo.
  await page.getByRole("button", { name: "Pausar" }).click();
  await page.clock.fastForward("05:00");
  await expect(page.getByTestId("focus-clock")).toHaveText("15:00");
  await page.getByRole("button", { name: "Continuar" }).click();

  await page.clock.fastForward("15:01");
  await expect(page.getByTestId("focus-phase")).toHaveText("Pausa curta");
  await expect(page.getByTestId("focus-clock")).toHaveText("05:00");
  await expect(page.getByTestId("focus-round")).toHaveText("1 de 4 na rodada");

  await page.goto("/progresso");
  await expect(page.getByTestId("streak")).toContainText("1 dia seguido");
  await expect(page.getByTestId("streak")).toContainText("Hoje já conta.");
  await expect(page.getByText("0h30")).toBeVisible(); // 30 min contando o tempo pausado
});

test("indicador do timer aparece nas outras telas", async ({ page }) => {
  await page.goto("/foco");
  await page.getByRole("button", { name: "Começar foco" }).click();
  await page.goto("/notas");
  await expect(page.getByTestId("focus-pill")).toBeVisible();
  await page.getByTestId("focus-pill").click();
  await expect(page).toHaveURL(/\/foco$/);
});

test("sequência: responder um card conta o dia", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("streak")).toContainText("0 dias seguidos");
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
  await page.getByRole("button", { name: /^Bom/ }).click();
  await page.goto("/");
  await expect(page.getByTestId("streak")).toContainText("1 dia seguido");
  await page.goto("/progresso");
  await expect(page.getByText("100%")).toBeVisible();
});

test("a última edição não se perde ao recarregar logo depois de digitar", async ({ page }) => {
  await newNote(page, "Rascunho", "salvo");
  const editor = page.getByLabel("Conteúdo da nota");
  await editor.press("End");
  await editor.pressSequentially(" e mais isto");
  await page.reload(); // sem esperar o salvamento
  await expect(page.getByLabel("Conteúdo da nota")).toContainText("salvo e mais isto");
  await expect(page.getByTestId("save-status")).toHaveText("Salvo");
  await page.goto("/busca?q=isto");
  await expect(page.getByRole("list", { name: "Resultados" }).getByRole("link")).toHaveCount(1);
});

test("colar [[Nota]] e [[Nota]](texto) cria links", async ({ page }) => {
  await newNote(page, "Fonema");
  await newNote(page, "Colagem");
  const editor = page.getByLabel("Conteúdo da nota");
  await editor.click();
  await editor.evaluate((el) => {
    const data = new DataTransfer();
    data.setData("text/plain", "ver [[Fonema]](o fonema) e [[Morfema]]");
    el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true }));
  });
  await expect(page.locator("[data-note-link]")).toHaveText(["o fonema", "Morfema"]);
  await expect(editor).toContainText("ver o fonema e Morfema");
  await expect(page.getByTestId("save-status")).toHaveText("Salvo");
  await page.locator("[data-note-link]").nth(1).click();
  await expect(page.getByLabel("Título da nota")).toHaveValue("Morfema");
});

test("grafo local na nota leva às notas ligadas", async ({ page }) => {
  await newNote(page, "Fonema");
  await newNote(page, "Sílaba", "ver [[Fonema]] ");
  await expect(page.getByText("Conexões")).toBeVisible();
  await expect(page.getByTestId("graph")).toHaveAttribute("data-nodes", "2");
});

test("grafo com 1.000 notas abre sem travar", async ({ page }, info) => {
  test.slow();
  // Backup gerado com 1.000 notas e 1.500 links, restaurado pela tela de ajustes.
  const now = Date.now();
  const id = (i: number) => `00000000-0000-7000-8000-${String(i).padStart(12, "0")}`;
  const notes = Array.from({ length: 1000 }, (_, i) => ({
    id: id(i),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    subjectId: null,
    title: `Nota ${i}`,
    content: null,
    plainText: "",
  }));
  const links = Array.from({ length: 1500 }, (_, i) => ({
    id: id(10_000 + i),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    sourceNoteId: id(i % 1000),
    targetNoteId: id((i * 7 + 13) % 1000),
    kind: "link",
  })).filter((l) => l.sourceNoteId !== l.targetNoteId);
  const file = info.outputPath("backup.json");
  writeFileSync(
    file,
    JSON.stringify({
      data: { format: "estudarella-backup", version: 1, exportedAt: now, tables: { notes, links } },
      files: {},
    }),
  );
  await page.goto("/ajustes");
  await page.getByLabel("Arquivo de backup").setInputFiles(file);
  await page.getByRole("button", { name: "Restaurar" }).click();
  await expect(page.getByText("Backup restaurado.")).toBeVisible({ timeout: 30_000 });

  await page.goto("/grafo");
  // Mede o maior bloqueio da tela enquanto o grafo abre e o layout roda.
  await page.evaluate(() => {
    const w = window as unknown as { longest: number };
    w.longest = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) w.longest = Math.max(w.longest, e.duration);
    }).observe({ type: "longtask", buffered: false });
  });
  await expect(page.getByTestId("graph")).toHaveAttribute("data-nodes", "1000", {
    timeout: 15_000,
  });
  await page.waitForTimeout(4500); // layout termina
  const longest = await page.evaluate(() => (window as unknown as { longest: number }).longest);
  console.log(`[${info.project.name}] maior bloqueio da tela: ${Math.round(longest)} ms`);
  expect(longest).toBeLessThan(1000);
});

test("a hora de virada do dia fica salva", async ({ page }) => {
  await page.goto("/ajustes");
  await page.getByLabel("O dia de estudo vira às").selectOption("6");
  await page.reload();
  await expect(page.getByLabel("O dia de estudo vira às")).toHaveValue("6");
});
