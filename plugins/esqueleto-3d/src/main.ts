import { app, PluginError } from "@estudarella/plugin-sdk";
import { type BoneData, boneLabel, loadBones, matches } from "./bones";
import { SkeletonViewer } from "./viewer";

/*
 * Esqueleto 3D. A mesma página atende a todas as superfícies:
 * - tela própria e painel: explorar, buscar, isolar região, criar questão visual, bloco na nota;
 * - card (revisão): o osso destacado na frente; o nome aparece no verso;
 * - painel aberto por um bloco da nota: já abre naquele osso.
 */

/** O que fica guardado no card visual e no bloco da nota. */
interface BoneRef {
  osso: string;
  view?: { position: number[]; target: number[] };
}

const root = document.getElementById("app") as HTMLElement;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> & { className?: string } = {},
  ...children: (Node | string | null | undefined)[]
): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  for (const child of children) if (child != null) node.append(child);
  return node;
}

const accent = () =>
  getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#5b4bd6";

const attribution = (provisional: boolean) =>
  el(
    "p",
    { className: "credit" },
    provisional
      ? "Modelo provisório (blocos). Nomes: Terminologia Anatômica (TA2) via Z-Anatomy, CC BY-SA 4.0."
      : "Modelo: Z-Anatomy (CC BY-SA 4.0), baseado em BodyParts3D © DBCLS (CC BY-SA 2.1 JP).",
  );

async function start() {
  const ctx = await app.ready();
  const [model, data] = await Promise.all([
    app.files.read("modelo/esqueleto.glb"),
    loadBones(() => app.files.read("modelo/ossos.json")),
  ]);
  const ready = () => {
    // Tempo até o modelo aparecer, desde que o iframe abriu (usado nas medições no celular).
    document.documentElement.dataset.prontoMs = String(Math.round(performance.now()));
  };
  if (ctx.surface === "card") return cardView(model, ctx.card?.content as BoneRef).then(ready);
  return explorer(model, data, (ctx.embed?.data as BoneRef | undefined) ?? null, ctx.surface).then(
    ready,
  );
}

// ---------- card da revisão ----------

/**
 * Só o modelo, com o osso destacado. A pergunta e a resposta (personalizáveis pelo
 * usuário) são mostradas pelo app acima e abaixo; o plugin não repete o nome.
 */
async function cardView(model: ArrayBuffer, initial: BoneRef) {
  const stage = el("div", { className: "stage card" });
  root.replaceChildren(stage);
  const viewer = new SkeletonViewer(stage, { accent: accent(), readOnly: true });
  await viewer.load(model);

  let current = "";
  const show = (ref: BoneRef) => {
    // Frente e verso mostram o mesmo modelo: só muda algo quando troca de card.
    const key = JSON.stringify(ref);
    if (key === current) return;
    current = key;
    viewer.select(ref.osso);
    if (ref.view) viewer.view = ref.view;
    else viewer.focus(ref.osso);
  };
  show(initial);
  // O app reaproveita o mesmo iframe entre cards seguidos.
  app.on("context.changed", (next) => {
    if (next.card) show(next.card.content as BoneRef);
  });
}

// ---------- tela própria e painel ----------

