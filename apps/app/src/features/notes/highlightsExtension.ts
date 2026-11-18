import { formulaParts, type HighlightMatch } from "@estudarella/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { Extension } from "@tiptap/react";
import { type ActiveRule, useHighlightPrefs, useHighlights } from "../../plugin-host/highlights";
import { usePluginPanel } from "../../plugin-host/stores";

/** Máximo de destaques pintados numa nota (acima disso, para de pintar). */
export const MAX_PAINTED = 2000;

const key = new PluginKey<DecorationSet>("destaques");

/** Classes do destaque: cor da paleta e estilo (marca-texto, letra ou sublinhado). */
const classFor = (rule: ActiveRule) =>
  `hl hl-${rule.style === "formula" ? "text" : rule.style} hl-${rule.color}`;

/**
 * Texto de cada bloco de texto com a posição de cada pedaço no documento. Nós que não são
 * texto (links para notas, blocos de plugin) separam os pedaços: nada é pintado por cima deles.
 */
function textRuns(doc: PMNode): { text: string; pos: number }[] {
  const runs: { text: string; pos: number }[] = [];
  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      const last = runs.at(-1);
      // Texto colado ao anterior (mesmo bloco, marcações diferentes): continua o pedaço.
      if (last && last.pos + last.text.length === pos) last.text += node.text;
      else runs.push({ text: node.text, pos });
    }
    return true;
  });
  return runs;
}

/** Guarda os resultados por pedaço de texto: só os parágrafos alterados são buscados de novo. */
const cache = new WeakMap<object, Map<string, HighlightMatch<ActiveRule>[]>>();

function build(doc: PMNode): DecorationSet {
  if (!useHighlightPrefs.getState().show) return DecorationSet.empty;
  const { highlighter } = useHighlights.getState();
  if (highlighter.size === 0) return DecorationSet.empty;
  let memo = cache.get(highlighter);
  if (!memo) {
    memo = new Map();
    cache.set(highlighter, memo);
  }
  const decorations: Decoration[] = [];
  for (const run of textRuns(doc)) {
    if (decorations.length >= MAX_PAINTED) break;
    let found = memo.get(run.text);
    if (!found) {
      found = highlighter.find(run.text, MAX_PAINTED);
      if (memo.size > 5000) memo.clear();
      memo.set(run.text, found);
    }
    for (const m of found) {
      const from = run.pos + m.from;
      const to = run.pos + m.to;
      const rule = m.rule;
      decorations.push(
        Decoration.inline(from, to, {
          class: classFor(rule),
          title: rule.label ? `${rule.label} · ${rule.pluginName}` : rule.pluginName,
          "data-hl-plugin": rule.pluginId,
          ...(rule.command ? { "data-hl-command": rule.command } : {}),
          ...(rule.label ? { "aria-description": rule.label } : {}),
        }),
      );
      if (rule.style === "formula") {
        for (const part of formulaParts(run.text.slice(m.from, m.to))) {
          decorations.push(
            Decoration.inline(from + part.from, from + part.to, {
              class: part.kind === "sub" ? "hl-sub" : "hl-sup",
            }),
          );
        }
      }
    }
  }
  return DecorationSet.create(doc, decorations);
}

/**
 * Destaques dos plugins na nota: só decorações (o texto salvo nunca muda). Recalcula quando a
 * nota muda, quando as regras mudam e quando o usuário liga ou desliga os destaques.
 */
export const Highlights = Extension.create({
  name: "destaques",

  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key,
        state: {
          init: (_, state) => build(state.doc),
          apply: (tr, old) =>
            tr.docChanged || tr.getMeta(key) ? build(tr.doc) : old.map(tr.mapping, tr.doc),
        },
        props: {
          decorations: (state) => key.getState(state),
          // Tocar numa palavra com comando abre o painel do plugin com a palavra.
          handleClick: (view, _pos, event) => {
            const el = (event.target as HTMLElement | null)?.closest<HTMLElement>(
              "[data-hl-command]",
            );
            if (!el) return false;
            const pluginId = el.dataset.hlPlugin;
            const command = el.dataset.hlCommand;
            if (!pluginId || !command) return false;
            usePluginPanel.getState().show(pluginId, {
              surface: "panel",
              command: { id: command, selection: el.textContent ?? "" },
            });
            // Em leitura, o toque fica só para o destaque; na edição, o cursor também vai para lá.
            return !view.editable;
          },
        },
        view: (view) => {
          // Regras ou preferência mudaram: repinta sem mexer no documento.
          const refresh = () => view.dispatch(view.state.tr.setMeta(key, true));
          const offRules = useHighlights.subscribe(refresh);
          const offPrefs = useHighlightPrefs.subscribe(refresh);
          return {
            destroy: () => {
              offRules();
              offPrefs();
            },
          };
        },
      }),
    ];
  },
});