async function explorer(
  model: ArrayBuffer,
  data: BoneData,
  initial: BoneRef | null,
  surface: string,
) {
  let selected: string | null = null;
  let region = "";

  const search = el("input", {
    type: "search",
    placeholder: "Buscar osso",
    ariaLabel: "Buscar osso",
  });
  const regionSelect = el(
    "select",
    { ariaLabel: "Região" },
    el("option", { value: "", textContent: "Todas as regiões" }),
    ...data.regioes.map((r) => el("option", { value: r, textContent: r })),
  );
  const isolate = el("input", { type: "checkbox" });
  const isolateLabel = el("label", { className: "inline" }, isolate, " Isolar região");
  const results = el("ul", { className: "results", hidden: true, ariaLabel: "Ossos encontrados" });
  const stage = el("div", { className: "stage" });
  const hint = el("p", { className: "hint", textContent: "Toque num osso para ver o nome." });
  const name = el("h2", { className: "name" });
  const latin = el("p", { className: "latin" });
  const status = el("p", { className: "status", role: "status" });
  const create = el("button", { type: "button", textContent: "Criar questão visual" });
  const embed = el("button", {
    type: "button",
    className: "secondary",
    textContent: "Adicionar à nota",
  });
  const info = el("section", { className: "info", hidden: true }, name, latin);
  const actions = el("div", { className: "actions", hidden: true }, create, embed);

  root.replaceChildren(
    el("div", { className: "toolbar" }, search, regionSelect, isolateLabel),
    results,
    stage,
    hint,
    info,
    actions,
    status,
    attribution(data.provisorio),
  );

  const viewer = new SkeletonViewer(stage, {
    accent: accent(),
    onPick: (id) => choose(id, false),
  });
  await viewer.load(model);

  const applyRegion = () => {
    const ids = region ? viewer.boneIds.filter((id) => data.ossos[id]?.regiao === region) : null;
    viewer.isolate(isolate.checked ? ids : null);
  };

  function choose(id: string | null, focus: boolean) {
    selected = id && data.ossos[id] ? id : null;
    viewer.select(selected);
    if (selected && focus) viewer.focus(selected);
    const bone = selected ? data.ossos[selected] : null;
    info.hidden = actions.hidden = !bone;
    hint.hidden = Boolean(bone);
    status.textContent = "";
    if (bone) {
      name.textContent = bone.pt;
      latin.textContent = `${bone.la} · ${bone.regiao}`;
    }
  }

  search.addEventListener("input", () => {
    const found = viewer.boneIds
      .filter((id) => data.ossos[id] && matches(data.ossos[id], search.value))
      .slice(0, 8);
    results.hidden = !search.value.trim();
    results.replaceChildren(
      ...(found.length
        ? found.map((id) =>
            el(
              "li",
              {},
              el("button", {
                type: "button",
                textContent: data.ossos[id]?.pt ?? id,
                onclick: () => {
                  choose(id, true);
                  results.hidden = true;
                  search.value = "";
                },
              }),
            ),
          )
        : [el("li", { className: "empty", textContent: "Nenhum osso com esse nome." })]),
    );
  });
  regionSelect.addEventListener("change", () => {
    region = regionSelect.value;
    applyRegion();
  });
  isolate.addEventListener("change", applyRegion);

  const thumbnail = async () => {
    const { assetId } = await app.assets.save({ data: await viewer.snapshot(), mime: "image/png" });
    return assetId;
  };

  create.addEventListener("click", async () => {
    if (!selected) return;
    status.textContent = "Preparando…";
    try {
      const ref: BoneRef = { osso: selected, view: viewer.view };
      const { created } = await app.cards.proposeVisual({
        content: ref,
        fallback: {
          front: "Que osso está destacado?",
          back: boneLabel(data, selected),
          image: await thumbnail(),
        },
      });
      status.textContent = created ? "Card criado." : "";
    } catch (e) {
      status.textContent = e instanceof PluginError ? e.message : "Não foi possível criar o card.";
    }
  });

  embed.addEventListener("click", async () => {
    if (!selected) return;
    try {
      const ref: BoneRef = { osso: selected, view: viewer.view };
      await app.notes.insertEmbed({
        data: ref,
        label: data.ossos[selected]?.pt ?? selected,
        thumbnail: await thumbnail(),
      });
      status.textContent = "Adicionado à nota.";
    } catch (e) {
      status.textContent =
        e instanceof PluginError ? e.message : "Abra uma nota em modo edição para adicionar.";
    }
  });
  // "Adicionar à nota" só faz sentido com uma nota aberta (painel).
  embed.hidden = surface !== "panel";

  if (initial) {
    choose(initial.osso, !initial.view);
    if (initial.view) viewer.view = initial.view;
  }
}

start().catch((e) => {
  console.error(e);
  root.replaceChildren(
    el("p", { className: "status", textContent: "Não foi possível abrir o modelo." }),
  );
});
